import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, submitAccountAppeal, logout, resendVerificationOtp, resendPhoneVerification, verifyPhoneOtp, verifyEmailOtp, requestPasswordReset, resetPasswordWithOtp } from '../../controllers/AuthController.js';
import User from '../../models/User.js';
import AccountAppeal from '../../models/AccountAppeal.js';
import webSocketManager from '../../websocket/WebSocketManager.js';
import { sendEmail } from '../../services/emailService.js';
import { createOtpForUser, verifyOtpForUser } from '../../services/otpService.js';

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
vi.mock('../../services/emailService.js', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('../../services/otpService.js', () => ({
  createOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(),
}));
vi.mock('../../services/smsService.js', () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true })
}));
vi.mock('../../models/Phone.js', () => ({
  __esModule: true,
  default: {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 })
  }
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
        message: 'User registered successfully. A verification code was sent to your email.',
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

  describe('resendVerificationOtp', () => {
    it('should return 400 if email is not provided', async () => {
      req.body = { email: '' };

      await resendVerificationOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          field: 'email'
        }
      });
    });

    it('should return success if user does not exist (privacy)', async () => {
      req.body = { email: 'nonexistent@example.com' };
      User.findOne.mockResolvedValue(null);

      await resendVerificationOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account exists, a verification code was sent.'
      });
    });

    it('should return 400 if user is already verified', async () => {
      req.body = { email: 'test@example.com' };
      User.findOne.mockResolvedValue({ isVerified: true });

      await resendVerificationOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Email is already verified'
        }
      });
    });

    it('should resend verification OTP successfully', async () => {
      req.body = { email: 'test@example.com' };
      const mockUser = { _id: 'userId', email: 'test@example.com', isVerified: false };
      User.findOne.mockResolvedValue(mockUser);
      createOtpForUser.mockResolvedValue({ code: '123456' });
      sendEmail.mockResolvedValue();

      await resendVerificationOtp(req, res);

      expect(createOtpForUser).toHaveBeenCalledWith('userId', 'verify');
      expect(sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verification code sent if the email exists.'
      });
    });
  });

  describe('verifyEmailOtp', () => {
    it('should return 400 if email or code is missing', async () => {
      req.body = { email: 'test@example.com' };

      await verifyEmailOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and code are required'
        }
      });
    });

    it('should return 400 if user not found', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      User.findOne.mockResolvedValue(null);

      await verifyEmailOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid email or code'
        }
      });
    });

    it('should return 400 if OTP is invalid or expired', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      const mockUser = { _id: 'userId', email: 'test@example.com', isVerified: false, save: vi.fn() };
      User.findOne.mockResolvedValue(mockUser);
      verifyOtpForUser.mockResolvedValue(false);

      await verifyEmailOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid or expired verification code'
        }
      });
    });

    it('should verify email successfully', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      const mockUser = { _id: 'userId', email: 'test@example.com', isVerified: false, save: vi.fn().mockResolvedValue() };
      User.findOne.mockResolvedValue(mockUser);
      verifyOtpForUser.mockResolvedValue(true);

      await verifyEmailOtp(req, res);

      expect(verifyOtpForUser).toHaveBeenCalledWith('userId', 'verify', '123456');
      expect(mockUser.isVerified).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully'
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should return 400 if email is not provided', async () => {
      req.body = { email: '' };

      await requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required'
        }
      });
    });

    it('should return success if user does not exist (privacy)', async () => {
      req.body = { email: 'nonexistent@example.com' };
      User.findOne.mockResolvedValue(null);

      await requestPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account exists, a reset code was sent.'
      });
    });

    it('should send password reset code successfully', async () => {
      req.body = { email: 'test@example.com' };
      const mockUser = { _id: 'userId', email: 'test@example.com' };
      User.findOne.mockResolvedValue(mockUser);
      createOtpForUser.mockResolvedValue({ code: '123456' });
      sendEmail.mockResolvedValue();

      await requestPasswordReset(req, res);

      expect(createOtpForUser).toHaveBeenCalledWith('userId', 'reset');
      expect(sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account exists, a reset code was sent.'
      });
    });
  });

  describe('resetPasswordWithOtp', () => {
    it('should return 400 if required fields are missing', async () => {
      req.body = { email: 'test@example.com', code: '123456' };

      await resetPasswordWithOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, code and newPassword are required'
        }
      });
    });

    it('should return 400 if password is less than 8 characters', async () => {
      req.body = { email: 'test@example.com', code: '123456', newPassword: 'short' };

      await resetPasswordWithOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters long',
          field: 'newPassword'
        }
      });
    });

    it('should return 400 if user not found', async () => {
      req.body = { email: 'test@example.com', code: '123456', newPassword: 'newpassword123' };
      User.findOne.mockResolvedValue(null);

      await resetPasswordWithOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid email or code'
        }
      });
    });

    it('should return 400 if OTP is invalid or expired', async () => {
      req.body = { email: 'test@example.com', code: '123456', newPassword: 'newpassword123' };
      const mockUser = { _id: 'userId', email: 'test@example.com' };
      User.findOne.mockResolvedValue(mockUser);
      verifyOtpForUser.mockResolvedValue(false);

      await resetPasswordWithOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid or expired reset code'
        }
      });
    });

    it('should reset password successfully', async () => {
      req.body = { email: 'test@example.com', code: '123456', newPassword: 'newpassword123' };
      const mockUser = { _id: 'userId', email: 'test@example.com', password: 'oldHashedPassword', save: vi.fn().mockResolvedValue() };
      User.findOne.mockResolvedValue(mockUser);
      verifyOtpForUser.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('newHashedPassword');

      await resetPasswordWithOtp(req, res);

      expect(verifyOtpForUser).toHaveBeenCalledWith('userId', 'reset', '123456');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockUser.password).toBe('newHashedPassword');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully'
      });
    });
  });

  describe('resendPhoneVerification', () => {
    it('should return 400 if phone number is not provided', async () => {
      req.body = { phoneNumber: '' };

      await resendPhoneVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should send phone verification code successfully', async () => {
      req.body = { phoneNumber: '+84971234567' };
      User.findOne = vi.fn().mockResolvedValue({
        _id: 'userId',
        phoneNumber: '+84971234567',
        phoneVerified: false,
        save: vi.fn()
      });
      createOtpForUser.mockResolvedValue({ code: '123456' });

      await resendPhoneVerification(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ phoneNumber: '+84971234567' });
      expect(createOtpForUser).toHaveBeenCalledWith('userId', 'verify');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verification code sent if the phone exists.'
      });
    });
  });

  describe('verifyPhoneOtp', () => {
    it('should return 400 if phone or code is missing', async () => {
      req.body = { phone: '+84971234567' };

      await verifyPhoneOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should verify phone OTP successfully', async () => {
      req.body = { phoneNumber: '+84971234567', code: '123456' };
      const mockUser = {
        _id: 'userId',
        phoneNumber: '+84971234567',
        phoneVerified: false,
        save: vi.fn().mockResolvedValue()
      };
      User.findOne = vi.fn().mockResolvedValue(mockUser);
      verifyOtpForUser.mockResolvedValue(true);

      await verifyPhoneOtp(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ phoneNumber: '+84971234567' });
      expect(verifyOtpForUser).toHaveBeenCalledWith('userId', 'verify', '123456');
      expect(mockUser.phoneVerified).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Phone verified successfully'
      });
    });

    it('should return error if OTP is invalid', async () => {
      req.body = { phoneNumber: '+84971234567', code: '123456' };
      User.findOne = vi.fn().mockResolvedValue({
        _id: 'userId',
        phoneNumber: '+84971234567',
        phoneVerified: false
      });
      verifyOtpForUser.mockResolvedValue(false);

      await verifyPhoneOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_CODE'
        })
      });
    });
  });
});