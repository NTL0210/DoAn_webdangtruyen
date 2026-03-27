const mongoose = require('mongoose');

/**
 * Follow Schema
 * Stores user-to-user follow relationships.
 */
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower is required'],
      index: true,
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following user is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can follow another user only once.
followSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follow = mongoose.model('Follow', followSchema);

module.exports = Follow;