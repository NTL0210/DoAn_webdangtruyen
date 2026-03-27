const express = require('express');
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} = require('../controllers/follow.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// POST /api/users/:id/follow - follow a user
router.post('/users/:id/follow', protect, followUser);

// DELETE /api/users/:id/follow - unfollow a user
router.delete('/users/:id/follow', protect, unfollowUser);

// GET /api/users/:id/followers - list the user's followers
router.get('/users/:id/followers', getFollowers);

// GET /api/users/:id/following - list the users they follow
router.get('/users/:id/following', getFollowing);

module.exports = router;