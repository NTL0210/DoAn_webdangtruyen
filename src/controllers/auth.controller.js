const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // built-in Node.js module, no install needed
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

// ── Refresh token constants ───────────────────────────────────────────────────
const REFRESH_COOKIE_NAME    = 'refreshToken';
const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

// ── Helper: Sign a short-lived JWT access token ──────────────────────────────
const signAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },   // payload — keep it minimal; don't store sensitive data
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
};

// ── Helper: Generate a refresh token, persist its SHA-256 hash in the DB ─────
// Returns the plain-text token (sent to the client via cookie).
// Only the hash is stored in the database — the plain token is never persisted.
const issueRefreshToken = async (user) => {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');

  user.refreshTokenHash = hash;
  // validateBeforeSave: false skips validation hooks (e.g. password re-hash)
  await user.save({ validateBeforeSave: false });

  return plainToken;
};

// ── Helper: Set the refresh token as a secure httpOnly cookie ─────────────────
const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,                                  // JS cannot read this cookie
    secure: process.env.NODE_ENV === 'production',   // HTTPS-only in production
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRES_MS,
  });
};

// ── Helper: Send access token + refresh cookie + user profile ────────────────
const sendTokenResponse = async (user, statusCode, res) => {
  const accessToken   = signAccessToken(user._id);
  const refreshToken  = await issueRefreshToken(user);

  setRefreshCookie(res, refreshToken);

  res.status(statusCode).json({
    success: true,
    token: accessToken,   // short-lived access token (use in Authorization header)
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

  // 4. Respond with access token + set refresh token cookie
  await sendTokenResponse(user, 201, res);
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

  // 4. Credentials are valid — issue access token + refresh token cookie
  await sendTokenResponse(user, 200, res);
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (incomingToken) {
    // Hash the cookie value to look up (and delete) the stored hash in the DB
    const hash = crypto.createHash('sha256').update(incomingToken).digest('hex');

    // Remove the token from the database.
    // findOneAndUpdate is safe — if the token is unknown/expired it simply matches nothing.
    await User.findOneAndUpdate(
      { refreshTokenHash: hash },
      { $unset: { refreshTokenHash: '' } }
    );

    // Tell the browser to delete the cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  // Whether or not there was a refresh token, acknowledge the logout.
  // The client is responsible for discarding the access token on their side.
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

module.exports = { register, login, getMe, logout };
