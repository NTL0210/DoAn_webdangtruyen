const express = require('express');
const {
  createPost,
  getPublicPosts,
  getPostById,
  updatePost,
  deletePost,
  submitPostForReview,
} = require('../controllers/post.controller');
const { protect, optionalProtect } = require('../middlewares/auth.middleware');
const { validatePostId, loadPost, requirePostOwner } = require('../middlewares/post.middleware');

const router = express.Router();

// POST /api/posts - create a new post (logged-in users only)
router.post('/', protect, createPost);

// GET /api/posts - public feed (approved posts only)
router.get('/', getPublicPosts);

// GET /api/posts/:id - public for approved posts, private for owner
// protect is optional here: if no token is sent, the request still works for approved posts.
router.get('/:id', optionalProtect, validatePostId, loadPost, getPostById);

// PUT /api/posts/:id - only the owner can edit
router.put('/:id', protect, validatePostId, loadPost, requirePostOwner, updatePost);

// POST /api/posts/:id/submit - owner submits draft/rejected post for review
router.post('/:id/submit', protect, validatePostId, loadPost, requirePostOwner, submitPostForReview);

// DELETE /api/posts/:id - only the owner can soft-delete
router.delete('/:id', protect, validatePostId, loadPost, requirePostOwner, deletePost);

module.exports = router;
