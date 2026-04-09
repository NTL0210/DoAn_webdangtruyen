import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createComment, deleteComment, getComments } from '../../controllers/CommentController.js';
import Comment from '../../models/Comment.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';
import Notification from '../../models/Notification.js';
import webSocketManager from '../../websocket/WebSocketManager.js';

// ===== MOCK =====
vi.mock('../../models/Comment.js', () => {
  class MockComment {
    constructor(data) {
      Object.assign(this, data);
      this._id = 'commentId';
      this.save = vi.fn().mockResolvedValue(this);
      this.populate = vi.fn().mockResolvedValue(this);
      this.toObject = vi.fn().mockReturnValue(this);
    }
  }

  MockComment.findById = vi.fn();
  MockComment.findByIdAndDelete = vi.fn();
  MockComment.find = vi.fn();

  return { default: MockComment };
});

vi.mock('../../models/Story.js', () => ({
  default: {
    findById: vi.fn()
  }
}));

vi.mock('../../models/Artwork.js', () => ({
  default: {
    findById: vi.fn()
  }
}));

vi.mock('../../models/Notification.js', () => ({
  default: {
    find: vi.fn()
  }
}));

vi.mock('../../websocket/WebSocketManager.js', () => ({
  default: {
    sendNotification: vi.fn(),
    sendNotificationUpdate: vi.fn(),
    broadcastCommentCreated: vi.fn(),
    broadcastCommentDeleted: vi.fn()
  }
}));

describe('CommentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: 'userId' }
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    vi.clearAllMocks();
  });

  // ================= CREATE =================
  describe('createComment', () => {
    it('should create comment successfully', async () => {
      req.params = { id: 'contentId' };
      req.query = { type: 'story' };
      req.body = { text: 'Comment text' };

      Story.findById.mockResolvedValue({
        _id: 'contentId',
        status: 'approved',
        author: 'ownerId',
        title: 'Test Story'
      });

      await createComment(req, res);

      expect(Story.findById).toHaveBeenCalledWith('contentId');

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Comment created successfully',
          data: expect.objectContaining({
            _id: 'commentId',
            text: 'Comment text',
            user: 'userId'
          })
        })
      );
    });

    it('should return 403 if content not approved', async () => {
      req.params = { id: 'contentId' };
      req.query = { type: 'story' };
      req.body = { text: 'Comment text' };

      Story.findById.mockResolvedValue({
        _id: 'contentId',
        status: 'pending'
      });

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 if content not found', async () => {
      req.params = { id: 'contentId' };
      req.query = { type: 'story' };
      req.body = { text: 'Comment text' };

      Story.findById.mockResolvedValue(null);

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ================= DELETE =================
  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      req.params = { id: 'commentId' };

      Comment.findById.mockResolvedValue({
        _id: 'commentId',
        user: { toString: () => 'userId' },
        contentId: 'contentId'
      });

      Notification.find.mockReturnValue({
        populate: vi.fn().mockResolvedValue([])
      });

      Comment.findByIdAndDelete.mockResolvedValue();

      await deleteComment(req, res);

      expect(Comment.findByIdAndDelete).toHaveBeenCalledWith('commentId');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Comment deleted successfully'
      });
    });

    it('should return 404 if comment not found', async () => {
      req.params = { id: 'commentId' };

      Comment.findById.mockResolvedValue(null);

      await deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not owner', async () => {
      req.params = { id: 'commentId' };

      Comment.findById.mockResolvedValue({
        user: { toString: () => 'otherUser' }
      });

      await deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ================= GET =================
  describe('getComments', () => {
    it('should get comments successfully', async () => {
      req.params = { id: 'contentId' };

      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([
            {
              _id: 'commentId',
              text: 'Comment',
              user: { username: 'user' }
            }
          ])
        })
      });

      await getComments(req, res);

      expect(Comment.find).toHaveBeenCalledWith({ contentId: 'contentId' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            _id: 'commentId',
            text: 'Comment',
            user: { username: 'user' }
          }
        ]
      });
    });
  });
});