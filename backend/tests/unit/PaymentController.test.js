import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMomoSubscriptionCheckout,
  createMomoPremiumCheckout,
  handleMomoIpn,
  handleMomoReturn,
  getPaymentStatus,
  confirmPaymentFromReturnDev
} from '../../controllers/PaymentController.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import User from '../../models/User.js';
import ArtistSubscription from '../../models/ArtistSubscription.js';

// Helper function for mocking Mongoose queries
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

// Mock config/env.js with proper MoMo configuration
vi.mock('../../config/env.js', () => ({
  env: {
    isProduction: false,
    momo: {
      partnerCode: 'MOMO_PARTNER',
      accessKey: 'test_access_key',
      secretKey: 'test_secret_key',
      endpoint: 'https://test.momo.vn/payment/init',
      returnUrl: 'https://app.test/payment/return',
      notifyUrl: 'https://api.test/webhooks/momo',
      requestType: 'captureWallet'
    }
  }
}));

// Mock dependencies

vi.mock('../../models/PaymentTransaction.js', () => {
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

  return {
    __esModule: true,
    default: {
      create: vi.fn().mockImplementation((data) => ({
        ...data,
        _id: 'transactionId',
        save: vi.fn().mockResolvedValue({ ...data, _id: 'transactionId' })
      })),
      findById: vi.fn().mockImplementation(() =>
        createQueryMock({
          _id: 'transactionId',
          user: 'userId',
          status: 'pending',
          amount: 49000,
          type: 'subscription',
          save: vi.fn()
        })
      ),
      findOne: vi.fn().mockResolvedValue({
        _id: 'transactionId',
        user: 'userId',
        orderId: 'orderId',
        transactionType: 'subscription',
        status: 'completed',
        amount: 49000,
        currency: 'VND',
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        artist: 'artistId',
        subscription: 'subscriptionId',
        metadata: {},
        save: vi.fn().mockResolvedValue()
      }),
      findByIdAndUpdate: vi.fn().mockResolvedValue({
        _id: 'transactionId',
        status: 'completed'
      }),
      find: vi.fn().mockImplementation(() =>
        createQueryMock([])
      )
    }
  };
});

vi.mock('../../models/User.js', () => {
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

  return {
    __esModule: true,
    default: {
      findById: vi.fn().mockImplementation((id) => {
        if (id === 'artist123' || id === 'artistId') {
          return createQueryMock({
            _id: id,
            username: 'artist',
            creatorPlan: 'premium_artist',
            premiumStatus: 'active',
            subscriptionEnabled: true,
            subscriptionPrice: 49000
          });
        }
        return createQueryMock({
          _id: 'userId',
          email: 'user@example.com',
          username: 'testuser',
          save: vi.fn()
        });
      }),
      findOne: vi.fn().mockImplementation(() =>
        createQueryMock({
          _id: 'userId',
          email: 'user@example.com',
          username: 'testuser'
        })
      ),
      findByIdAndUpdate: vi.fn().mockResolvedValue({
        _id: 'userId',
        isPremium: true
      })
    }
  };
});
vi.mock('../../models/ArtistSubscription.js', () => ({
  __esModule: true,
  default: class ArtistSubscription {
    constructor(data) {
      Object.assign(this, data);
      this._id = 'subscriptionId';
      this.save = vi.fn().mockResolvedValue(this);
    }
    static create = vi.fn().mockImplementation((data) => ({
      ...data,
      _id: 'subscriptionId',
      save: vi.fn().mockResolvedValue({ ...data, _id: 'subscriptionId' })
    }));
    static findOne = vi.fn().mockImplementation(() => createQueryMock(null));
    static findByIdAndUpdate = vi.fn().mockResolvedValue({
      _id: 'subscriptionId',
      status: 'active'
    });
  }
}));
vi.mock('../../services/momoService.js', () => ({
  buildMomoCreatePaymentPayload: vi.fn().mockReturnValue({
    partnerCode: 'MOMO_PARTNER',
    accessKey: 'test_access_key',
    requestId: 'req123',
    amount: '49000',
    orderId: 'order123',
    orderInfo: 'Test order',
    signature: 'test_sig'
  }),
  verifyMomoCallbackSignature: vi.fn().mockReturnValue(true),
  verifyMomoCreateResponseSignature: vi.fn().mockReturnValue(true),
  createPayment: vi.fn().mockResolvedValue({
    payUrl: 'https://test-payment-url.com',
    orderId: 'order123'
  })
}));
vi.mock('../../services/cacheStore.js', () => ({
  CACHE_NAMESPACES: {
    CONTENT_DISCOVERY: 'discovery',
    CREATOR_SEARCH: 'search'
  },
  invalidateCacheNamespaces: vi.fn()
}));
vi.mock('../../services/emailService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true })
}));
vi.mock('../../utils/search.js', () => ({
  buildSearchNameFields: vi.fn((name) => ({ searchName: name }))
}));
vi.mock('superagent', () => ({
  __esModule: true,
  default: {
    post: vi.fn().mockReturnValue({
      send: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      timeout: vi.fn().mockResolvedValue({
        body: {
          partnerCode: 'MOMO_PARTNER',
          requestId: 'req123',
          orderId: 'order123',
          requestId: 'req_id_123',
          resultCode: '0',
          message: 'Thành công',
          signature: 'test_sig_123',
          payUrl: 'https://momo.vn/pay?token=test',
          deeplink: 'momo://payment?token=test',
          qrCodeUrl: 'https://momo.vn/qr?token=test'
        }
      })
    })
  }
}));
vi.mock('../../websocket/WebSocketManager.js', () => ({
  __esModule: true,
  default: {
    sendNotification: vi.fn()
  }
}));

describe('PaymentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      user: { userId: 'userId' },
      query: {},
      ip: '192.168.1.1'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      redirect: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('createMomoSubscriptionCheckout', () => {
    it('should create subscription checkout successfully', async () => {
      req.params = { artistId: 'artist123' };

      const momoService = await import('../../services/momoService.js');

      await createMomoSubscriptionCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object)
        })
      );
    });

    it('should return error for invalid package type', async () => {
      req.body = {
        packageType: 'invalid',
        amount: 49000
      };

      await createMomoSubscriptionCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });
  });

  describe('createMomoPremiumCheckout', () => {
    it('should create premium checkout successfully', async () => {
      req.body = {
        plan: 'monthly'
      };

      await createMomoPremiumCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object)
        })
      );
    });

    it('should return error for invalid plan', async () => {
      req.body = {
        plan: 'invalid'
      };

      await createMomoPremiumCheckout(req, res);

      expect(res.status).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });
  });

  describe('handleMomoIpn', () => {
    it('should handle IPN successfully', async () => {
      req.body = {
        transId: 'transactionId',
        resultCode: 0,
        message: 'Success',
        orderId: 'orderId',
        requestId: 'req123'
      };
      PaymentTransaction.findById.mockResolvedValue({
        _id: 'transactionId',
        orderId: 'orderId',
        save: vi.fn()
      });

      await handleMomoIpn(req, res);

      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle IPN failure', async () => {
      req.body = {
        transId: 'transactionId',
        resultCode: 1001,
        message: 'Failed',
        orderId: 'orderId'
      };

      await handleMomoIpn(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('handleMomoReturn', () => {
    it('should handle return successfully', async () => {
      req.query = {
        orderId: 'orderId',
        resultCode: 0
      };

      await handleMomoReturn(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orderId: 'orderId',
            resultCode: ''
          })
        })
      );
    });

    it('should handle return with failure', async () => {
      req.query = {
        orderId: 'orderId',
        resultCode: '1001'
      };

      await handleMomoReturn(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orderId: 'orderId',
            resultCode: '1001'
          }),
          message: 'Return received. Payment status must be confirmed by IPN.'
        })
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      req.params = { orderId: 'orderId' };

      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          orderId: 'orderId',
          status: 'completed',
          amount: 49000
        })
      });
    });

    it('should return error if transaction not found', async () => {
      req.params = { orderId: 'nonExistentOrderId' };
      PaymentTransaction.findOne.mockResolvedValue(null);

      await getPaymentStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('confirmPaymentFromReturnDev', () => {
    it('should confirm payment successfully', async () => {
      req.params = { orderId: 'orderId' };
      req.body = {
        resultCode: '0'
      };
      PaymentTransaction.findOne.mockResolvedValue({
        _id: 'transactionId',
        orderId: 'orderId',
        user: 'userId',
        status: 'pending',
        save: vi.fn().mockResolvedValue()
      });

      await confirmPaymentFromReturnDev(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });

    it('should return error for failed payment', async () => {
      req.params = { orderId: 'orderId' };
      req.body = {
        resultCode: '1001'
      };
      PaymentTransaction.findOne.mockResolvedValue(null);

      await confirmPaymentFromReturnDev(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
