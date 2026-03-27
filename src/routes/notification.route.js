const express = require('express');
const {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// All notification endpoints belong to the logged-in user.
router.get('/notifications', protect, getMyNotifications);
router.patch('/notifications/read-all', protect, markAllNotificationsAsRead);
router.patch('/notifications/:id/read', protect, markNotificationAsRead);

module.exports = router;