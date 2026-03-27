const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { jwtSecret } = require('../config/env');

/**
 * protect middleware
 *
 * Verifies the JWT sent in the Authorization header.
 * If valid, attaches the user document to req.user and calls next().
 * If invalid or missing, responds with 401 Unauthorized.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      // Differentiate between expired and invalid tokens for clearer messages
      const message =
        err.name === 'TokenExpiredError' ? 'Token has expired. Please log in again.' : 'Invalid token.';
      return res.status(401).json({ success: false, message });
    }

    // 3. Fetch the user from DB to ensure they still exist
    //    (select('+password') is not needed here; password stays hidden by default)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    // 4. Attach user to request so downstream handlers can use it
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * optionalProtect middleware
 *
 * Similar to protect, but does not reject the request when no token is sent.
 * This is useful for routes that are public, but provide extra access to the owner.
 */
const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id);

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * restrictTo(...roles) middleware factory
 *
 * Use after protect to limit access to specific roles.
 * Example: router.delete('/users/:id', protect, restrictTo('admin'), deleteUser)
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }
    next();
  };
};

/**
 * requireModeratorOrAdmin middleware
 *
 * Convenience middleware for moderation endpoints.
 * Allows only users with role "moderator" or "admin".
 */
const requireModeratorOrAdmin = restrictTo('moderator', 'admin');

module.exports = { protect, optionalProtect, restrictTo, requireModeratorOrAdmin };
