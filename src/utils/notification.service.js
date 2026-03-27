const Notification = require('../models/notification.model');

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

  return Notification.create({
    recipient,
    sender,
    type,
    post,
    comment,
    message,
  });
};

module.exports = { createNotification };