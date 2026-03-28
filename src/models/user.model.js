const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * User Schema
 * Represents a registered member of the comic platform.
 */
const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      // Only allow letters, numbers, underscores, and hyphens
      match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    // Password is stored as a bcrypt hash — never the plain-text value
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // Exclude password from query results by default
      select: false,
    },

    // ── Profile ─────────────────────────────────────────────────────────────
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },

    avatarUrl: {
      type: String,
      default: '',
    },

    // Cloudinary public_id — used to delete the old image before uploading a new one
    avatarPublicId: {
      type: String,
      default: '',
    },

    bio: {
      type: String,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
      default: '',
    },

    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Refresh token hash — stored so logout can invalidate the token server-side.
    // The plain token lives only in the httpOnly cookie on the client.
    // select: false ensures this never leaks in normal query results.
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    // ── Permissions ──────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
  },
  {
    // Automatically adds createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// ── Pre-save Hook: Hash password before storing ─────────────────────────────
// This runs automatically every time a user document is saved.
// We only re-hash if the password field was actually changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // saltRounds: 12 is a good balance between security and performance
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance Method: Compare a plain-text password against the hash ─────────
// Usage: const isMatch = await user.comparePassword('plain-text');
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Return a safe public profile (no password) ─────────────
userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    role: this.role,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
