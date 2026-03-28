const express = require('express');
const { getMyPosts } = require('../controllers/post.controller');
const { uploadAvatar, updateMyProfile, getPublicUserProfile } = require('../controllers/user.controller');
const { protect, optionalProtect } = require('../middlewares/auth.middleware');
const { avatarUpload } = require('../middlewares/upload.middleware');

const router = express.Router();

// GET  /api/users/me/posts  - list the logged-in user's own posts
router.get('/me/posts', protect, getMyPosts);

// PATCH /api/users/me/avatar - upload or replace the current user's avatar
// avatarUpload handles multer parsing + validation (type, size) before the controller runs
router.patch('/me/avatar', protect, avatarUpload, uploadAvatar);

// PATCH /api/users/me/profile - update displayName and/or bio only
router.patch('/me/profile', protect, updateMyProfile);

// GET /api/users/:id - public profile endpoint
// optionalProtect keeps the route public, but lets us include isFollowing when a valid token is provided.
router.get('/:id', optionalProtect, getPublicUserProfile);

module.exports = router;
