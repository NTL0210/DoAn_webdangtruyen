const cloudinary = require('../config/cloudinary');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { uploadBufferToCloudinary } = require('../utils/cloudinary.service');

// ── Controller ────────────────────────────────────────────────────────────────
/**
 * uploadAvatar
 *
 * PATCH /api/users/me/avatar
 *
 * Flow:
 *  1. Verify a file was received (multer already validated type + size).
 *  2. If the user already has an avatar stored on Cloudinary, delete the old one.
 *  3. Upload the new buffer to Cloudinary under the "avatars" folder.
 *  4. Persist secure_url → avatarUrl and public_id → avatarPublicId on the user.
 *  5. Return the updated public profile.
 */
const uploadAvatar = asyncHandler(async (req, res) => {
  // 1. Ensure multer actually received a file
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach an image file with field name "avatar".',
    });
  }

  const user = req.user; // populated by protect middleware

  // 2. Delete previous avatar from Cloudinary to avoid orphaned assets
  if (user.avatarPublicId) {
    try {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    } catch (err) {
      // Non-fatal: log the failure but continue with the upload
      console.error(`[uploadAvatar] Failed to delete old avatar (${user.avatarPublicId}):`, err.message);
    }
  }

  // 3. Upload new image buffer to Cloudinary
  const result = await uploadBufferToCloudinary(req.file.buffer, {
    folder: 'webtruyen/avatars',     // organise under a named folder
    public_id: `user_${user._id}`,   // deterministic ID → overwrites previous even if destroy skipped
    overwrite: true,
    resource_type: 'image',
    // Transformation: resize to a square thumbnail to keep storage lean
    transformation: [
      { width: 256, height: 256, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  // 4. Persist the new URL and public_id
  user.avatarUrl = result.secure_url;
  user.avatarPublicId = result.public_id;
  await user.save();

  // 5. Return updated profile (toPublicProfile excludes password automatically)
  return res.status(200).json({
    success: true,
    message: 'Avatar updated successfully.',
    data: { user: user.toPublicProfile() },
  });
});

/**
 * updateMyProfile
 *
 * PATCH /api/users/me/profile
 * Allows updating only beginner-safe profile fields:
 * - displayName (trimmed, max 50)
 * - bio (trimmed, max 300)
 *
 * Explicitly blocks role/password changes.
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const { displayName, bio, role, password } = req.body;
  const user = req.user;

  if (role !== undefined || password !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'role and password cannot be changed from this endpoint.',
    });
  }

  if (displayName === undefined && bio === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Provide at least one field to update: displayName or bio.',
    });
  }

  if (displayName !== undefined) {
    if (typeof displayName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'displayName must be a string.',
      });
    }

    const cleanDisplayName = displayName.trim();
    if (!cleanDisplayName) {
      return res.status(400).json({
        success: false,
        message: 'displayName cannot be empty.',
      });
    }

    if (cleanDisplayName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'displayName cannot exceed 50 characters.',
      });
    }

    user.displayName = cleanDisplayName;
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'bio must be a string.',
      });
    }

    const cleanBio = bio.trim();
    if (cleanBio.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'bio cannot exceed 300 characters.',
      });
    }

    user.bio = cleanBio;
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    data: { user: user.toPublicProfile() },
  });
});

module.exports = { uploadAvatar, updateMyProfile };
