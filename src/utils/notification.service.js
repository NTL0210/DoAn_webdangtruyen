const Notification = require('../models/notification.model');
const { emitNotificationToUser } = require('../socket/socket');

/**
 * Create a notification unless the sender and recipient are the same user.
 * This keeps controller code small and avoids self-notifications.
 */
const createNotification = async ({ recipient, sender, type, post = null, comment = null, message }) => {
  if (!recipient || !sender) {
    return null;
  }

  if (String(recipient) === String(sender)) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    post,
    comment,
    message,
  });

  // Realtime delivery: still DB-backed first, then emit to user room.
  emitNotificationToUser(recipient, {
    id: notification._id,
    recipient: notification.recipient,
    sender: notification.sender,
    type: notification.type,
    post: notification.post,
    comment: notification.comment,
    message: notification.message,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  });

  return notification;
};

module.exports = { createNotification };