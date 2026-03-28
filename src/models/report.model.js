const mongoose = require('mongoose');

/**
 * Report Schema
 * Stores post reports submitted by users for moderation review.
 */
const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post is required'],
      index: true,
    },

    reason: {
      type: String,
      required: [true, 'Report reason is required'],
      trim: true,
      maxlength: [120, 'Reason cannot exceed 120 characters'],
    },

    details: {
      type: String,
      trim: true,
      maxlength: [1000, 'Details cannot exceed 1000 characters'],
      default: '',
    },

    status: {
      type: String,
      enum: ['pending', 'reviewed', 'rejected', 'action_taken'],
      default: 'pending',
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reports from the same user for the same post.
reportSchema.index({ reporter: 1, post: 1 }, { unique: true });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
