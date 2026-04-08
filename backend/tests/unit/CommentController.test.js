import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createComment, deleteComment, getComments } from '../../controllers/CommentController.js';
import Comment from '../../models/Comment.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import webSocketManager from '../../websocket/WebSocketManager.js';

// Mock dependencies
vi.mock('../../models/Comment.js', () => {
  class MockComment {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
      this.populate = vi.fn().mockReturnValue(this);
      this.toObject = vi.fn().mockReturnValue(this);
      this._id = 'commentId';
    }
  }
  MockComment.findById = vi.fn();
  MockComment.findByIdAndDelete = vi.fn();
  MockComment.find = vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([])
    })
  });
  return { default: MockComment };
});
vi.mock('../../models/Story.js', () => ({
  default: {
    findById: vi.fn().mockResolvedValue({ _id: 'contentId', status: 'approved', author: 'ownerId' }),
    find: vi.fn()
  }
}));
vi.mock('../../models/Artwork.js', () => ({
  default: {
    findById: vi.fn()
  }
}));
vi.mock('../../models/Notification.js', () => ({
  default: {
    create: vi.fn()
  }
}));
vi.mock('../../models/User.js', () => ({
  default: {
    findById: vi.fn()
  }
}));
vi.mock('../../models/Notification.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([])
    })
  }
}));
vi.mock('../../websocket/WebSocketManager.js', () => ({
  default: {
    sendNotification: vi.fn(),
    broadcastCommentCreated: vi.fn(),
    broadcastCommentDeleted: vi.fn()
  }
}));

describe('CommentController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { userId: 'userId' }, query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('createComment', () => {
    it('should create comment successfully', async () => {
      req.body = { contentId: 'contentId', contentType: 'Story', text: 'Comment text' };
      req.params = { id: 'contentId' };
      req.query = { type: 'story' };
      User.findById.mockResolvedValue({ _id: 'ownerId' });
      webSocketManager.sendNotification.mockResolvedValue();

      await createComment(req, res);

      expect(Story.findById).toHaveBeenCalledWith('contentId');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Comment created successfully',
        data: expect.objectContaining({
          _id: 'commentId',
          text: 'Comment text',
          user: 'userId'
        })
      });
    });

    it('should return error if content not approved', async () => {
      req.body = { contentId: 'contentId', contentType: 'Story', text: 'Comment text' };
      req.query = { type: 'story' };
      Story.findById.mockResolvedValue({ status: 'pending' });

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot comment on non-approved content'
        }
      });
    });
  });

  describe('deleteComment', () => {
    it('should delete comment successfully', async () => {
      req.params = { id: 'commentId' };
      Comment.findById.mockResolvedValue({ _id: 'commentId', user: 'userId' });
      Comment.findByIdAndDelete.mockResolvedValue();

      await deleteComment(req, res);

      expect(Comment.findByIdAndDelete).toHaveBeenCalledWith('commentId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Comment deleted successfully'
      });
    });

    it('should return error if comment not found', async () => {
      req.params = { commentId: 'commentId' };
      Comment.findById.mockResolvedValue(null);

      await deleteComment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found'
        }
      });
    });
  });

  describe('getComments', () => {
    it('should get comments successfully', async () => {
      req.params = { id: 'contentId' };
      Comment.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([
            { _id: 'commentId', text: 'Comment', user: { username: 'user' } }
          ])
        })
      });

      await getComments(req, res);

      expect(Comment.find).toHaveBeenCalledWith({ contentId: 'contentId' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { _id: 'commentId', text: 'Comment', user: { username: 'user' } }
        ]
      });
    });
  });
});