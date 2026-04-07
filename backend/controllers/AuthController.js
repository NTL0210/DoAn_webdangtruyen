import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AccountAppeal from '../models/AccountAppeal.js';
import webSocketManager from '../websocket/WebSocketManager.js';
import { clearExpiredPostingRestriction, serializePostingRestriction } from '../utils/moderation.js';
import { pruneUserSavedContentReferences } from '../utils/savedContent.js';

function signAppealToken(userId) {
  return jwt.sign(
    { userId, purpose: 'account-appeal' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

function buildPendingLoginNotice(user) {
  if (!user.pendingLoginNoticeType || !user.pendingLoginNoticeTitle || !user.pendingLoginNoticeMessage) {
    return null;
  }

  return {
    type: user.pendingLoginNoticeType,
    title: user.pendingLoginNoticeTitle,
    message: user.pendingLoginNoticeMessage
  };
}

// Register a new user
export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
          field
        }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: 'user'
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

// Login user
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid email or password'
        }
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid email or password'
        }
      });
    }

    await clearExpiredPostingRestriction(user);

    if (user.accountStatus === 'permanently-banned') {
      const latestAppeal = await AccountAppeal.findOne({ user: user._id })
        .sort({ updatedAt: -1, createdAt: -1 })
        .select('status appealReason evidence reviewReason reviewedAt createdAt');

      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED_PERMANENT',
          message: `This account has been permanently banned. Reason: ${user.permanentBanReason}`
        },
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          permanentBanReason: user.permanentBanReason,
          permanentlyBannedAt: user.permanentlyBannedAt,
          appealToken: signAppealToken(user._id),
          latestAppeal
        }
      });
    }

    const loginNotice = buildPendingLoginNotice(user);
    const sanitizedCollections = await pruneUserSavedContentReferences(user);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const responsePayload = {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          avatar: user.avatar,
          bio: user.bio,
          likes: sanitizedCollections.likes,
          bookmarks: sanitizedCollections.bookmarks,
          favoriteTags: Array.isArray(user.favoriteTags) ? user.favoriteTags : [],
          accountStatus: user.accountStatus,
          ...serializePostingRestriction(user)
        },
        loginNotice
      }
    };

    if (loginNotice) {
      user.pendingLoginNoticeType = null;
      user.pendingLoginNoticeTitle = '';
      user.pendingLoginNoticeMessage = '';
      await user.save();
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

export async function submitAccountAppeal(req, res) {
  try {
    const { appealToken, reason, evidence } = req.body;

    if (!appealToken || !String(reason || '').trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Appeal token and appeal reason are required'
        }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(appealToken, process.env.JWT_SECRET);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'This appeal session has expired. Please sign in again.'
        }
      });
    }

    if (decoded.purpose !== 'account-appeal') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid appeal session'
        }
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.accountStatus !== 'permanently-banned') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'This account is not currently permanently banned'
        }
      });
    }

    const existingPendingAppeal = await AccountAppeal.findOne({
      user: user._id,
      status: 'pending'
    });

    if (existingPendingAppeal) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'You already have a pending appeal under review'
        },
        data: existingPendingAppeal
      });
    }

    const appeal = await AccountAppeal.create({
      user: user._id,
      banReason: user.permanentBanReason,
      bannedAt: user.permanentlyBannedAt,
      appealReason: String(reason).trim(),
      evidence: String(evidence || '').trim()
    });

    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(
      admins.map((admin) => webSocketManager.sendNotification(admin._id, {
        recipient: admin._id,
        type: 'comment',
        from: user._id,
        contentId: null,
        contentType: null,
        message: `${user.username} submitted an account appeal for admin review.`
      }))
    );

    return res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully',
      data: appeal
    });
  } catch (error) {
    console.error('Submit account appeal error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

// Logout (client-side token removal)
export function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
}
