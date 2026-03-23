const express = require('express');
const { getMyPosts } = require('../controllers/post.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// GET /api/users/me/posts - list the logged-in user's own posts
router.get('/me/posts', protect, getMyPosts);

module.exports = router;
