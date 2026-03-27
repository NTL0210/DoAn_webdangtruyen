const Tag = require('../models/tag.model');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/tags
 * List all available tags, sorted by usage count (most used first).
 */
const getTags = asyncHandler(async (req, res) => {
  const tags = await Tag.find()
    .sort({ usageCount: -1, createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: tags.length,
    tags,
  });
});

module.exports = { getTags };
