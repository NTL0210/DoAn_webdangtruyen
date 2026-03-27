const mongoose = require('mongoose');
const Bookmark = require('../models/bookmark.model');
const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');

const formatBookmark = (bookmark) => {
  const bookmarkObject = bookmark.toObject ? bookmark.toObject() : bookmark;
  const post = bookmarkObject.post;
  const author = post && post.author;

  return {
    id: bookmarkObject._id,
    createdAt: bookmarkObject.createdAt,
    post:
      post && typeof post === 'object'
        ? {
            id: post._id,
            title: post.title,
            summary: post.summary,
            type: post.type,
            tags: post.tags,
            publishedAt: post.publishedAt,
            bookmarksCount: post.bookmarksCount,
            author:
              author && typeof author === 'object'
                ? {
                    id: author._id,
                    username: author.username,
                    displayName: author.displayName,
                    avatarUrl: author.avatarUrl,
                  }
                : author,
          }
        : post,
  };
};

/**
 * Find a public post that can be bookmarked.
 */
const findBookmarkedPost = async (postId) => {
  return Post.findOne({
    _id: postId,
    status: 'approved',
    isDeleted: false,
  }).populate('author', 'username displayName avatarUrl');
};

/**
 * POST /api/posts/:id/bookmark
 * Add a bookmark for the current user.
 */
const createBookmark = asyncHandler(async (req, res) => {
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  const post = await findBookmarkedPost(postId);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: 'You can only bookmark approved posts.',
    });
  }

  const existingBookmark = await Bookmark.findOne({ user: req.user._id, post: post._id });

  if (existingBookmark) {
    return res.status(409).json({
      success: false,
      message: 'You have already bookmarked this post.',
    });
  }

  let bookmark;

  try {
    bookmark = await Bookmark.create({
      user: req.user._id,
      post: post._id,
    });
  } catch (error) {
    // The unique index is the final guard against duplicate bookmarks.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already bookmarked this post.',
      });
    }

    throw error;
  }

  await Post.updateOne({ _id: post._id }, { $inc: { bookmarksCount: 1 } });

  const createdBookmark = await Bookmark.findById(bookmark._id).populate({
    path: 'post',
    populate: { path: 'author', select: 'username displayName avatarUrl' },
  });

  res.status(201).json({
    success: true,
    message: 'Post bookmarked successfully.',
    bookmark: formatBookmark(createdBookmark),
  });
});

/**
 * DELETE /api/posts/:id/bookmark
 * Remove the current user's bookmark.
 */
const deleteBookmark = asyncHandler(async (req, res) => {
  const postId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post id.',
    });
  }

  const bookmark = await Bookmark.findOneAndDelete({
    user: req.user._id,
    post: postId,
  });

  if (!bookmark) {
    return res.status(404).json({
      success: false,
      message: 'Bookmark not found.',
    });
  }

  await Post.updateOne(
    { _id: postId, bookmarksCount: { $gt: 0 } },
    { $inc: { bookmarksCount: -1 } }
  );

  res.status(200).json({
    success: true,
    message: 'Bookmark removed successfully.',
  });
});

/**
 * GET /api/users/me/bookmarks
 * List the current user's bookmarks.
 */
const getMyBookmarks = asyncHandler(async (req, res) => {
  const bookmarks = await Bookmark.find({ user: req.user._id })
    .populate({
      path: 'post',
      match: { status: 'approved', isDeleted: false },
      populate: { path: 'author', select: 'username displayName avatarUrl' },
    })
    .sort({ createdAt: -1 });

  // If a bookmarked post later becomes hidden/deleted, skip it from the response.
  const visibleBookmarks = bookmarks.filter((bookmark) => bookmark.post);

  res.status(200).json({
    success: true,
    count: visibleBookmarks.length,
    bookmarks: visibleBookmarks.map(formatBookmark),
  });
});

module.exports = {
  createBookmark,
  deleteBookmark,
  getMyBookmarks,
};