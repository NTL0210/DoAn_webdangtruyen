const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const asyncHandler = require('../utils/asyncHandler');

const formatNotification = (notification) => {
  const item = notification.toObject ? notification.toObject() : notification;

  return {
    id: item._id,
    type: item.type,
    message: item.message,
    isRead: item.isRead,
    readAt: item.readAt,
    createdAt: item.createdAt,
    sender:
      item.sender && typeof item.sender === 'object'
        ? {
            id: item.sender._id,
            username: item.sender.username,
            displayName: item.sender.displayName,
            avatarUrl: item.sender.avatarUrl,
          }
        : item.sender,
    post:
      item.post && typeof item.post === 'object'
        ? {
            id: item.post._id,
            title: item.post.title,
            type: item.post.type,
          }
        : item.post,
    comment:
      item.comment && typeof item.comment === 'object'
        ? {
            id: item.comment._id,
            content: item.comment.content,
          }
        : item.comment,
  };
};

/**
 * GET /api/notifications
 * Return the current user's notifications, newest first.
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate('sender', 'username displayName avatarUrl')
    .populate('post', 'title type')
    .populate('comment', 'content')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: notifications.length,
    notifications: notifications.map(formatNotification),
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark one notification as read.
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notificationId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification id.',
    });
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: req.user._id,
  })
    .populate('sender', 'username displayName avatarUrl')
    .populate('post', 'title type')
    .populate('comment', 'content');

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found.',
    });
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  res.status(200).json({
    success: true,
    message: 'Notification marked as read.',
    notification: formatNotification(notification),
  });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications as read for the current user.
 */
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const now = new Date();

  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: now } }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read.',
    updatedCount: result.modifiedCount,
  });
});

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};