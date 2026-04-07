import express from 'express';
import { register, login, logout, submitAccountAppeal } from '../controllers/AuthController.js';
import { rateLimitAuth } from '../middleware/rateLimit.js';
import { validateRegistration } from '../middleware/validation.js';

const router = express.Router();

// POST /api/auth/register - Register new user
router.post('/register', rateLimitAuth, validateRegistration, register);

// POST /api/auth/login - Login user
router.post('/login', rateLimitAuth, login);

// POST /api/auth/logout - Logout user (client-side token removal)
router.post('/logout', logout);

// POST /api/auth/account-appeals - Submit an appeal for a permanently banned account
router.post('/account-appeals', rateLimitAuth, submitAccountAppeal);

export default router;
