const Post = require('../models/post.model');
const asyncHandler = require('../utils/asyncHandler');
const { uploadBufferToCloudinary } = require('../utils/cloudinary.service');

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

const ALLOWED_POST_TYPES = ['story', 'artwork'];
const MAX_POST_TITLE_LENGTH = 150;
const MAX_POST_SUMMARY_LENGTH = 500;

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
  const { type, title, summary, content, tags, status } = req.body;
  const cleanType = typeof type === 'string' ? type.trim() : '';
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanSummary = typeof summary === 'string' ? summary.trim() : '';
  const cleanContent = typeof content === 'string' ? content.trim() : '';

  if (!cleanType || !cleanTitle) {
    return res.status(400).json({
      success: false,
      message: 'type and title are required.',
    });
  }

  if (!ALLOWED_POST_TYPES.includes(cleanType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post type. Use "story" or "artwork".',
    });
  }

  if (cleanTitle.length > MAX_POST_TITLE_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Title cannot exceed ${MAX_POST_TITLE_LENGTH} characters.`,
    });
  }

  if (cleanSummary.length > MAX_POST_SUMMARY_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Summary cannot exceed ${MAX_POST_SUMMARY_LENGTH} characters.`,
    });
  }

  if (cleanType === 'story' && !cleanContent) {
    return res.status(400).json({
      success: false,
      message: 'Story posts require non-empty content.',
    });
  }

  // Reject any attempt to set status on creation.
  if (status !== undefined && status !== 'draft') {
    return res.status(400).json({
      success: false,
      message: 'Posts are always created in "draft" status. Use POST /api/posts/:id/submit to move to pending.',
    });
  }

  // Always create posts as draft. Images are managed via POST /api/posts/:id/images.
  const post = await Post.create({
    author: req.user._id,
    type: cleanType,
    title: cleanTitle,
    summary: cleanSummary,
    content: cleanContent,
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
 * Public feed with search, tag filter, sort options, and pagination.
 *
 * Query parameters:
 *   search   - free-text search across title, summary, content (case-insensitive regex)
 *   tag      - filter by a single tag string, e.g. ?tag=fantasy
 *   sort     - "newest" (default) | "popular" | "trending"
 *                newest   → sort by createdAt desc
 *                popular  → sort by bookmarksCount, commentsCount, viewsCount desc
 *                trending → recent posts (last 7 days) ranked by engagement score
 *   page     - page number, default 1
 *   limit    - posts per page, default 10, max 50
 *
 * Examples:
 *   GET /api/posts
 *   GET /api/posts?search=romance
 *   GET /api/posts?tag=fantasy&page=2
 *   GET /api/posts?sort=popular
 *   GET /api/posts?sort=trending&limit=5
 */
const getPublicPosts = asyncHandler(async (req, res) => {
  const { search, tag, sort = 'newest', page = 1, limit = 10 } = req.query;

  // ── Sanitize pagination values ───────────────────────────────────────────
  // parseInt returns NaN for non-numeric strings; fall back to the default.
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip     = (pageNum - 1) * limitNum;

  // ── Build the filter object ──────────────────────────────────────────────
  // Always restrict to approved, non-deleted documents.
  const filter = {
    status:    'approved',
    isDeleted: false,
  };

  // Text search: use a case-insensitive regex so we don't rely on a text index.
  // This works out of the box without extra index setup, which is beginner-friendly.
  // Trade-off: for very large collections a $text index would be faster.
  if (search && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSearch, 'i');
    filter.$or = [
      { title:   regex },
      { summary: regex },
      { content: regex },
    ];
  }

  // Tag filter: tags is an array of strings on each post document.
  if (tag && tag.trim()) {
    filter.tags = tag.trim();
  }

  // ── Build the sort object ────────────────────────────────────────────────
  let sortObj;

  if (sort === 'popular') {
    // Rank by engagement metrics in order of significance.
    sortObj = { bookmarksCount: -1, commentsCount: -1, viewsCount: -1 };

  } else if (sort === 'trending') {
    // Trending: only look at posts published in the last 7 days, then rank by engagement.
    // This is a simple but effective heuristic — no aggregation pipeline required.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Narrow the filter to recent posts only for the trending window.
    filter.publishedAt = { $gte: sevenDaysAgo };
    sortObj = { bookmarksCount: -1, commentsCount: -1, viewsCount: -1, publishedAt: -1 };

  } else {
    // Default: "newest" — most recently created first.
    sortObj = { createdAt: -1 };
  }

  // ── Execute both queries in parallel for performance ─────────────────────
  // One query fetches the page of posts; the other gets the total count for metadata.
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .populate('author', 'username displayName avatarUrl')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum),

    Post.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    success: true,
    pagination: {
      page:       pageNum,
      limit:      limitNum,
      total,
      totalPages,
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
  const { type, title, summary, content, tags, status } = req.body;

  // Reject any attempt to change status through PUT.
  if (status !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'Status cannot be changed through this endpoint. Use POST /api/posts/:id/submit to request review.',
    });
  }

  if (type !== undefined) {
    const cleanType = typeof type === 'string' ? type.trim() : '';
    if (!ALLOWED_POST_TYPES.includes(cleanType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post type. Use "story" or "artwork".',
      });
    }
    req.post.type = cleanType;
  }

  if (title !== undefined) {
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty.',
      });
    }
    if (cleanTitle.length > MAX_POST_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Title cannot exceed ${MAX_POST_TITLE_LENGTH} characters.`,
      });
    }
    req.post.title = cleanTitle;
  }

  if (summary !== undefined) {
    const cleanSummary = typeof summary === 'string' ? summary.trim() : '';
    if (cleanSummary.length > MAX_POST_SUMMARY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Summary cannot exceed ${MAX_POST_SUMMARY_LENGTH} characters.`,
      });
    }
    req.post.summary = cleanSummary;
  }

  if (content !== undefined) {
    req.post.content = typeof content === 'string' ? content.trim() : '';
  }

  // Images are managed via POST /api/posts/:id/images — not through PUT.

  if (tags !== undefined) {
    req.post.tags = normalizeStringArray(tags);
  }

  if (req.post.type === 'story') {
    const cleanContent = typeof req.post.content === 'string' ? req.post.content.trim() : '';
    if (!cleanContent) {
      return res.status(400).json({
        success: false,
        message: 'Story posts require non-empty content.',
      });
    }
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

  if (req.post.type === 'story') {
    const cleanContent = typeof req.post.content === 'string' ? req.post.content.trim() : '';
    if (!cleanContent) {
      return res.status(400).json({
        success: false,
        message: 'Story posts must include non-empty content before submission.',
      });
    }
  }

  if (req.post.type === 'artwork') {
    if (!Array.isArray(req.post.images) || req.post.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Artwork posts must include at least one uploaded image before submission.',
      });
    }
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
 * POST /api/posts/:id/images
 * Upload up to 5 images for a post and append them to post.images.
 *
 * Flow:
 *  1. multer (postImagesUpload) has already validated file type, size, and count.
 *  2. All buffers are uploaded to Cloudinary in parallel.
 *  3. Results ({ url, publicId }) are pushed into post.images.
 *  4. The updated post is returned.
 */
const uploadPostImages = asyncHandler(async (req, res) => {
  const { post } = req; // populated by loadPost middleware

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No images uploaded. Attach image files using the "images" field.',
    });
  }

  // Upload all received buffers to Cloudinary in parallel for speed
  const uploadResults = await Promise.all(
    req.files.map((file) =>
      uploadBufferToCloudinary(file.buffer, {
        folder: `webtruyen/posts/${post._id}`,
        resource_type: 'image',
        transformation: [
          // Auto-optimize quality and format (e.g. serve WebP where supported)
          { quality: 'auto', fetch_format: 'auto' },
        ],
      })
    )
  );

  // Map Cloudinary result to our schema shape and append to the existing images array
  const newImages = uploadResults.map((result) => ({
    url: result.secure_url,
    publicId: result.public_id,
  }));

  post.images.push(...newImages);
  await post.save();
  await post.populate('author', 'username displayName avatarUrl');

  res.status(200).json({
    success: true,
    message: `${newImages.length} image(s) uploaded successfully.`,
    post: formatPost(post),
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
  uploadPostImages,
};
