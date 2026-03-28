const express = require('express');
const { register, login, getMe, logout } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/auth/register — create a new account
router.post('/register', register);

// POST /api/auth/login — sign in with email/username + password
router.post('/login', login);

// GET /api/auth/me — get the currently authenticated user's profile
// protect runs first; if the token is invalid it stops here and returns 401
router.get('/me', protect, getMe);

// POST /api/auth/logout — invalidate refresh token and clear cookie
// No auth required — should work even when the access token has expired
router.post('/logout', logout);

module.exports = router;
