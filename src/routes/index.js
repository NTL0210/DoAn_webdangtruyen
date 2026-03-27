const express = require('express');
const healthRoute = require('./health.route');
const authRoute = require('./auth.route');
const postRoute = require('./post.route');
const userRoute = require('./user.route');
const adminRoute = require('./admin.route');
const tagRoute = require('./tag.route');
const commentRoute = require('./comment.route');
const bookmarkRoute = require('./bookmark.route');
const followRoute = require('./follow.route');
const notificationRoute = require('./notification.route');

const router = express.Router();

// Mount routes
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/posts', postRoute);
router.use('/users', userRoute);
router.use('/admin', adminRoute);
router.use('/tags', tagRoute);
router.use('/', commentRoute);
router.use('/', bookmarkRoute);
router.use('/', followRoute);
router.use('/', notificationRoute);

// Add more feature routes here as the project grows:
// router.use('/comics', require('./comic.route'));

module.exports = router;
