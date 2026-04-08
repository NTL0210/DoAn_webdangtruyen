import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dismissReports,
  banContent,
  banUser,
  getReports
} from '../../controllers/ModerationController.js';
import Report from '../../models/Report.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';
import User from '../../models/User.js';
import webSocketManager from '../../websocket/WebSocketManager.js';

// Mock dependencies
vi.mock('../../models/Report.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    }),
    findOneAndUpdate: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    aggregate: vi.fn()
  }
}));
vi.mock('../../models/ModerationCase.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue([])
      })
    }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    findByIdAndUpdate: vi.fn()
  }
}));
vi.mock('../../models/Story.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([
        { _id: 'contentId', title: 'Test Story', author: { username: 'author' } }
      ])
    }),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn()
  }
}));
vi.mock('../../models/Artwork.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([])
    }),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn()
  }
}));
vi.mock('../../models/User.js', () => ({
  __esModule: true,
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateMany: vi.fn()
  }
}));
vi.mock('../../websocket/WebSocketManager.js', () => ({
  __esModule: true,
  default: {
    sendNotification: vi.fn()
  }
}));

describe('ModerationController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { userId: 'userId', role: 'admin' }, query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('dismissReports', () => {
    it('should dismiss reports successfully', async () => {
      req.params = { id: '507f1f77bcf86cd799439011' };
      req.query = { type: 'story' };
      Report.find.mockResolvedValue([
        { _id: 'reportId', status: 'pending', save: vi.fn() }
      ]);
      Story.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        status: 'approved',
        save: vi.fn()
      });

      await dismissReports(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reports dismissed successfully',
        data: {
          content: {
            _id: '507f1f77bcf86cd799439011',
            status: 'approved',
            save: expect.any(Function)
          },
          removedReports: 1
        }
      });
    });
  });

  describe('banContent', () => {
    it('should ban content successfully', async () => {
      req.params = { id: '507f1f77bcf86cd799439011' };
      req.query = { type: 'story' };
      req.body = { reason: 'Violation' };
      Report.find.mockResolvedValue([
        { _id: 'reportId', status: 'pending', save: vi.fn() }
      ]);
      Story.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        status: 'approved',
        save: vi.fn()
      });

      await banContent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Post banned successfully',
        data: {
          content: {
            _id: '507f1f77bcf86cd799439011',
            status: 'deleted',
            save: expect.any(Function)
          },
          removedReports: 1,
          postingRestrictedUntil: null,
          postingRestrictionReason: 'Violation'
        }
      });
    });
  });

  describe('banUser', () => {
    it('should ban user successfully', async () => {
      req.params = { id: 'targetUserId' };
      req.body = { reason: 'Violation', duration: 7 };
      User.findById.mockResolvedValue({
        _id: 'targetUserId',
        accountStatus: 'active',
        save: vi.fn()
      });

      await banUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User suspended successfully',
        data: {
          _id: 'targetUserId',
          isPostingRestricted: true,
          postingRestrictedUntil: expect.any(Date),
          postingRestrictionReason: 'Violation',
          postingRestrictionSource: 'account-ban'
        }
      });
    });
  });

  describe('getReports', () => {
    it('should get reports successfully', async () => {
      // Return empty arrays so Story.find is not called
      Report.aggregate.mockResolvedValueOnce([]);
      Report.aggregate.mockResolvedValueOnce([]);

      await getReports(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'Reported posts loaded successfully'
      });
    });
  });
});