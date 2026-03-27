const mongoose = require('mongoose');
const Comment = require('../models/comment.model');
const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../utils/notification.service');

/**
 * Convert comment document to a clean API response object.
 */
const formatComment = (comment) => {
  const commentObject = comment.toObject ? comment.toObject() : comment;
  const author = commentObject.author;

  return {
    id: commentObject._id,
    post: commentObject.post,
    author:
      author && typeof author === 'object'
        ? {
            id: author._id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
          }
        : author,
    content: commentObject.content,
    createdAt: commentObject.createdAt,
    updatedAt: commentObject.updatedAt,
  };
};

/**
 * Find a post that is public-commentable.
 * Public-commentable means: approved + not deleted.
 */
const findApprovedPost = async (postId) => {
  return Post.findOne({
    _id: postId,
    status: 'approved',
    isDeleted: false,
  });
};

/**
 * POST /api/posts/:id/comments
 * Create a comment on an approved, non-deleted post.
 */
const createComment = asyncHandler(async (req, res) => {
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  // Trim content and validate required value
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

  if (!content) {
    return res.status(400).json({
      success: false,
      message: 'Comment content is required.',
    });
  }

  const post = await findApprovedPost(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'You can only comment on approved posts.',
    });
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    content,
  });

  // Increase post.commentsCount when a comment is added
  await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });

  await createNotification({
    recipient: post.author,
    sender: req.user._id,
    type: 'comment',
    post: post._id,
    comment: comment._id,
    message: `${req.user.displayName || req.user.username} commented on your post "${post.title}".`,
  });

  const createdComment = await Comment.findById(comment._id).populate(
    'author',
    'username displayName avatarUrl'
  );

  res.status(201).json({
    success: true,
    message: 'Comment created successfully.',
    comment: formatComment(createdComment),
  });
});

/**
 * GET /api/posts/:id/comments
 * List non-deleted comments for an approved, non-deleted post.
 */
const getPostComments = asyncHandler(async (req, res) => {
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  const post = await findApprovedPost(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'Post not found.',
    });
  }

  const comments = await Comment.find({
    post: post._id,
    isDeleted: false,
  })
    .populate('author', 'username displayName avatarUrl')
    .sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: comments.length,
    comments: comments.map(formatComment),
  });
});

/**
 * DELETE /api/comments/:id
 * Soft-delete a comment. Only the owner can delete their own comment.
 */
const deleteComment = asyncHandler(async (req, res) => {
  const commentId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid comment id.',
    });
  }

  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found.',
    });
  }

  if (String(comment.author) !== String(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'You can only delete your own comments.',
    });
  }

  comment.isDeleted = true;
  comment.deletedAt = new Date();
  await comment.save();

  // Decrease commentsCount safely (never below 0)
  await Post.updateOne(
    { _id: comment.post, commentsCount: { $gt: 0 } },
    { $inc: { commentsCount: -1 } }
  );

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully.',
  });
});

module.exports = {
  createComment,
  getPostComments,
  deleteComment,
};
