const mongoose = require('mongoose');
const ReadingHistory = require('../models/readingHistory.model');
const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');

const formatHistoryItem = (item) => {
  const data = item.toObject ? item.toObject() : item;
  const post = data.post;

  return {
    id: data._id,
    lastReadAt: data.lastReadAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    post:
      post && typeof post === 'object'
        ? {
            id: post._id,
            title: post.title,
            summary: post.summary,
            type: post.type,
            tags: post.tags,
            publishedAt: post.publishedAt,
            author: post.author,
          }
        : post,
  };
};

/**
 * POST /api/history/:postId
 * Add or update reading history for the current user.
 */
const upsertHistory = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  // Only approved and not-deleted posts can be added to history.
  const post = await Post.findOne({ _id: postId, status: 'approved', isDeleted: false });

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Only approved posts can be added to reading history.',
    });
  }

  const now = new Date();

  // Upsert guarantees one record per user+post while updating lastReadAt.
  await ReadingHistory.findOneAndUpdate(
    { user: req.user._id, post: post._id },
    {
      $set: { lastReadAt: now },
      $setOnInsert: { user: req.user._id, post: post._id },
    },
    { upsert: true, new: true }
  );

  const historyItem = await ReadingHistory.findOne({ user: req.user._id, post: post._id }).populate({
    path: 'post',
    populate: { path: 'author', select: 'username displayName avatarUrl' },
  });

  res.status(200).json({
    success: true,
    message: 'Reading history updated successfully.',
    history: formatHistoryItem(historyItem),
  });
});

/**
 * GET /api/history/me
 * Return current user's reading history, newest viewed first.
 */
const getMyHistory = asyncHandler(async (req, res) => {
  const historyItems = await ReadingHistory.find({ user: req.user._id })
    .populate({
      path: 'post',
      match: { status: 'approved', isDeleted: false },
      populate: { path: 'author', select: 'username displayName avatarUrl' },
    })
    .sort({ lastReadAt: -1, updatedAt: -1 });

  // Hide entries whose posts are no longer public.
  const visibleItems = historyItems.filter((item) => item.post);

  res.status(200).json({
    success: true,
    count: visibleItems.length,
    history: visibleItems.map(formatHistoryItem),
  });
});

/**
 * DELETE /api/history/:postId
 * Delete one history item of the current user only.
 */
const deleteHistoryItem = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  const deleted = await ReadingHistory.findOneAndDelete({
    user: req.user._id,
    post: postId,
  });

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'History item not found.',
    });
  }

  res.status(200).json({
    success: true,
    message: 'History item deleted successfully.',
  });
});

module.exports = {
  upsertHistory,
  getMyHistory,
  deleteHistoryItem,
};