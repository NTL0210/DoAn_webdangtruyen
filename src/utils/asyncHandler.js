/**
 * Wraps async route handlers to automatically forward errors to next()
 * Usage: router.get('/path', asyncHandler(myAsyncController))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
