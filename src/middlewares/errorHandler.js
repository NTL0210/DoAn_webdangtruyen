// Global error handler: catches errors passed via next(err)
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose: invalid ObjectId in query/path params
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}.`;
  }

  // Mongoose: schema validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(' ');
  }

  // Mongo duplicate key (unique index)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyPattern || {})[0];
    message = duplicateField
      ? `Duplicate value for "${duplicateField}".`
      : 'Duplicate value violates a unique constraint.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only expose stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
