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
 * 
 * All new posts are created in "draft" status.
 * Status transitions must use dedicated endpoints:
 * - POST /api/posts/:id/submit (draft/rejected -> pending)
 * - PATCH /api/admin/posts/:id/approve (pending -> approved)
 * - PATCH /api/admin/posts/:id/reject (pending -> rejected)
 */
const createPost = asyncHandler(async (req, res) => {
  const { type, title, summary, content, images, tags, status } = req.body;

  if (!type || !title) {
    return res.status(400).json({
      success: false,
      message: 'type and title are required.',
    });
  }

  // Reject any attempt to set status on creation.
  if (status !== undefined && status !== 'draft') {
    return res.status(400).json({
      success: false,
      message: 'Posts are always created in "draft" status. Use POST /api/posts/:id/submit to move to pending.',
    });
  }

  // Always create posts as draft.
  const post = await Post.create({
    author: req.user._id,
    type,
    title,
    summary: summary || '',
    content: content || '',
    images: normalizeStringArray(images),
    tags: normalizeStringArray(tags),
    status: 'draft',
    publishedAt: null,
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
 * Public feed with search, filtering, sorting, and pagination.
 * 
 * Query parameters:
 *   - search: search by title, summary, or content
 *   - tag: filter by a single tag name
 *   - sort: 'newest' (default) or 'oldest'
 *   - page: page number (default 1)
 *   - limit: posts per page (default 10, max 50)
 * 
 * Examples:
 *   GET /api/posts
 *   GET /api/posts?search=romance
 *   GET /api/posts?tag=fantasy&page=2
 *   GET /api/posts?search=art&limit=20
 */
const getPublicPosts = asyncHandler(async (req, res) => {
  const { search, tag, sort = 'newest', page = 1, limit = 10 } = req.query;

  // Validate and sanitize pagination parameters
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Build the base query for approved, non-deleted posts
  let query = Post.find({
    status: 'approved',
    isDeleted: false,
  });

  // Add full-text search if provided
  if (search && search.trim()) {
    query = query.find({
      $text: { $search: search.trim() },
    });
  }

  // Add tag filter if provided
  if (tag && tag.trim()) {
    query = query.find({
      tags: { $in: [tag.trim()] },
    });
  }

  // Determine sort order
  const sortOrder = sort === 'oldest' ? 1 : -1;

  // Execute query with populate, sort, skip, and limit
  const posts = await query
    .populate('author', 'username displayName avatarUrl')
    .sort({ publishedAt: sortOrder, createdAt: sortOrder })
    .skip(skip)
    .limit(limitNum);

  // Get total count for pagination metadata
  const totalCount = await Post.countDocuments({
    status: 'approved',
    isDeleted: false,
    ...(search && search.trim() && { $text: { $search: search.trim() } }),
    ...(tag && tag.trim() && { tags: { $in: [tag.trim()] } }),
  });

  const totalPages = Math.ceil(totalCount / limitNum);

  res.status(200).json({
    success: true,
    pagination: {
      currentPage: pageNum,
      totalPages,
      limit: limitNum,
      totalCount,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
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
 * Owners can update their own posts: type, title, summary, content, images, tags.
 * 
 * Status cannot be changed through PUT. Use dedicated status transition endpoints:
 * - POST /api/posts/:id/submit (draft/rejected -> pending)
 * - PATCH /api/admin/posts/:id/approve (pending -> approved)
 * - PATCH /api/admin/posts/:id/reject (pending -> rejected)
 */
const updatePost = asyncHandler(async (req, res) => {
  const { type, title, summary, content, images, tags, status } = req.body;

  // Reject any attempt to change status through PUT.
  if (status !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'Status cannot be changed through this endpoint. Use POST /api/posts/:id/submit to request review.',
    });
  }

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
