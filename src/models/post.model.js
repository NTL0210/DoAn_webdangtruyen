const mongoose = require('mongoose');

/**
 * Post Schema
 * Stores stories and artwork created by users on the platform.
 */
const postSchema = new mongoose.Schema(
  {
    // The user who created this post
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },

    // A post can be either a written story or an artwork post
    type: {
      type: String,
      enum: ['story', 'artwork'],
      required: [true, 'Post type is required'],
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
      default: '',
    },

    // Main body of the post. For story posts this is usually text.
    // For artwork posts this can hold description or additional details.
    content: {
      type: String,
      trim: true,
      default: '',
    },

    // List of image URLs attached to the post
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value),
        message: 'Images must be an array of strings',
      },
    },

    // Simple searchable labels like ["fantasy", "fanart"]
    tags: {
      type: [String],
      default: [],
    },

    // Moderation / publishing workflow
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },

    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    bookmarksCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Filled when a post becomes publicly visible
    publishedAt: {
      type: Date,
      default: null,
    },

    // Soft-delete flag. We keep the document in the database.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for public listing queries
postSchema.index({ status: 1, isDeleted: 1, publishedAt: -1, createdAt: -1 });

// Index on tags for filtering by tag
postSchema.index({ tags: 1 });

// Text index for full-text search on title, summary, content
postSchema.index({ title: 'text', summary: 'text', content: 'text' });

// Format a safe JSON response shape for the API
postSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    author: this.author,
    type: this.type,
    title: this.title,
    summary: this.summary,
    content: this.content,
    images: this.images,
    tags: this.tags,
    status: this.status,
    viewsCount: this.viewsCount,
    commentsCount: this.commentsCount,
    bookmarksCount: this.bookmarksCount,
    publishedAt: this.publishedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
