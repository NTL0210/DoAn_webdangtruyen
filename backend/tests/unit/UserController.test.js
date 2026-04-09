import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getProfile,
  updateProfile,
  updatePhoneNumber,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updateAvatar,
  getFavoriteTags,
  addFavoriteTag,
  removeFavoriteTag,
  getReadingHistory,
  searchCreators,
  getBookmarkedContent,
  getLikedContent
} from '../../controllers/UserController.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';

// Global helper for creating query mocks with proper chaining
const createQueryMock = (resolveValue) => {
  const query = {};
  query.select = vi.fn().mockReturnValue(query);
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockReturnValue(query);
  query.skip = vi.fn().mockReturnValue(query);
  query.lean = vi.fn().mockReturnValue(query);
  query.exec = vi.fn().mockResolvedValue(resolveValue);
  query.then = function(onFulfilled, onRejected) {
    return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
  };
  query.catch = function(onRejected) {
    return Promise.resolve(resolveValue).catch(onRejected);
  };
  return query;
};

// Mock dependencies
const mockFollowResults = [
  { follower: { _id: 'followerId', username: 'follower' } },
  { following: { _id: 'followingId', username: 'following' } }
];

vi.mock('../../models/User.js', () => {
  return {
    __esModule: true,
    default: {
      findById: vi.fn().mockImplementation((userId) => 
        createQueryMock({
          _id: userId,
          username: 'testuser',
          bio: 'Bio',
          avatar: 'avatar.jpg',
          followers: [],
          following: [],
          favoriteTags: ['tag1', 'tag2'],
          bookmarks: [],
          likes: [],
          readingHistory: [],
          save: vi.fn().mockResolvedValue(this)
        })
      ),
      findOne: vi.fn().mockImplementation(() =>
        createQueryMock({
          _id: 'userId',
          username: 'testuser',
          phone: '+1234567890'
        })
      ),
      findByIdAndUpdate: vi.fn().mockImplementation(() =>
        createQueryMock({ _id: 'userId', username: 'updatedUser' })
      ),
      find: vi.fn().mockImplementation(() =>
        createQueryMock([
          { _id: 'creatorId1', username: 'creator1' },
          { _id: 'creatorId2', username: 'creator2' }
        ])
      ),
      countDocuments: vi.fn().mockResolvedValue(0)
    }
  };
});
vi.mock('../../models/Follow.js', () => {
  class MockFollow {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    }
  }

  MockFollow.findOne = vi.fn().mockImplementation(() =>
    createQueryMock(null)
  );
  MockFollow.find = vi.fn().mockImplementation(() =>
    createQueryMock(mockFollowResults)
  );
  MockFollow.aggregate = vi.fn().mockResolvedValue([]);
  MockFollow.countDocuments = vi.fn().mockResolvedValue(2);
  MockFollow.deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
  MockFollow.findOneAndDelete = vi.fn().mockResolvedValue({ _id: 'followId' });

  return {
    __esModule: true,
    default: MockFollow
  };
});

vi.mock('../../models/Story.js', () => {
  return {
    __esModule: true,
    default: {
      find: vi.fn().mockImplementation(() => createQueryMock([
        { _id: 'storyId1', title: 'Story 1', author: 'userId' },
        { _id: 'storyId2', title: 'Story 2', author: 'userId' }
      ])),
      findById: vi.fn().mockImplementation((id) => createQueryMock({ _id: id, title: 'Story', author: 'userId' })),
      findByIdAndUpdate: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue([]),
      countDocuments: vi.fn().mockResolvedValue(5)
    }
  };
});

vi.mock('../../models/Artwork.js', () => {
  return {
    __esModule: true,
    default: {
      find: vi.fn().mockImplementation(() => createQueryMock([
        { _id: 'artId1', title: 'Art 1', author: 'userId' },
        { _id: 'artId2', title: 'Art 2', author: 'userId' }
      ])),
      findById: vi.fn().mockImplementation((id) => createQueryMock({ _id: id, title: 'Artwork', author: 'userId' })),
      findByIdAndUpdate: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue([]),
      countDocuments: vi.fn().mockResolvedValue(3)
    }
  };
});

vi.mock('../../utils/savedContent.js', () => ({
  pruneUserSavedContentReferences: vi.fn(async (user) => ({
    likes: user.likes || [],
    bookmarks: user.bookmarks || []
  }))
}));
vi.mock('../../utils/hashtags.js', () => ({
  normalizeTagsForQuery: vi.fn((tags) => {
    if (typeof tags === 'string') {
      return [tags];
    }
    return Array.isArray(tags) ? tags : [];
  })
}));
vi.mock('../../utils/search.js', () => ({
  buildSearchNameFields: vi.fn((name) => ({ searchName: name, searchTokens: [name] })),
  escapeRegex: vi.fn((str) => str),
  normalizeSearchText: vi.fn((str) => str?.toLowerCase() || ''),
  tokenizeSearchText: vi.fn((str) => [str]),
  similarityScore: vi.fn(() => 0.9)
}));
vi.mock('../../services/cacheStore.js', () => ({
  CACHE_NAMESPACES: {
    CONTENT_DISCOVERY: 'discovery',
    CREATOR_SEARCH: 'search',
    PUBLIC_PROFILE: 'profile'
  },
  getOrSetNamespacedCache: vi.fn((key, fn) => fn()),
  invalidateCacheNamespaces: vi.fn()
}));
vi.mock('../../services/otpService.js', () => ({
  createOtpForUser: vi.fn().mockResolvedValue({ code: '123456' })
}));
vi.mock('../../services/smsService.js', () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true })
}));
vi.mock('../../models/Phone.js', () => ({
  __esModule: true,
  default: {
    create: vi.fn().mockResolvedValue({ _id: 'phoneId' })
  }
}));
vi.mock('../../websocket/WebSocketManager.js', () => ({
  __esModule: true,
  default: {
    sendNotification: vi.fn()
  }
}));
vi.mock('../../models/Notification.js', () => {
  class MockNotification {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
      this.populate = vi.fn().mockResolvedValue(this);
      this.toObject = vi.fn().mockReturnValue(this);
    }
  }
  return { default: MockNotification };
});

describe('UserController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { userId: 'userId' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    // Reset mock call history without clearing mock implementations
    User.findById.mockClear();
    User.findOne.mockClear();
    User.findByIdAndUpdate.mockClear();
    User.find.mockClear();
    Follow.findOne.mockClear();
    Follow.find.mockClear();
    Follow.findOneAndDelete.mockClear();
    Follow.countDocuments.mockClear();
    Story.find.mockClear();
    Story.findById.mockClear();
    Story.aggregate.mockClear();
    Artwork.find.mockClear();
    Artwork.findById.mockClear();
    Artwork.aggregate.mockClear();
  });

  describe('getProfile', () => {
    it('should get profile successfully', async () => {
      req.params = { id: 'profileUserId' };
      Follow.findOne.mockResolvedValue(null);
      Follow.countDocuments.mockResolvedValue(10);
      Follow.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockResolvedValue([])
      });
      Story.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([])
        })
      });
      Story.countDocuments.mockResolvedValue(5);
      Artwork.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([])
        })
      });
      Artwork.countDocuments.mockResolvedValue(3);

      await getProfile(req, res);

      expect(User.findById).toHaveBeenCalledWith('profileUserId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            _id: 'profileUserId',
            username: 'testuser',
            bio: 'Bio',
            avatar: 'avatar.jpg'
          }),
          isFollowing: false,
          followerCount: 10,
          followingCount: 10,
          content: []
        })
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      req.body = { username: 'newusername', bio: 'New bio' };
      User.findByIdAndUpdate.mockImplementation(() =>
        createQueryMock({ _id: 'userId', username: 'updatedUser' })
      );
      User.findOne.mockImplementation(() => createQueryMock(null));

      await updateProfile(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'userId',
        expect.objectContaining({ username: 'newusername', bio: 'New bio' }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: { _id: 'userId', username: 'updatedUser' }
      });
    });
  });

  describe('followUser', () => {
    it('should follow user successfully', async () => {
      req.params = { id: 'targetUserId' };
      User.findById.mockResolvedValue({ _id: 'targetUserId' });
      Follow.findOne.mockResolvedValue(null);
      Follow.prototype.save = vi.fn().mockResolvedValue();

      await followUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully followed user',
        data: expect.objectContaining({ follower: 'userId', following: 'targetUserId' })
      });
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow user successfully', async () => {
      req.params = { id: 'targetUserId' };
      Follow.findOneAndDelete.mockResolvedValue({ _id: 'followId', follower: 'userId', following: 'targetUserId' });

      await unfollowUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully unfollowed user'
      });
    });
  });

  describe('getFollowers', () => {
    it('should get followers successfully', async () => {
      req.params = { id: 'userId' };
      const mockCleanupQuery = createQueryMock([]);
      const mockListSort = vi.fn().mockResolvedValue(mockFollowResults);
      const mockListQuery = createQueryMock(mockFollowResults);
      mockListQuery.sort = vi.fn().mockResolvedValue(mockFollowResults);
      
      Follow.find
        .mockReturnValueOnce(mockCleanupQuery)
        .mockReturnValueOnce(mockListQuery);

      await getFollowers(req, res);

      expect(Follow.find).toHaveBeenCalledWith({ following: 'userId' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: 'followerId', username: 'follower' }]
      });
    });
  });

  describe('getFavoriteTags', () => {
    it('should get favorite tags successfully', async () => {
      User.findById.mockImplementation(() => createQueryMock({
        _id: 'userId',
        favoriteTags: ['tag1', 'tag2']
      }));

      await getFavoriteTags(req, res);

      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: ['tag1', 'tag2']
      });
    });

    it('should return error if user not found', async () => {
      User.findById.mockImplementation(() => createQueryMock(null));

      await getFavoriteTags(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND'
        })
      });
    });
  });

  describe('addFavoriteTag', () => {
    it('should add favorite tag successfully', async () => {
      req.body = { tag: 'newtag' };
      const mockUserWithFavs = {
        _id: 'userId',
        favoriteTags: ['tag1'],
        save: vi.fn().mockResolvedValue()
      };
      User.findById.mockImplementation(() => createQueryMock(mockUserWithFavs));

      await addFavoriteTag(req, res);

      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(mockUserWithFavs.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error if tag is invalid', async () => {
      req.body = { tag: '' };
      User.findById.mockImplementation(() => createQueryMock({ _id: 'userId', favoriteTags: [] }));

      await addFavoriteTag(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('removeFavoriteTag', () => {
    it('should remove favorite tag successfully', async () => {
      req.params = { tag: 'tag1' };
      const mockUserWithFavs = {
        _id: 'userId',
        favoriteTags: ['tag1', 'tag2'],
        save: vi.fn().mockResolvedValue()
      };
      User.findById.mockImplementation(() => createQueryMock(mockUserWithFavs));

      await removeFavoriteTag(req, res);

      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(mockUserWithFavs.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updatePhoneNumber', () => {
    it('should update phone number successfully', async () => {
      req.body = { phoneNumber: '+84971234567' };
      const mockUpdatedUser = {
        _id: 'userId',
        phoneNumber: '+84971234567',
        phoneVerified: false
      };
      User.findOne.mockImplementation(() => createQueryMock(null));
      User.findByIdAndUpdate.mockImplementation(() =>
        createQueryMock(mockUpdatedUser)
      );

      await updatePhoneNumber(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'userId',
        expect.objectContaining({
          phoneNumber: expect.any(String),
          phoneVerified: false
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Phone updated. Verification code sent.',
        data: mockUpdatedUser
      });
    });

    it('should return error if phone already in use', async () => {
      req.body = { phoneNumber: '+84971234567' };
      User.findOne.mockImplementation(() => createQueryMock({ _id: 'otherUserId' }));

      await updatePhoneNumber(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({ code: 'DUPLICATE_ERROR' })
      });
    });
  });

  describe('searchCreators', () => {
    it('should search creators successfully', async () => {
      req.query = { q: 'test' };
      User.find.mockReturnValue(
        createQueryMock([
          { _id: 'creator1', username: 'testcreator', isVerified: false, createdAt: new Date(), searchName: 'testcreator', searchTokens: ['testcreator'], bio: 'Bio' }
        ])
      );
      Story.aggregate.mockResolvedValue([]);
      Artwork.aggregate.mockResolvedValue([]);
      Follow.aggregate.mockResolvedValue([]);
      Follow.find.mockReturnValue({
        select: vi.fn((field) => {
          if (field === 'following') {
            return createQueryMock([]);
          }
          return { populate: vi.fn().mockResolvedValue([]) };
        })
      });

      await searchCreators(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      req.body = { avatar: 'https://example.com/avatar.jpg' };
      User.findByIdAndUpdate.mockImplementation(() =>
        createQueryMock({
          _id: 'userId',
          avatar: 'https://example.com/avatar.jpg'
        })
      );

      await updateAvatar(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'userId',
        expect.objectContaining({ avatar: 'https://example.com/avatar.jpg' }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getReadingHistory', () => {
    it('should get reading history successfully', async () => {
      req.query = { page: '1', limit: '10' };
      User.findById.mockReturnValue(
        createQueryMock({
          _id: 'userId',
          readingHistory: [
            { contentType: 'Story', contentId: 'storyId1', readAt: new Date() }
          ]
        })
      );
      Story.find.mockReturnValue(
        createQueryMock([
          { 
            _id: 'storyId1', 
            title: 'Story 1', 
            author: { _id: 'userId', username: 'author' },
            toObject: vi.fn().mockReturnValue({ _id: 'storyId1', title: 'Story 1' })
          }
        ])
      );
      Artwork.find.mockReturnValue(
        createQueryMock([])
      );

      await getReadingHistory(req, res);

      expect(User.findById).toHaveBeenCalledWith('userId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('getBookmarkedContent', () => {
    it('should get bookmarked content successfully', async () => {
      req.query = { page: '1', limit: '10' };
      User.findById.mockReturnValue(
        createQueryMock({
          _id: 'userId',
          bookmarks: [],
          likes: [],
          select: vi.fn().mockResolvedValue({
            _id: 'userId',
            bookmarks: [],
            likes: []
          })
        })
      );

      await getBookmarkedContent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('getLikedContent', () => {
    it('should get liked content successfully', async () => {
      req.query = { page: '1', limit: '10' };
      User.findById.mockReturnValue(
        createQueryMock({
          _id: 'userId',
          bookmarks: [],
          likes: [],
          select: vi.fn().mockResolvedValue({
            _id: 'userId',
            bookmarks: [],
            likes: []
          })
        })
      );

      await getLikedContent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});