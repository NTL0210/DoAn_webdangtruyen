const express = require('express');
const healthRoute = require('./health.route');
const authRoute = require('./auth.route');
const postRoute = require('./post.route');
const userRoute = require('./user.route');
const adminRoute = require('./admin.route');

const router = express.Router();

// Mount routes
router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/posts', postRoute);
router.use('/users', userRoute);
router.use('/admin', adminRoute);

// Add more feature routes here as the project grows:
// router.use('/comics', require('./comic.route'));

module.exports = router;
