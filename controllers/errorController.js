const AppError = require('../utils/error-handlers/AppError');

const handleCastErrorFromDB = (err) =>
  new AppError(400, `Invalid ${err.path} with value ${err.value}`);

const handleDuplicateFieldsFromDB = (err) => {
  const fieldname = Object.keys(err.keyValue)[0];

  return new AppError(
    400,
    `Duplicate ${fieldname} value, please choose unique value`,
  );
};

const handleValidationsErrorFromDB = (err) => {
  const errors = Object.values(err.errors).map((item) => item.message);

  return new AppError(400, `Invalid input data. ${errors.join('. ')}`);
};

// Translate known library errors into operational AppErrors.
// Returns null for unexpected errors (bugs), which must not leak details.
const toOperationalError = (err) => {
  if (err.isOperational) return err;
  if (err.name === 'CastError') return handleCastErrorFromDB(err);
  if (err.code === 11000) return handleDuplicateFieldsFromDB(err);
  if (err.name === 'ValidationError') return handleValidationsErrorFromDB(err);
  if (err.name === 'JsonWebTokenError')
    return new AppError(401, 'Invalid token, please log in again');
  if (err.name === 'TokenExpiredError')
    return new AppError(401, 'Your session has expired, please log in again');
  if (err.name === 'MulterError') return new AppError(400, err.message);
  // body-parser errors (malformed JSON, payload too large, ...)
  if (err.expose && err.status < 500)
    return new AppError(err.status, err.message);

  return null;
};

exports.globalErrorHandler = (err, req, res, next) => {
  const operationalError = toOperationalError(err);

  if (!operationalError) console.error('Unexpected error 💥', err);

  if (process.env.NODE_ENV === 'development') {
    const error = operationalError || err;

    return res.status(error.statusCode || 500).json({
      status: error.status || 'error',
      message: error.message,
      stack: err.stack,
    });
  }

  if (operationalError) {
    return res.status(operationalError.statusCode).json({
      status: operationalError.status,
      message: operationalError.message,
    });
  }

  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};
