import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import Notification from '../models/Notification.js';
import AccountAppeal from '../models/AccountAppeal.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { serializePermanentBan, serializePostingRestriction } from '../utils/moderation.js';
import { pruneUserSavedContentReferences } from '../utils/savedContent.js';

class WebSocketManager {
  constructor() {
    this.connections = new Map(); // userId -> Set<WebSocket>
    this.contentSubscriptions = new Map(); // contentId -> Set<WebSocket>
  }

  // Initialize WebSocket server
  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/notifications' });

    this.wss.on('connection', (ws, req) => {
      // Extract token from query string
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      try {
        // Verify JWT token
        const decoded = jwt.verify(token, env.jwtSecret);
        const userId = String(decoded.userId);

        ws.userId = userId;
        ws.subscribedContentIds = new Set();

        // Store connection
        this.addConnection(userId, ws);

        this.sendAccountState(userId, { reason: 'connected' }).catch((error) => {
          console.error(`WebSocket account-state bootstrap error for user ${userId}:`, error);
        });

        console.log(`WebSocket connected: User ${userId}`);

        ws.on('message', (rawMessage) => {
          this.handleMessage(ws, rawMessage);
        });

        // Handle disconnect
        ws.on('close', () => {
          this.cleanupSocket(ws);
          console.log(`WebSocket disconnected: User ${userId}`);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error);
        });

      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Invalid token');
      }
    });

    console.log('WebSocket server initialized');
  }

  handleMessage(ws, rawMessage) {
    try {
      const message = JSON.parse(rawMessage.toString());
      const contentId = message?.contentId ? String(message.contentId) : '';

      if (message.type === 'request-account-state') {
        this.sendAccountState(ws.userId, {
          reason: String(message.reason || 'manual')
        }).catch((error) => {
          console.error(`WebSocket account-state refresh error for user ${ws.userId}:`, error);
        });
        return;
      }

      if (!contentId) {
        return;
      }

      if (message.type === 'subscribe-content') {
        this.subscribeToContent(contentId, ws);
      }

      if (message.type === 'unsubscribe-content') {
        this.unsubscribeFromContent(contentId, ws);
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error);
    }
  }

  // Add connection
  addConnection(userId, ws) {
    const normalizedUserId = String(userId);
    const activeConnections = this.connections.get(normalizedUserId) || new Set();
    activeConnections.add(ws);
    this.connections.set(normalizedUserId, activeConnections);
  }

  cleanupSocket(ws) {
    this.removeConnection(ws.userId, ws);

    if (ws.subscribedContentIds) {
      for (const contentId of ws.subscribedContentIds) {
        this.unsubscribeFromContent(contentId, ws);
      }
    }
  }

  // Remove connection
  removeConnection(userId, ws) {
    const normalizedUserId = String(userId);
    const activeConnections = this.connections.get(normalizedUserId);

    if (!activeConnections) {
      return;
    }

    activeConnections.delete(ws);

    if (activeConnections.size === 0) {
      this.connections.delete(normalizedUserId);
    }
  }

  subscribeToContent(contentId, ws) {
    const normalizedContentId = String(contentId);
    const subscribers = this.contentSubscriptions.get(normalizedContentId) || new Set();

    subscribers.add(ws);
    ws.subscribedContentIds.add(normalizedContentId);

    this.contentSubscriptions.set(normalizedContentId, subscribers);
  }

  unsubscribeFromContent(contentId, ws) {
    const normalizedContentId = String(contentId);
    const subscribers = this.contentSubscriptions.get(normalizedContentId);

    ws.subscribedContentIds?.delete(normalizedContentId);

    if (!subscribers) {
      return;
    }

    subscribers.delete(ws);

    if (subscribers.size === 0) {
      this.contentSubscriptions.delete(normalizedContentId);
      return;
    }

    this.contentSubscriptions.set(normalizedContentId, subscribers);
  }

  sendPayload(ws, payload) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  sendToUser(userId, payload) {
    const recipients = this.connections.get(String(userId));

    if (!recipients || recipients.size === 0) {
      return;
    }

    recipients.forEach((ws) => {
      this.sendPayload(ws, payload);
    });
  }

  sendToContentSubscribers(contentId, payload) {
    const subscribers = this.contentSubscriptions.get(String(contentId));

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    subscribers.forEach((ws) => {
      this.sendPayload(ws, payload);
    });
  }

  // Send notification to user
  async sendNotification(userId, notificationData) {
    try {
      // Persist notification to database
      const notification = new Notification(notificationData);
      await notification.save();
      await notification.populate('from', 'username avatar');

      // Send via WebSocket if user is connected
      this.sendToUser(userId, {
        type: 'notification',
        data: notification.toObject()
      });

      return notification;
    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  }

  sendNotificationUpdate(userId, notification) {
    this.sendToUser(userId, {
      type: 'notification-updated',
      data: notification
    });
  }

  async buildAccountStateData(userId) {
    const user = await User.findById(userId).select(
      'username email role isVerified avatar bio likes bookmarks favoriteTags accountStatus permanentBanReason permanentlyBannedAt postingRestrictedUntil postingRestrictionReason postingRestrictionSource twoFactorEnabled'
    );

    if (!user) {
      return null;
    }

    const sanitizedCollections = await pruneUserSavedContentReferences(user);
    const postingRestriction = serializePostingRestriction(user);
    const permanentBan = serializePermanentBan(user);
    const latestAppeal = user.accountStatus === 'permanently-banned'
      ? await AccountAppeal.findOne({ user: user._id })
          .sort({ updatedAt: -1, createdAt: -1 })
          .select('status appealReason evidence reviewReason reviewedAt createdAt')
          .lean()
      : null;

    return {
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
        bio: user.bio,
        likes: sanitizedCollections.likes,
        bookmarks: sanitizedCollections.bookmarks,
        favoriteTags: Array.isArray(user.favoriteTags) ? user.favoriteTags : [],
        accountStatus: user.accountStatus,
        permanentBanReason: user.permanentBanReason,
        permanentlyBannedAt: user.permanentlyBannedAt,
        twoFactorEnabled: user.twoFactorEnabled === true,
        ...postingRestriction
      },
      permanentBanReason: user.permanentBanReason,
      permanentlyBannedAt: user.permanentlyBannedAt,
      permanentDeletionScheduledFor: permanentBan.permanentDeletionScheduledFor,
      permanentDeletionMillisecondsRemaining: permanentBan.permanentDeletionMillisecondsRemaining,
      permanentDeletionDaysRemaining: permanentBan.permanentDeletionDaysRemaining,
      isPermanentDeletionOverdue: permanentBan.isPermanentDeletionOverdue,
      canSubmitAppeal: user.accountStatus === 'permanently-banned'
        ? ((!latestAppeal || latestAppeal.status !== 'pending') && !permanentBan.isPermanentDeletionOverdue)
        : false,
      appealToken: user.accountStatus === 'permanently-banned'
        ? jwt.sign(
            { userId: user._id, purpose: 'account-appeal' },
            env.jwtSecret,
            { expiresIn: '30m' }
          )
        : null,
      latestAppeal
    };
  }

  async sendAccountState(userId, options = {}) {
    const data = await this.buildAccountStateData(userId);

    if (!data) {
      return null;
    }

    this.sendToUser(userId, {
      type: 'account-state',
      data: {
        reason: options.reason || 'refresh',
        ...data
      }
    });

    return data;
  }

  broadcastCommentCreated(contentId, comment) {
    this.sendToContentSubscribers(contentId, {
      type: 'comment-created',
      data: {
        contentId: String(contentId),
        comment
      }
    });
  }

  broadcastCommentDeleted(contentId, commentId) {
    this.sendToContentSubscribers(contentId, {
      type: 'comment-deleted',
      data: {
        contentId: String(contentId),
        commentId: String(commentId)
      }
    });
  }
}

// Export singleton instance
const webSocketManager = new WebSocketManager();
export default webSocketManager;
