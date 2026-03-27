const express = require('express');
const {
  createComment,
  getPostComments,
  deleteComment,
} = require('../controllers/comment.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/posts/:id/comments - authenticated users can comment
router.post('/posts/:id/comments', protect, createComment);

// GET /api/posts/:id/comments - public list of non-deleted comments
router.get('/posts/:id/comments', getPostComments);

// DELETE /api/comments/:id - only comment owner can soft-delete
router.delete('/comments/:id', protect, deleteComment);

module.exports = router;
