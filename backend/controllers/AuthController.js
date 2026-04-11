import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import { sendSms } from '../services/smsService.js';
import { createOtpForUser, verifyOtpForUser } from '../services/otpService.js';
import Phone from '../models/Phone.js';
import AccountAppeal from '../models/AccountAppeal.js';
import webSocketManager from '../websocket/WebSocketManager.js';
import { clearExpiredPostingRestriction, getPermanentBanDeletionDeadline, serializePermanentBan, serializePostingRestriction } from '../utils/moderation.js';
import { pruneUserSavedContentReferences } from '../utils/savedContent.js';
import { sanitizeUserText } from '../utils/textSanitizer.js';

function signAppealToken(userId) {
  return jwt.sign(
    { userId, purpose: 'account-appeal' },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

function signLoginOtpToken(userId, email) {
  return jwt.sign(
    { userId, email, purpose: 'login-otp' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function maskEmailAddress(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const [localPart, domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return '***';
  }

  if (localPart.length <= 3) {
    return `${'*'.repeat(localPart.length)}@${domain}`;
  }

  return `${'*'.repeat(localPart.length - 3)}${localPart.slice(-3)}@${domain}`;
}

function normalizeOtpCode(code) {
  return String(code || '').replace(/\D/g, '');
}

function validateOtpCodeLength(code, field = 'code') {
  const normalizedCode = normalizeOtpCode(code);

  if (normalizedCode.length !== 6) {
    return {
      ok: false,
      response: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'OTP code must contain exactly 6 digits',
          field
        }
      }
    };
  }

  return {
    ok: true,
    code: normalizedCode
  };
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

async function buildAuthenticatedLoginData(user) {
  const loginNotice = buildPendingLoginNotice(user);
  const sanitizedCollections = await pruneUserSavedContentReferences(user);
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const userPayload = {
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
    twoFactorEnabled: user.twoFactorEnabled === true,
    ...serializePostingRestriction(user)
  };

  if (loginNotice) {
    user.pendingLoginNoticeType = null;
    user.pendingLoginNoticeTitle = '';
    user.pendingLoginNoticeMessage = '';
    await user.save();
  }

  return {
    token,
    user: userPayload,
    loginNotice
  };
}

async function sendLoginOtpEmail(user) {
  const { code } = await createOtpForUser(user._id, 'login');
  const subject = 'Your login verification code';
  const text = `Your login verification code is: ${code}. It expires in 15 minutes.`;
  const html = `<p>Your login verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
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

    // Create verification OTP and send to user's email
    try {
      const { code } = await createOtpForUser(user._id, 'verify');
      const subject = 'Verify your email';
      const text = `Your verification code is: ${code}. It expires in 15 minutes.`;
      const html = `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;

      await sendEmail({ to: user.email, subject, text, html });
    } catch (emailError) {
      // Log error but allow registration to succeed
      console.error('[auth] Failed to send verification email:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'User registered successfully. A verification code was sent to your email.',
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

// Resend verification OTP
export async function resendVerificationOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required', field: 'email' } });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists
      return res.status(200).json({ success: true, message: 'If an account exists, a verification code was sent.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_VERIFIED', message: 'Email is already verified' } });
    }

    const { code } = await createOtpForUser(user._id, 'verify');
    const subject = 'Verify your email';
    const text = `Your verification code is: ${code}. It expires in 15 minutes.`;
    const html = `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;

    try {
      await sendEmail({ to: user.email, subject, text, html });
    } catch (emailError) {
      console.error('[auth] Failed to send verification email:', emailError);
    }

    return res.status(200).json({ success: true, message: 'Verification code sent if the email exists.' });
  } catch (error) {
    console.error('resendVerificationOtp error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
}

// Resend phone verification OTP (by phone number)
export async function resendPhoneVerification(req, res) {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'phoneNumber is required', field: 'phoneNumber' } });
    }

    const normalized = String(phoneNumber).replace(/[^+\d]/g, '');
    const user = await User.findOne({ phoneNumber: normalized });

    if (!user) {
      // Don't reveal existence
      return res.status(200).json({ success: true, message: 'If an account exists, a verification code was sent.' });
    }

    const { code } = await createOtpForUser(user._id, 'verify');
    const message = `Your verification code is: ${code}. It expires in 15 minutes.`;

    try {
      await sendSms({ to: normalized, body: message });
    } catch (smsError) {
      console.error('[auth] Failed to send verification SMS:', smsError);
    }

    return res.status(200).json({ success: true, message: 'Verification code sent if the phone exists.' });
  } catch (error) {
    console.error('resendPhoneVerification error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
}

// Verify phone OTP
export async function verifyPhoneOtp(req, res) {
  try {
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'phoneNumber and code are required' } });
    }

    const normalized = String(phoneNumber).replace(/[^+\d]/g, '');
    const user = await User.findOne({ phoneNumber: normalized });

    if (!user) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid phone number or code' } });
    }

    const otpValidation = validateOtpCodeLength(code);
    if (!otpValidation.ok) {
      return res.status(400).json(otpValidation.response);
    }

    const ok = await verifyOtpForUser(user._id, 'verify', otpValidation.code);
    if (!ok) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid or expired verification code' } });
    }

    user.phoneVerified = true;
    await user.save();

    // mark phone history as verified
    try {
      await Phone.updateMany({ user: user._id, normalized }, { $set: { verified: true } });
    } catch (e) {
      // ignore
    }

    return res.status(200).json({ success: true, message: 'Phone verified successfully' });
  } catch (error) {
    console.error('verifyPhoneOtp error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
}

// Verify email with OTP
export async function verifyEmailOtp(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and code are required' } });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid email or code' } });
    }

    const otpValidation = validateOtpCodeLength(code);
    if (!otpValidation.ok) {
      return res.status(400).json(otpValidation.response);
    }

    const ok = await verifyOtpForUser(user._id, 'verify', otpValidation.code);
    if (!ok) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid or expired verification code' } });
    }

    user.isVerified = true;
    await user.save();

    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('verifyEmailOtp error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
}

// Request password reset (send OTP)
export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Always return success to avoid leaking account existence
      return res.status(200).json({ success: true, message: 'If an account exists, a reset code was sent.' });
    }

    const { code } = await createOtpForUser(user._id, 'reset');
    const subject = 'Password reset code';
    const text = `Your password reset code is: ${code}. It expires in 15 minutes.`;
    const html = `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`;

    try {
      await sendEmail({ to: user.email, subject, text, html });
    } catch (emailError) {
      console.error('[auth] Failed to send password reset email:', emailError);
    }

    return res.status(200).json({ success: true, message: 'If an account exists, a reset code was sent.' });
  } catch (error) {
    console.error('requestPasswordReset error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
}

// Reset password using OTP
export async function resetPasswordWithOtp(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email, code and newPassword are required' } });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters long', field: 'newPassword' } });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid email or code' } });
    }

    const otpValidation = validateOtpCodeLength(code);
    if (!otpValidation.ok) {
      return res.status(400).json(otpValidation.response);
    }

    const ok = await verifyOtpForUser(user._id, 'reset', otpValidation.code);
    if (!ok) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid or expired reset code' } });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('resetPasswordWithOtp error:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
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

      const permanentBanState = serializePermanentBan(user);
      const canSubmitAppeal = !latestAppeal || latestAppeal.status !== 'pending';

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
          permanentDeletionScheduledFor: permanentBanState.permanentDeletionScheduledFor,
          permanentDeletionMillisecondsRemaining: permanentBanState.permanentDeletionMillisecondsRemaining,
          permanentDeletionDaysRemaining: permanentBanState.permanentDeletionDaysRemaining,
          isPermanentDeletionOverdue: permanentBanState.isPermanentDeletionOverdue,
          canSubmitAppeal: canSubmitAppeal && !permanentBanState.isPermanentDeletionOverdue,
          appealToken: signAppealToken(user._id),
          latestAppeal
        }
      });
    }

    const loginNotice = buildPendingLoginNotice(user);
    if (user.twoFactorEnabled === true && user.email) {
      try {
        await sendLoginOtpEmail(user);
      } catch (emailError) {
        console.error('[auth] Failed to send login OTP email:', emailError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'OTP_DELIVERY_FAILED',
            message: 'Unable to send the login verification code right now. Please try again.'
          }
        });
      }

      return res.status(202).json({
        success: true,
        message: 'OTP sent to your email',
        data: {
          requiresTwoFactor: true,
          deliveryMethod: 'email',
          maskedEmail: maskEmailAddress(user.email),
          loginToken: signLoginOtpToken(user._id, user.email),
          expiresInMinutes: 15,
          loginNotice
        }
      });
    }

    const responsePayload = await buildAuthenticatedLoginData(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: responsePayload
    });
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

export async function verifyLoginOtp(req, res) {
  try {
    const { loginToken, code } = req.body;

    if (!loginToken || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'loginToken and code are required'
        }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(loginToken, process.env.JWT_SECRET);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Your login verification session has expired. Please sign in again.'
        }
      });
    }

    if (decoded.purpose !== 'login-otp') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid login verification session'
        }
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.email !== decoded.email) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'This login verification session is no longer valid.'
        }
      });
    }

    await clearExpiredPostingRestriction(user);

    if (user.accountStatus === 'permanently-banned') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED_PERMANENT',
          message: `This account has been permanently banned. Reason: ${user.permanentBanReason}`
        }
      });
    }

    if (user.twoFactorEnabled !== true || !user.email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TWO_FACTOR_NOT_ENABLED',
          message: 'Two-factor verification is not active for this account.'
        }
      });
    }

    const otpValidation = validateOtpCodeLength(code);
    if (!otpValidation.ok) {
      return res.status(400).json(otpValidation.response);
    }

    const ok = await verifyOtpForUser(user._id, 'login', otpValidation.code);
    if (!ok) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid or expired login verification code'
        }
      });
    }

    const responsePayload = await buildAuthenticatedLoginData(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: responsePayload
    });
  } catch (error) {
    console.error('verifyLoginOtp error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

export async function resendLoginOtp(req, res) {
  try {
    const { loginToken } = req.body;

    if (!loginToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'loginToken is required'
        }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(loginToken, process.env.JWT_SECRET);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Your login verification session has expired. Please sign in again.'
        }
      });
    }

    if (decoded.purpose !== 'login-otp') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid login verification session'
        }
      });
    }

    const user = await User.findById(decoded.userId).select('email twoFactorEnabled');

    if (!user || user.email !== decoded.email || user.twoFactorEnabled !== true) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'This login verification session is no longer valid.'
        }
      });
    }

    try {
      await sendLoginOtpEmail(user);
    } catch (emailError) {
      console.error('[auth] Failed to resend login OTP email:', emailError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'OTP_DELIVERY_FAILED',
          message: 'Unable to resend the login verification code right now. Please try again.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        maskedEmail: maskEmailAddress(user.email),
        deliveryMethod: 'email',
        expiresInMinutes: 15
      }
    });
  } catch (error) {
    console.error('resendLoginOtp error:', error);
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
    const normalizedReason = sanitizeUserText(reason, { preserveLineBreaks: true });
    const normalizedEvidence = sanitizeUserText(evidence, { preserveLineBreaks: true });

    if (!appealToken || !normalizedReason) {
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

    const deletionDeadline = getPermanentBanDeletionDeadline(user);
    if (deletionDeadline && deletionDeadline <= new Date()) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'APPEAL_WINDOW_EXPIRED',
          message: 'The 5-day appeal window has expired for this account.'
        },
        data: {
          permanentDeletionScheduledFor: deletionDeadline
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
      appealReason: normalizedReason,
      evidence: normalizedEvidence
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
