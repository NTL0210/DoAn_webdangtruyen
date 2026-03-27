const mongoose = require('mongoose');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../utils/notification.service');

const formatUserSummary = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    role: user.role,
    createdAt: user.createdAt,
  };
};

/**
 * POST /api/users/:id/follow
 * Follow another user.
 */
const followUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  if (String(req.user._id) === String(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'You cannot follow yourself.',
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  const existingFollow = await Follow.findOne({
    follower: req.user._id,
    following: targetUserId,
  });

  if (existingFollow) {
    return res.status(409).json({
      success: false,
      message: 'You are already following this user.',
    });
  }

  let follow;

  try {
    follow = await Follow.create({
      follower: req.user._id,
      following: targetUserId,
    });
  } catch (error) {
    // The unique index is the final guard against duplicate follows.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already following this user.',
      });
    }

    throw error;
  }

  await User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } });
  await User.updateOne({ _id: targetUserId }, { $inc: { followersCount: 1 } });

  const updatedFollower = await User.findById(req.user._id);
  const updatedFollowing = await User.findById(targetUserId);

  await createNotification({
    recipient: targetUserId,
    sender: req.user._id,
    type: 'follow',
    message: `${req.user.displayName || req.user.username} started following you.`,
  });

  res.status(201).json({
    success: true,
    message: 'User followed successfully.',
    follow: {
      id: follow._id,
      follower: formatUserSummary(updatedFollower),
      following: formatUserSummary(updatedFollowing),
      createdAt: follow.createdAt,
    },
  });
});

/**
 * DELETE /api/users/:id/follow
 * Unfollow another user.
 */
const unfollowUser = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  const follow = await Follow.findOneAndDelete({
    follower: req.user._id,
    following: targetUserId,
  });

  if (!follow) {
    return res.status(404).json({
      success: false,
      message: 'Follow relationship not found.',
    });
  }

  await User.updateOne(
    { _id: req.user._id, followingCount: { $gt: 0 } },
    { $inc: { followingCount: -1 } }
  );
  await User.updateOne(
    { _id: targetUserId, followersCount: { $gt: 0 } },
    { $inc: { followersCount: -1 } }
  );

  res.status(200).json({
    success: true,
    message: 'User unfollowed successfully.',
  });
});

/**
 * GET /api/users/:id/followers
 * List users who follow the target user.
 */
const getFollowers = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  const followers = await Follow.find({ following: targetUserId })
    .populate('follower', 'username displayName avatarUrl bio role createdAt')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: followers.length,
    followers: followers.map((follow) => ({
      id: follow._id,
      createdAt: follow.createdAt,
      user: formatUserSummary(follow.follower),
    })),
  });
});

/**
 * GET /api/users/:id/following
 * List users that the target user is following.
 */
const getFollowing = asyncHandler(async (req, res) => {
  const targetUserId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id.',
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found.',
    });
  }

  const following = await Follow.find({ follower: targetUserId })
    .populate('following', 'username displayName avatarUrl bio role createdAt')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: following.length,
    following: following.map((follow) => ({
      id: follow._id,
      createdAt: follow.createdAt,
      user: formatUserSummary(follow.following),
    })),
  });
});

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
};