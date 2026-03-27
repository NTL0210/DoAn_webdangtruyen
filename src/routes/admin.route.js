const express = require('express');
const {
  getPendingPosts,
  approvePost,
  rejectPost,
} = require('../controllers/moderation.controller');
const { protect, requireModeratorOrAdmin } = require('../middlewares/auth.middleware');
const { validatePostId, loadPost } = require('../middlewares/post.middleware');

const router = express.Router();

// All admin/moderation routes require login + moderator/admin role.
router.use(protect, requireModeratorOrAdmin);

// GET /api/admin/posts/pending
router.get('/posts/pending', getPendingPosts);

// PATCH /api/admin/posts/:id/approve
router.patch('/posts/:id/approve', validatePostId, loadPost, approvePost);

// PATCH /api/admin/posts/:id/reject
router.patch('/posts/:id/reject', validatePostId, loadPost, rejectPost);

module.exports = router;
