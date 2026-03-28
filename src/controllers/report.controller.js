const mongoose = require('mongoose');
const Report = require('../models/report.model');
const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');
const MAX_REPORT_REASON_LENGTH = 120;
const MAX_REPORT_DETAILS_LENGTH = 1000;

const formatReport = (report) => {
  const item = report.toObject ? report.toObject() : report;

  return {
    id: item._id,
    reason: item.reason,
    details: item.details,
    status: item.status,
    reviewedAt: item.reviewedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    reporter:
      item.reporter && typeof item.reporter === 'object'
        ? {
            id: item.reporter._id,
            username: item.reporter.username,
            displayName: item.reporter.displayName,
            avatarUrl: item.reporter.avatarUrl,
          }
        : item.reporter,
    post:
      item.post && typeof item.post === 'object'
        ? {
            id: item.post._id,
            title: item.post.title,
            type: item.post.type,
            status: item.post.status,
          }
        : item.post,
    reviewedBy:
      item.reviewedBy && typeof item.reviewedBy === 'object'
        ? {
            id: item.reviewedBy._id,
            username: item.reviewedBy.username,
            displayName: item.reviewedBy.displayName,
          }
        : item.reviewedBy,
  };
};

/**
 * POST /api/posts/:id/report
 * Authenticated users can report only approved, non-deleted posts.
 */
const createReport = asyncHandler(async (req, res) => {
  const postId = req.params.id;
  const { reason, details } = req.body;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  const cleanDetails = typeof details === 'string' ? details.trim() : '';

  if (!cleanReason) {
    return res.status(400).json({
      success: false,
      message: 'Report reason is required.',
    });
  }

  if (cleanReason.length > MAX_REPORT_REASON_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Report reason cannot exceed ${MAX_REPORT_REASON_LENGTH} characters.`,
    });
  }

  if (cleanDetails.length > MAX_REPORT_DETAILS_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Report details cannot exceed ${MAX_REPORT_DETAILS_LENGTH} characters.`,
    });
  }

  const post = await Post.findOne({
    _id: postId,
    status: 'approved',
    isDeleted: false,
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Only approved posts can be reported.',
    });
  }

  if (String(post.author) === String(req.user._id)) {
    return res.status(400).json({
      success: false,
      message: 'You cannot report your own post.',
    });
  }

  const existingReport = await Report.findOne({
    reporter: req.user._id,
    post: post._id,
  });

  if (existingReport) {
    return res.status(409).json({
      success: false,
      message: 'You have already reported this post.',
    });
  }

  let report;

  try {
    report = await Report.create({
      reporter: req.user._id,
      post: post._id,
      reason: cleanReason,
      details: cleanDetails,
    });
  } catch (error) {
    // Unique index fallback for duplicate submission race conditions.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already reported this post.',
      });
    }

    throw error;
  }

  const createdReport = await Report.findById(report._id)
    .populate('reporter', 'username displayName avatarUrl')
    .populate('post', 'title type status');

  res.status(201).json({
    success: true,
    message: 'Report submitted successfully.',
    report: formatReport(createdReport),
  });
});

/**
 * GET /api/admin/reports
 * Moderator/Admin endpoint to list reports.
 * Optional query: ?status=pending|reviewed|rejected|action_taken
 */
const getReports = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const allowedStatuses = ['pending', 'reviewed', 'rejected', 'action_taken'];

  const query = {};
  if (status !== undefined) {
    const cleanStatus = String(status).trim();

    if (!allowedStatuses.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status query. Use pending, reviewed, rejected, or action_taken.',
      });
    }

    query.status = cleanStatus;
  }

  const reports = await Report.find(query)
    .populate('reporter', 'username displayName avatarUrl')
    .populate('post', 'title type status')
    .populate('reviewedBy', 'username displayName')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reports.length,
    reports: reports.map(formatReport),
  });
});

/**
 * PATCH /api/admin/reports/:id/review
 * Moderator/Admin can review a pending report.
 * Body: { status: 'reviewed' | 'rejected' | 'action_taken' }
 */
const reviewReport = asyncHandler(async (req, res) => {
  const reportId = req.params.id;
  const status = typeof req.body.status === 'string' ? req.body.status.trim() : '';
  const allowedReviewStatuses = ['reviewed', 'rejected', 'action_taken'];

  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid report id.',
    });
  }

  if (!allowedReviewStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid review status. Use reviewed, rejected, or action_taken.',
    });
  }

  const report = await Report.findById(reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found.',
    });
  }

  if (report.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `This report has already been processed with status "${report.status}".`,
    });
  }

  report.status = status;
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  await report.save();

  const reviewedReport = await Report.findById(report._id)
    .populate('reporter', 'username displayName avatarUrl')
    .populate('post', 'title type status')
    .populate('reviewedBy', 'username displayName');

  res.status(200).json({
    success: true,
    message: 'Report reviewed successfully.',
    report: formatReport(reviewedReport),
  });
});

module.exports = {
  createReport,
  getReports,
  reviewReport,
};
