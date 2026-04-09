import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dismissReports,
  banContent,
  banUser,
  getReports,
  getModerationAuditHistory,
  getUsersForModeration,
  permanentlyBanUser,
  unbanUser,
  getAccountAppeals,
  approveAccountAppeal,
  rejectAccountAppeal,
  openReportIncident,
  releaseReportIncident,
  getReportDetails
} from '../../controllers/ModerationController.js';
import Report from '../../models/Report.js';

// Mock dependencies

vi.mock('../../models/Report.js', () => {
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
      find: vi.fn().mockImplementation(() => createQueryMock([])),
      findOne: vi.fn().mockImplementation(() => createQueryMock(null)),
      findById: vi.fn().mockImplementation(() => createQueryMock({ _id: 'reportId', status: 'open' })),
      findOneAndUpdate: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      countDocuments: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../../models/ModerationCase.js', () => {
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

  const caseQueryMock = createQueryMock({ _id: 'caseId', status: 'open' });

  return {
    __esModule: true,
    default: {
      find: vi.fn().mockImplementation(() => caseQueryMock),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      findByIdAndUpdate: vi.fn().mockImplementation(() => caseQueryMock),
      create: vi.fn().mockResolvedValue({ _id: 'caseId', status: 'open' })
    }
  };
});

vi.mock('../../models/Story.js', () => {
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
      find: vi.fn().mockImplementation(() => createQueryMock([{ _id: '507f1f77bcf86cd799439011', title: 'Test Story', author: 'userId' }])),
      findById: vi.fn().mockImplementation((id) => createQueryMock({ _id: id || '507f1f77bcf86cd799439011', title: 'Test Story', author: 'userId', save: vi.fn() })),
      findByIdAndUpdate: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../../models/Artwork.js', () => {
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
      find: vi.fn().mockImplementation(() => createQueryMock([{ _id: '507f1f77bcf86cd799439011', title: 'Test Artwork', author: 'userId' }])),
      findById: vi.fn().mockImplementation((id) => createQueryMock({ _id: id || '507f1f77bcf86cd799439011', title: 'Test Artwork', author: 'userId', save: vi.fn() })),
      findByIdAndUpdate: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue([])
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
      findById: vi.fn().mockImplementation((id) =>
        createQueryMock({ _id: id || 'userId', username: 'testuser', accountStatus: 'active', save: vi.fn() })
      ),
      findByIdAndUpdate: vi.fn().mockResolvedValue({ _id: 'userId', accountStatus: 'banned' }),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      find: vi.fn().mockImplementation(() => createQueryMock([])),
      countDocuments: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../../models/AccountAppeal.js', () => {
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
      find: vi.fn().mockImplementation(() => createQueryMock([])),
      findById: vi.fn().mockImplementation((id) => {
        const userData = {
          _id: 'userId',
          accountStatus: 'permanently-banned',
          username: 'testuser',
          permanentBanReason: 'Banned',
          permanentlyBannedAt: new Date(),
          postingRestrictedUntil: null,
          postingRestrictionReason: '',
          postingRestrictionSource: null,
          lastModeratedAt: new Date(),
          pendingLoginNoticeType: 'success',
          pendingLoginNoticeTitle: 'Account restored',
          pendingLoginNoticeMessage: 'Your appeal was approved.',
          save: vi.fn().mockResolvedValue({
            _id: 'userId',
            accountStatus: 'active'
          })
        };
        const appealDoc = {
          _id: id || 'appealId',
          user: userData,
          status: 'pending',
          save: vi.fn().mockResolvedValue({ _id: id || 'appealId', status: 'approved' })
        };
        const query = {};
        query.populate = vi.fn().mockResolvedValue(appealDoc);
        query.then = function(onFulfilled) {
          return Promise.resolve(appealDoc).then(onFulfilled);
        };
        query.catch = function(onRejected) {
          return Promise.resolve(appealDoc).catch(onRejected);
        };
        return query;
      }),
      findByIdAndUpdate: vi.fn().mockImplementation(() => createQueryMock({ _id: 'appealId', status: 'approved' })),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      create: vi.fn().mockResolvedValue({ _id: 'appealId' })
    }
  };
});
vi.mock('../../models/ModerationAuditLog.js', () => {
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

  const auditLogQueryMock = createQueryMock([]);

  return {
    __esModule: true,
    default: {
      find: vi.fn().mockImplementation(() => auditLogQueryMock)
    }
  };
});

vi.mock('../../websocket/WebSocketManager.js', () => ({
  __esModule: true,
  default: {
    sendNotification: vi.fn().mockResolvedValue(undefined),
    notifyUser: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../utils/moderation.js', () => ({
  POSTING_RESTRICTION_DAYS: 7,
  applyPostingRestriction: vi.fn(),
  getActivePostingRestriction: vi.fn().mockReturnValue({ until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), reason: 'Violation' }),
  getPermanentBanDeletionDeadline: vi.fn().mockReturnValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  normalizeModerationReason: vi.fn((reason) => reason),
  serializePermanentBan: vi.fn((ban) => ban),
  serializePostingRestriction: vi.fn((restr) => restr)
}));
vi.mock('../../utils/moderationQueue.js', () => ({
  assignIncidentToAdmin: vi.fn(),
  buildReasonSummaryPipeline: vi.fn(() => []),
  ensureIncidentExists: vi.fn(),
  normalizeReportContentType: vi.fn((type) => type),
  releaseIncidentAssignment: vi.fn(),
  serializeWorkflow: vi.fn((workflow) => workflow)
}));
vi.mock('../../services/cacheStore.js', () => ({
  CACHE_NAMESPACES: { CONTENT_DISCOVERY: 'discovery' },
  invalidateCacheNamespaces: vi.fn()
}));
vi.mock('../../services/moderationAudit.js', () => ({
  recordModerationAuditEvent: vi.fn()
}));
vi.mock('../../services/permanentBanCleanup.js', () => ({
  hideUserContentForPermanentBan: vi.fn(),
  restoreUserContentAfterPermanentBan: vi.fn()
}));
vi.mock('../../utils/savedContent.js', () => ({
  removeContentFromAllSavedCollections: vi.fn()
}));

// Helper function for creating query mocks
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

      await dismissReports(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reports dismissed successfully',
        data: {
          content: expect.objectContaining({
            _id: '507f1f77bcf86cd799439011',
            status: 'approved',
            author: 'userId',
            title: 'Test Story'
          }),
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

      await banContent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Post banned successfully'
        })
      );
    });
  });

  describe('banUser', () => {
    it('should ban user successfully', async () => {
      req.params = { id: 'targetUserId' };
      req.body = { reason: 'Violation', duration: 7 };

      await banUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User suspended successfully'
        })
      );
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

  describe('getModerationAuditHistory', () => {
    it('should get moderation audit history successfully', async () => {
      await getModerationAuditHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'Moderation audit history loaded'
      });
    });
  });

  describe('getUsersForModeration', () => {
    it('should get users for moderation successfully', async () => {
      await getUsersForModeration(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          message: 'Users loaded successfully'
        })
      );
    });
  });

  describe('permanentlyBanUser', () => {
    it('should permanently ban user successfully', async () => {
      req.params = { id: 'targetUserId' };
      req.body = { reason: 'Severe violation' };

      await permanentlyBanUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User permanently banned successfully'
        })
      );
    });
  });

  describe('unbanUser', () => {
    it('should unban user successfully', async () => {
      req.params = { id: 'targetUserId' };

      await unbanUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User restriction cleared successfully',
        data: expect.objectContaining({
          _id: 'targetUserId'
        })
      });
    });
  });

  describe('getAccountAppeals', () => {
    it('should get account appeals successfully', async () => {
      await getAccountAppeals(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        message: 'Appeals loaded successfully'
      });
    });
  });

  describe('approveAccountAppeal', () => {
    it('should approve account appeal successfully', async () => {
      req.params = { id: 'appealId' };
      req.body = { reason: 'Appeal looks valid' };

      await approveAccountAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Appeal approved successfully'
        })
      );
    });
  });

  describe('rejectAccountAppeal', () => {
    it('should reject account appeal successfully', async () => {
      req.params = { id: 'appealId' };
      req.body = { reason: 'Invalid appeal' };

      await rejectAccountAppeal(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Appeal rejected successfully'
        })
      );
    });
  });

  describe('openReportIncident', () => {
    it('should open report incident successfully', async () => {
      req.params = { id: '507f1f77bcf86cd799439011', contentType: 'story' };

      await openReportIncident(req, res);

      expect(res.status).toHaveBeenCalledWith(
        expect.any(Number)
      );
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('releaseReportIncident', () => {
    it('should release report incident successfully', async () => {
      req.params = { id: '507f1f77bcf86cd799439011', contentType: 'story' };

      await releaseReportIncident(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
        message: 'Incident released successfully'
      });
    });
  });

  describe('getReportDetails', () => {
    it('should get report details successfully', async () => {
      req.params = { id: '507f1f77bcf86cd799439011', contentType: 'story' };

      // Mock Report.find to return reports with proper structure
      Report.find = vi.fn().mockImplementation(() =>
        createQueryMock([
          {
            _id: 'reportId',
            reason: 'Inappropriate content',
            reporter: { _id: 'reporterId', username: 'reporter', avatar: 'avatar.jpg' },
            createdAt: new Date()
          }
        ])
      );

      await getReportDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
          message: 'Report details loaded successfully'
        })
      );
    });
  });
});