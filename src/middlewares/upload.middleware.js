const multer = require('multer');

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per file
const MAX_POST_IMAGES = 5;                    // max images per post upload request
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ── Storage ──────────────────────────────────────────────────────────────────
// Use memoryStorage so the file buffer is available at req.file(s).buffer.
// We never write temp files to disk before streaming to Cloudinary.
const storage = multer.memoryStorage();

// ── File Filter ──────────────────────────────────────────────────────────────
// Reject everything that is not in the allow-list of MIME types.
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Only image files are allowed (jpeg, png, webp, gif). Received: ${file.mimetype}`
      ),
      false
    );
  }
};

// ── Shared Error Message Map ──────────────────────────────────────────────────
const multerErrorMessages = (err) => ({
  LIMIT_FILE_SIZE: 'File is too large. Maximum allowed size is 2 MB.',
  LIMIT_FILE_COUNT: `Too many files. Maximum allowed is ${MAX_POST_IMAGES} images per request.`,
  LIMIT_UNEXPECTED_FILE: err.message || 'Unexpected file field.',
});

// ── Single-file Instance (avatar) ────────────────────────────────────────────
const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// ── Multi-file Instance (post images) ────────────────────────────────────────
const uploadMulti = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_POST_IMAGES,
  },
});

// ── Error Handler Wrapper ─────────────────────────────────────────────────────
/**
 * avatarUpload
 *
 * Express middleware that runs multer for a single field called "avatar".
 * Intercepts MulterError instances and converts them to friendly JSON responses
 * so they don't propagate as unhandled errors.
 *
 * Usage in routes:
 *   router.patch('/me/avatar', protect, avatarUpload, uploadAvatar);
 */
/**
 * avatarUpload
 *
 * Single-file upload middleware for the "avatar" field.
 * Converts MulterErrors to clean JSON 400 responses.
 *
 * Usage: router.patch('/me/avatar', protect, avatarUpload, uploadAvatar);
 */
const avatarUpload = (req, res, next) => {
  uploadSingle.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: multerErrorMessages(err)[err.code] || `Upload error: ${err.message}`,
      });
    }

    next(err);
  });
};

/**
 * postImagesUpload
 *
 * Multi-file upload middleware for the "images" field (up to 5 files).
 * Converts MulterErrors to clean JSON 400 responses.
 *
 * Usage: router.post('/:id/images', protect, ..., postImagesUpload, uploadPostImages);
 */
const postImagesUpload = (req, res, next) => {
  uploadMulti.array('images', MAX_POST_IMAGES)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: multerErrorMessages(err)[err.code] || `Upload error: ${err.message}`,
      });
    }

    next(err);
  });
};

module.exports = { avatarUpload, postImagesUpload };
