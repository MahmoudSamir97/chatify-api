const multer = require('multer');
const AppError = require('../utils/error-handlers/AppError');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const fileStorageEngine = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);

  cb(new AppError(400, 'Only image files are allowed'));
};

const upload = multer({
  storage: fileStorageEngine,
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: imageFilter,
});

module.exports = upload;
