import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
} from '../../controllers/UserController.js';
import User from '../../models/User.js';
import Follow from '../../models/Follow.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';

// Mock dependencies
const mockFollowResults = [
  { follower: { _id: 'followerId', username: 'follower' } },
  { following: { _id: 'followingId', username: 'following' } }
];

vi.mock('../../models/User.js', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    exec: vi.fn(),
    then: vi.fn((resolve) => resolve({
      _id: 'userId',
      username: 'testuser',
      bio: 'Bio',
      avatar: 'avatar.jpg',
      followers: [],
      following: []
    }))
  };
  return {
    __esModule: true,
    default: {
      findById: vi.fn().mockReturnValue(mockQuery),
      findOne: vi.fn(),
      findByIdAndUpdate: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: 'userId', username: 'updatedUser' })
      }),
      countDocuments: vi.fn()
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
  const defaultQuery = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve([])),
    catch: vi.fn()
  };
  MockFollow.findOne = vi.fn();
  MockFollow.find = vi.fn().mockImplementation(() => ({
    select: defaultQuery.select,
    populate: defaultQuery.populate,
    sort: defaultQuery.sort,
    then: defaultQuery.then,
    catch: defaultQuery.catch
  }));
  MockFollow.countDocuments = vi.fn();
  MockFollow.deleteOne = vi.fn();
  MockFollow.findOneAndDelete = vi.fn();
  return {
    __esModule: true,
    default: MockFollow
  };
});
vi.mock('../../utils/savedContent.js');
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
vi.mock('../../models/Story.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    }),
    countDocuments: vi.fn()
  }
}));
vi.mock('../../models/Artwork.js', () => ({
  __esModule: true,
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([])
      })
    }),
    countDocuments: vi.fn()
  }
}));

describe('UserController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { userId: 'userId' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
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
            _id: 'userId',
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
      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({ _id: 'userId', username: 'updatedUser' })
      });
      User.findOne.mockResolvedValue(null);

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
      const mockCleanupQuery = {
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockResolvedValue([])
      };
      const mockListSort = vi.fn().mockResolvedValue(mockFollowResults);
      const mockListQuery = {
        populate: vi.fn().mockReturnValue({
          sort: mockListSort
        })
      };
      Follow.find.mockReturnValueOnce(mockCleanupQuery).mockReturnValueOnce(mockListQuery);

      await getFollowers(req, res);
      expect(mockCleanupQuery.select).toHaveBeenCalledWith('_id follower');

      expect(Follow.find).toHaveBeenCalledWith({ following: 'userId' });
      expect(mockListQuery.populate).toHaveBeenCalledWith('follower', 'username avatar bio');
      expect(mockListSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: 'followerId', username: 'follower' }]
      });
    });
  });

  describe('getFollowing', () => {
    it('should get following successfully', async () => {
      req.params = { id: 'userId' };
      const mockCleanupQuery = {
        select: vi.fn().mockReturnThis(),
        populate: vi.fn().mockResolvedValue([])
      };
      const mockListSort = vi.fn().mockResolvedValue(mockFollowResults);
      const mockListQuery = {
        populate: vi.fn().mockReturnValue({
          sort: mockListSort
        })
      };
      Follow.find.mockReturnValueOnce(mockCleanupQuery).mockReturnValueOnce(mockListQuery);

      await getFollowing(req, res);
      expect(mockCleanupQuery.select).toHaveBeenCalledWith('_id following');

      expect(Follow.find).toHaveBeenCalledWith({ follower: 'userId' });
      expect(mockListQuery.populate).toHaveBeenCalledWith('following', 'username avatar bio');
      expect(mockListSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: 'followingId', username: 'following' }]
      });
    });
  });
});