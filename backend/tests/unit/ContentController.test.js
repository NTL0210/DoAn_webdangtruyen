import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStory,
  createArtwork,
  getContent,
  toggleLike,
  toggleBookmark,
  deleteContent
} from '../../controllers/ContentController.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';
import User from '../../models/User.js';

// Mock dependencies
vi.mock('../../utils/hashtags.js', () => ({
  parseTagsInput: vi.fn().mockReturnValue({ tags: ['tag1'] })
}));
vi.mock('../../utils/savedContent.js');
vi.mock('../../models/Story.js', () => {
  class MockStory {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockImplementation(() => {
        this._id = 'storyId';
        return Promise.resolve(this);
      });
      this.populate = vi.fn().mockResolvedValue(this);
    }
  }
  MockStory.findById = vi.fn().mockReturnValue({
    populate: vi.fn().mockResolvedValue({
      _id: 'contentId',
      title: 'Test Story',
      status: 'approved',
      author: { username: 'author' },
      views: 0,
      save: vi.fn().mockResolvedValue()
    })
  });
  MockStory.findByIdAndUpdate = vi.fn();
  MockStory.findByIdAndDelete = vi.fn();
  MockStory.find = vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([])
    })
  });
  MockStory.countDocuments = vi.fn();
  return {
    __esModule: true,
    default: MockStory
  };
});
vi.mock('../../models/Artwork.js', () => {
  class MockArtwork {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockImplementation(() => {
        this._id = 'artworkId';
        return Promise.resolve(this);
      });
    }
  }
  MockArtwork.findById = vi.fn();
  MockArtwork.findByIdAndUpdate = vi.fn();
  MockArtwork.findByIdAndDelete = vi.fn();
  MockArtwork.find = vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([])
    })
  });
  MockArtwork.countDocuments = vi.fn();
  return {
    __esModule: true,
    default: MockArtwork
  };
});
vi.mock('../../models/User.js', () => {
  const mockUser = {
    _id: 'userId',
    likes: [],
    bookmarks: []
  };
  mockUser.save = vi.fn().mockResolvedValue(mockUser);
  const mockUpdateQuery = {
    select: vi.fn().mockResolvedValue(mockUser)
  };
  return {
    default: {
      findById: vi.fn().mockResolvedValue(mockUser),
      countDocuments: vi.fn(),
      updateMany: vi.fn(),
      findByIdAndUpdate: vi.fn().mockReturnValue(mockUpdateQuery)
    }
  };
});
vi.mock('../../models/Notification.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([])
    }),
    create: vi.fn()
  }
}));
vi.mock('../../services/cacheStore.js');
vi.mock('../../utils/savedContent.js');
vi.mock('../../websocket/WebSocketManager.js');

describe('ContentController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { userId: 'userId' }, query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('createStory', () => {
    it('should create story successfully', async () => {
      req.body = {
        title: 'Test Story',
        description: 'Description',
        content: 'This is a longer content for the story to pass validation. It needs to be long enough to pass the validation check in the controller.',
        tags: ['tag1'],
        status: 'draft'
      };
      Story.prototype.save = vi.fn().mockResolvedValue({
        _id: 'storyId',
        title: 'Test Story'
      });

      await createStory(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Story created successfully',
        data: expect.objectContaining({ _id: 'storyId', title: 'Test Story' })
      });
    });
  });

  describe('createArtwork', () => {
    it('should create artwork successfully', async () => {
      req.body = {
        title: 'Test Artwork',
        description: 'Description',
        content: 'This is a longer content for the artwork to pass validation. It needs to be long enough to pass the validation check in the controller.',
        tags: ['tag1'],
        status: 'draft',
        images: ['image1.jpg']
      };
      Artwork.prototype.save = vi.fn().mockResolvedValue({
        _id: 'artworkId',
        title: 'Test Artwork'
      });

      await createArtwork(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Artwork created successfully',
        data: expect.objectContaining({ _id: 'artworkId', title: 'Test Artwork' })
      });
    });
  });

  describe('getContent', () => {
    it('should get content successfully', async () => {
      req.params = { id: 'contentId' };
      Story.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: 'contentId',
          title: 'Test Story',
          status: 'approved',
          author: { username: 'author' },
          views: 0,
          save: vi.fn().mockResolvedValue()
        })
      });
      User.findById.mockResolvedValue({ username: 'author' });

      await getContent(req, res);

      expect(Story.findById).toHaveBeenCalledWith('contentId');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('toggleLike', () => {
    it('should toggle like successfully', async () => {
      req.params = { id: 'contentId' };
      Story.findById.mockResolvedValue({
        _id: 'contentId',
        likes: 0,
        save: vi.fn().mockResolvedValue(),
        populate: vi.fn().mockResolvedValue()
      });
      User.findById.mockResolvedValue({
        _id: 'userId',
        likes: [],
        bookmarks: [],
        save: vi.fn().mockResolvedValue()
      });

      await toggleLike(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
  });

  describe('toggleBookmark', () => {
    it('should toggle bookmark successfully', async () => {
      req.params = { id: 'contentId' };
      Story.findById.mockResolvedValue({
        _id: 'contentId',
        bookmarks: [],
        save: vi.fn().mockResolvedValue(),
        populate: vi.fn().mockReturnThis()
      });
      User.findById.mockResolvedValue({
        _id: 'userId',
        likes: [],
        bookmarks: [],
        save: vi.fn().mockResolvedValue()
      });

      await toggleBookmark(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      req.params = { contentId: 'contentId', contentType: 'Story' };
      Story.findById.mockResolvedValue({
        _id: 'contentId',
        author: 'userId',
        save: vi.fn()
      });

      await deleteContent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Content deleted successfully'
      });
    });
  });
});