const mongoose = require('mongoose');
const Post = require('../models/post.model');

/**
 * Validate that :id is a valid MongoDB ObjectId before querying the database.
 */
const validatePostId = (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  next();
};

/**
 * Load a non-deleted post and attach it to req.post.
 * This is reused by show, update, and delete handlers.
 */
const loadPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false }).populate(
      'author',
      'username displayName avatarUrl'
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    req.post = post;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Ensure the currently authenticated user owns the post.
 */
const requirePostOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (String(req.post.author._id) !== String(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'You can only modify your own posts.',
    });
  }

  next();
};

module.exports = { validatePostId, loadPost, requirePostOwner };
