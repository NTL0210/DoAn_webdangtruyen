import Notification from '../models/Notification.js';

function parseBooleanQuery(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true';
}

function buildNotificationQuery(req) {
  const query = { recipient: req.user.userId };

  if (parseBooleanQuery(req.query.unreadOnly)) {
    query.read = false;
  }

  if (req.query.since) {
    const sinceDate = new Date(req.query.since);

    if (!Number.isNaN(sinceDate.getTime())) {
      query.createdAt = { $gt: sinceDate };
    }
  }

  return query;
}

export async function getNotificationSummary(req, res) {
  try {
    const [unreadCount, latestNotification] = await Promise.all([
      Notification.countDocuments({ recipient: req.user.userId, read: false }),
      Notification.findOne({ recipient: req.user.userId })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        unreadCount,
        latestCreatedAt: latestNotification?.createdAt || null
      }
    });
  } catch (error) {
    console.error('Get notification summary error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

// Get user's notifications
export async function getNotifications(req, res) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 50);
    const notifications = await Notification.find(buildNotificationQuery(req))
      .select('recipient type from contentId commentId commentPreview commentDeleted contentType contentTitle contentDeleted message read createdAt')
      .populate('from', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        limit,
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

// Mark notification as read
export async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}

export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user.userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found'
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      data: {
        _id: notification._id,
        read: notification.read
      }
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
}
