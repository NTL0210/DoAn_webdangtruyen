import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNotifications, markAsRead, deleteNotification } from '../../controllers/NotificationController.js';
import Notification from '../../models/Notification.js';

// Mock dependencies
vi.mock('../../models/Notification.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    }),
    findById: vi.fn(),
    findOneAndDelete: vi.fn(),
    findOneAndUpdate: vi.fn()
  }
}));

describe('NotificationController', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, user: { userId: 'userId' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should get notifications successfully', async () => {
      Notification.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { _id: 'notifId', message: 'Test notification' }
            ])
          })
        })
      });

      await getNotifications(req, res);

      expect(Notification.find).toHaveBeenCalledWith({ recipient: 'userId' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: 'notifId', message: 'Test notification' }]
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      req.params = { id: 'notifId' };
      Notification.findOneAndUpdate.mockResolvedValue({
        _id: 'notifId',
        recipient: 'userId',
        read: true
      });

      await markAsRead(req, res);

      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notifId', recipient: 'userId' },
        { read: true },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification marked as read',
        data: {
          _id: 'notifId',
          recipient: 'userId',
          read: true
        }
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      req.params = { id: 'notifId' };
      Notification.findOneAndDelete.mockResolvedValue({
        _id: 'notifId',
        recipient: 'userId'
      });

      await deleteNotification(req, res);

      expect(Notification.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'notifId',
        recipient: 'userId'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification deleted successfully',
        data: {
          _id: 'notifId',
          read: undefined
        }
      });
    });
  });
});