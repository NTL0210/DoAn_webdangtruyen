const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

// ── Helper: Sign a JWT for a given user ID ───────────────────────────────────
const signToken = (userId) => {
  return jwt.sign(
    { id: userId },   // payload — keep it minimal; don't store sensitive data
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
};

// ── Helper: Send token + user profile in one response ───────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: user.toPublicProfile(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { username, email, password, displayName } = req.body;
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  // 1. Validate that required fields are present
  if (!normalizedUsername || !normalizedEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'username, email, and password are required.',
    });
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  // 2. Check for existing username or email (case-insensitive email handled
  //    by the model's lowercase: true option)
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });

  if (existingUser) {
    const field = existingUser.email === normalizedEmail ? 'email' : 'username';
    return res.status(409).json({
      success: false,
      message: `An account with that ${field} already exists.`,
    });
  }

  // 3. Create the user — password is hashed automatically by the pre-save hook
  const user = await User.create({
    username: normalizedUsername,
    email: normalizedEmail,
    password,
    // Use username as display name if not provided
    displayName: displayName || normalizedUsername,
  });

  // 4. Respond with JWT + public profile
  sendTokenResponse(user, 201, res);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  // "identifier" accepts either an email address or a username

  // 1. Validate input
  if (!normalizedIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your email/username and password.',
    });
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  // 2. Find the user by email or username
  //    We use select('+password') because the password field has select: false
  //    in the schema — it's excluded from queries by default.
  const isEmail = normalizedIdentifier.includes('@');
  const query = isEmail
    ? { email: normalizedIdentifier.toLowerCase() }
    : { username: normalizedIdentifier };

  const user = await User.findOne(query).select('+password');

  if (!user) {
    // Use a vague message to avoid revealing whether the account exists
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials.',
    });
  }

  // 3. Compare the provided password with the stored hash
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials.',
    });
  }

  // 4. Credentials are valid — issue a JWT
  sendTokenResponse(user, 200, res);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware — it's always a full user document
  res.status(200).json({
    success: true,
    user: req.user.toPublicProfile(),
  });
});

module.exports = { register, login, getMe };
