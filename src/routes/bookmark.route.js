const express = require('express');
const {
  createBookmark,
  deleteBookmark,
  getMyBookmarks,
} = require('../controllers/bookmark.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/posts/:id/bookmark - bookmark an approved post
router.post('/posts/:id/bookmark', protect, createBookmark);

// DELETE /api/posts/:id/bookmark - remove bookmark from an approved post
router.delete('/posts/:id/bookmark', protect, deleteBookmark);

// GET /api/users/me/bookmarks - list current user's bookmarks
router.get('/users/me/bookmarks', protect, getMyBookmarks);

module.exports = router;