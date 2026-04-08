import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReport } from '../../controllers/ReportController.js';
import Report from '../../models/Report.js';
import Story from '../../models/Story.js';
import Artwork from '../../models/Artwork.js';

// Mock dependencies
vi.mock('../../models/Report.js', () => {
  class MockReport {
    constructor(data) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    }
  }
  MockReport.findOne = vi.fn();
  MockReport.countDocuments = vi.fn();
  return { default: MockReport };
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

describe('ReportController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, user: { userId: 'userId' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('createReport', () => {
    it('should create report successfully', async () => {
      req.body = { contentId: 'contentId', contentType: 'Story', reason: 'Spam' };
      Report.findOne.mockResolvedValue(null);
      Story.findById.mockResolvedValue({ _id: 'contentId' });
      Report.countDocuments.mockResolvedValue(1);

      await createReport(req, res);

      expect(Report.findOne).toHaveBeenCalledWith({
        reporter: 'userId',
        contentId: 'contentId',
        contentType: 'Story'
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Report submitted successfully',
        data: expect.objectContaining({
          contentId: 'contentId',
          contentType: 'Story',
          reason: 'Spam',
          reporter: 'userId'
        })
      });
    });

    it('should return error if already reported', async () => {
      req.body = { contentId: 'contentId', contentType: 'Story', reason: 'Spam' };
      Report.findOne.mockResolvedValue({ _id: 'existingReport' });

      await createReport(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'You have already reported this content'
        }
      });
    });
  });
});