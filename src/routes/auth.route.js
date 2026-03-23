const express = require('express');
const { register, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/auth/register — create a new account
router.post('/register', register);

// POST /api/auth/login — sign in with email/username + password
router.post('/login', login);

// GET /api/auth/me — get the currently authenticated user's profile
// protect runs first; if the token is invalid it stops here and returns 401
router.get('/me', protect, getMe);

module.exports = router;
