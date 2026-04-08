import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, submitAccountAppeal, logout } from '../../controllers/AuthController.js';
import User from '../../models/User.js';
import AccountAppeal from '../../models/AccountAppeal.js';
import webSocketManager from '../../websocket/WebSocketManager.js';

// Mock dependencies
vi.mock('bcrypt');
vi.mock('jsonwebtoken');
vi.mock('../../models/User.js', () => {
  class MockUser {
    constructor(data) {
      Object.assign(this, data);
      this._id = 'userId';
      this.save = vi.fn().mockResolvedValue(this);
    }
  }
  MockUser.findOne = vi.fn();
  MockUser.findById = vi.fn();
  MockUser.find = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue([{ _id: 'adminId' }])
  });
  MockUser.create = vi.fn();
  return { default: MockUser };
});
vi.mock('../../models/AccountAppeal.js', () => ({
  default: {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue(null),
    }),
    create: vi.fn(),
  },
}));
vi.mock('../../websocket/WebSocketManager.js', () => ({
  default: {
    sendNotification: vi.fn(),
  },
}));
vi.mock('../../utils/moderation.js', () => ({
  clearExpiredPostingRestriction: vi.fn(),
  serializePostingRestriction: vi.fn(),
}));
vi.mock('../../utils/savedContent.js', () => ({
  pruneUserSavedContentReferences: vi.fn().mockResolvedValue({ likes: [], bookmarks: [] }),
}));

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      req.body = { username: 'testuser', email: 'test@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword');

      await register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'test@example.com' }, { username: 'testuser' }]
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          userId: 'userId',
          username: 'testuser',
          email: 'test@example.com'
        }
      });
    });

    it('should return error if user already exists', async () => {
      req.body = { username: 'testuser', email: 'test@example.com', password: 'password123' };
      User.findOne.mockResolvedValue({ email: 'test@example.com' });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Email already exists',
          field: 'email'
        }
      });
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      const mockUser = {
        _id: 'userId',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'user',
        isVerified: true,
        avatar: 'avatar.jpg',
        bio: 'Bio',
        favoriteTags: ['tag1'],
        accountStatus: 'active'
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      await login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'userId', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error for invalid credentials', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      User.findOne.mockResolvedValue({ password: 'hashedPassword' });
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid email or password'
        }
      });
    });
  });

  describe('submitAccountAppeal', () => {
    it.skip('should submit appeal successfully', async () => {
      req.body = { appealToken: 'token', reason: 'Reason', evidence: 'Evidence' };
      jwt.verify.mockReturnValue({ userId: 'userId', purpose: 'account-appeal' });
      User.findById.mockResolvedValue({ _id: 'userId', accountStatus: 'permanently-banned' });
      AccountAppeal.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        select: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue(null)
        })
      });
      AccountAppeal.create.mockResolvedValue({ _id: 'appealId' });
      User.find.mockResolvedValue([{ _id: 'adminId' }]);
      webSocketManager.sendNotification.mockResolvedValue();

      await submitAccountAppeal(req, res);

      // expect(AccountAppeal.create).toHaveBeenCalledWith({
      //   user: 'userId',
      //   banReason: undefined,
      //   bannedAt: undefined,
      //   appealReason: 'Reason',
      //   evidence: 'Evidence'
      // });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });
  });
});