const cloudinary = require('../config/cloudinary');

/**
 * uploadBufferToCloudinary
 *
 * Wraps cloudinary.uploader.upload_stream in a Promise so it can be awaited.
 * Streams an in-memory Buffer directly to Cloudinary — no temp file on disk.
 *
 * @param {Buffer} buffer      - File buffer from multer memoryStorage
 * @param {object} options     - Options forwarded to cloudinary upload_stream
 * @returns {Promise<object>}  - Cloudinary upload result (includes secure_url, public_id, etc.)
 */
const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

module.exports = { uploadBufferToCloudinary };
