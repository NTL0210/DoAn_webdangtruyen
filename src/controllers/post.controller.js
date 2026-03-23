const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Small helper to clean string arrays like tags/images.
 * It removes empty values and trims spaces.
 */
const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

/**
 * Public shape used in API responses.
 * If the author is populated, include a small profile snapshot.
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
 * POST /api/posts
 * Create a new post for the currently authenticated user.
 */
const createPost = asyncHandler(async (req, res) => {
  const { type, title, summary, content, images, tags, status } = req.body;

  if (!type || !title) {
    return res.status(400).json({
      success: false,
      message: 'type and title are required.',
    });
  }

  // Normal users should not be able to mark their own content as approved/rejected.
  const allowedOwnerStatuses = ['draft', 'pending'];
  const nextStatus = status || 'draft';

  if (!allowedOwnerStatuses.includes(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: 'You can only create posts with status draft or pending.',
    });
  }

  const post = await Post.create({
    author: req.user._id,
    type,
    title,
    summary: summary || '',
    content: content || '',
    images: normalizeStringArray(images),
    tags: normalizeStringArray(tags),
    status: nextStatus,
    publishedAt: nextStatus === 'approved' ? new Date() : null,
  });

  const createdPost = await Post.findById(post._id).populate('author', 'username displayName avatarUrl');

  res.status(201).json({
    success: true,
    message: 'Post created successfully.',
    post: formatPost(createdPost),
  });
});

/**
 * GET /api/posts
 * Public feed: only approved and non-deleted posts are returned.
 */
const getPublicPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({
    status: 'approved',
    isDeleted: false,
  })
    .populate('author', 'username displayName avatarUrl')
    .sort({ publishedAt: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: posts.length,
    posts: posts.map(formatPost),
  });
});

/**
 * GET /api/posts/:id
 * Public users can view approved posts.
 * Owners can also view their own posts in non-public statuses.
 */
const getPostById = asyncHandler(async (req, res) => {
  const isOwner = req.user && String(req.post.author._id) === String(req.user._id);
  const isPubliclyVisible = req.post.status === 'approved';

  if (!isPubliclyVisible && !isOwner) {
    return res.status(404).json({
      success: false,
      message: 'Post not found.',
    });
  }

  // Count a view only for publicly visible posts.
  if (isPubliclyVisible) {
    req.post.viewsCount += 1;
    await req.post.save();
    await req.post.populate('author', 'username displayName avatarUrl');
  }

  res.status(200).json({
    success: true,
    post: formatPost(req.post),
  });
});

/**
 * PUT /api/posts/:id
 * Owners can update only their own non-deleted posts.
 */
const updatePost = asyncHandler(async (req, res) => {
  const { type, title, summary, content, images, tags, status } = req.body;

  if (type !== undefined) {
    req.post.type = type;
  }

  if (title !== undefined) {
    req.post.title = title;
  }

  if (summary !== undefined) {
    req.post.summary = summary;
  }

  if (content !== undefined) {
    req.post.content = content;
  }

  if (images !== undefined) {
    req.post.images = normalizeStringArray(images);
  }

  if (tags !== undefined) {
    req.post.tags = normalizeStringArray(tags);
  }

  if (status !== undefined) {
    const allowedOwnerStatuses = ['draft', 'pending'];

    if (!allowedOwnerStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'You can only update a post to draft or pending status.',
      });
    }

    req.post.status = status;
    req.post.publishedAt = null;
  }

  const updatedPost = await req.post.save();
  await updatedPost.populate('author', 'username displayName avatarUrl');

  res.status(200).json({
    success: true,
    message: 'Post updated successfully.',
    post: formatPost(updatedPost),
  });
});

/**
 * DELETE /api/posts/:id
 * Soft delete only: mark the document as deleted instead of removing it.
 */
const deletePost = asyncHandler(async (req, res) => {
  req.post.isDeleted = true;
  req.post.publishedAt = null;
  await req.post.save();

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully.',
  });
});

/**
 * POST /api/posts/:id/submit
 * Owners can submit a draft/rejected post for review.
 * This changes status -> pending.
 */
const submitPostForReview = asyncHandler(async (req, res) => {
  const allowedTransitions = ['draft', 'rejected'];

  if (!allowedTransitions.includes(req.post.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot submit post in "${req.post.status}" status. Only draft or rejected posts can be submitted.`,
    });
  }

  req.post.status = 'pending';
  req.post.publishedAt = null;

  const updatedPost = await req.post.save();
  await updatedPost.populate('author', 'username displayName avatarUrl');

  res.status(200).json({
    success: true,
    message: 'Post submitted for review successfully.',
    post: formatPost(updatedPost),
  });
});

/**
 * GET /api/users/me/posts
 * Owners can list all of their own non-deleted posts in any status.
 */
const getMyPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({
    author: req.user._id,
    isDeleted: false,
  })
    .populate('author', 'username displayName avatarUrl')
    .sort({ updatedAt: -1, createdAt: -1 });

  res.status(200).json({
    success: true,
    count: posts.length,
    posts: posts.map(formatPost),
  });
});

module.exports = {
  createPost,
  getPublicPosts,
  getPostById,
  updatePost,
  deletePost,
  submitPostForReview,
  getMyPosts,
};
