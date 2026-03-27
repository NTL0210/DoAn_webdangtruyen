const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Format post response for moderation endpoints.
 * Keeps API output consistent and avoids exposing internal fields.
 */
const formatPost = (post) => {
  const postObject = post.toObject ? post.toObject() : post;
  const author = postObject.author;

  return {
    id: postObject._id,
    author:
      author && typeof author === 'object'
        ? {
            id: author._id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
          }
        : author,
    type: postObject.type,
    title: postObject.title,
    summary: postObject.summary,
    content: postObject.content,
    images: postObject.images,
    tags: postObject.tags,
    status: postObject.status,
    viewsCount: postObject.viewsCount,
    commentsCount: postObject.commentsCount,
    bookmarksCount: postObject.bookmarksCount,
    publishedAt: postObject.publishedAt,
    createdAt: postObject.createdAt,
    updatedAt: postObject.updatedAt,
  };
};

/**
 * GET /api/admin/posts/pending
 * List all non-deleted posts waiting for moderation.
 */
const getPendingPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({
    status: 'pending',
    isDeleted: false,
  })
    .populate('author', 'username displayName avatarUrl')
    .sort({ updatedAt: 1, createdAt: 1 });

  res.status(200).json({
    success: true,
    count: posts.length,
    posts: posts.map(formatPost),
  });
});

/**
 * Shared guard: only posts in pending status can be reviewed.
 */
const ensurePendingStatus = (post, action) => {
  if (post.status !== 'pending') {
    return {
      ok: false,
      message: `Cannot ${action} this post because its current status is "${post.status}". Only pending posts can be reviewed.`,
    };
  }

  return { ok: true };
};

/**
 * PATCH /api/admin/posts/:id/approve
 * Approve a pending post and make it publicly visible.
 */
const approvePost = asyncHandler(async (req, res) => {
  const check = ensurePendingStatus(req.post, 'approve');

  if (!check.ok) {
    return res.status(400).json({
      success: false,
      message: check.message,
    });
  }

  req.post.status = 'approved';

  // Keep existing publishedAt if it already exists.
  if (!req.post.publishedAt) {
    req.post.publishedAt = new Date();
  }

  const updatedPost = await req.post.save();
  await updatedPost.populate('author', 'username displayName avatarUrl');

  res.status(200).json({
    success: true,
    message: 'Post approved successfully.',
    post: formatPost(updatedPost),
  });
});

/**
 * PATCH /api/admin/posts/:id/reject
 * Reject a pending post.
 */
const rejectPost = asyncHandler(async (req, res) => {
  const check = ensurePendingStatus(req.post, 'reject');

  if (!check.ok) {
    return res.status(400).json({
      success: false,
      message: check.message,
    });
  }

  req.post.status = 'rejected';
  req.post.publishedAt = null;

  const updatedPost = await req.post.save();
  await updatedPost.populate('author', 'username displayName avatarUrl');

  res.status(200).json({
    success: true,
    message: 'Post rejected successfully.',
    post: formatPost(updatedPost),
  });
});

module.exports = {
  getPendingPosts,
  approvePost,
  rejectPost,
};
