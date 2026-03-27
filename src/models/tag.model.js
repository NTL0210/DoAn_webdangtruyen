const mongoose = require('mongoose');

/**
 * Tag Schema
 * Simple tag management for categorizing posts.
 * Posts reference tags by name/slug string for simplicity.
 */
const tagSchema = new mongoose.Schema(
  {
    // Tag name: "Fantasy", "Romance", etc.
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      unique: true,
      trim: true,
      maxlength: [50, 'Tag name cannot exceed 50 characters'],
    },

    // URL-friendly slug: "fantasy", "romance"
    // Automatically generated from name
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Optional description for the tag
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Tag description cannot exceed 200 characters'],
      default: '',
    },

    // How many posts use this tag
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug from name before saving
tagSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  next();
});

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag;
