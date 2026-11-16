const cloudinary = require('cloudinary').v2;
const { compressImage } = require('../utils/compressImage');
const AppError = require('../utils/error-handlers/AppError');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Compresses an uploaded (multer) file and stores it on Cloudinary.
// Resolves to the `{ secure_url, public_id }` shape stored on our models.
exports.uploadImage = async (file) => {
  try {
    const compressedImageBuffer = await compressImage(file.buffer);

    // compressImage always outputs JPEG
    const dataURI = `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;

    const { secure_url, public_id } = await cloudinary.uploader.upload(
      dataURI,
      { folder: 'Chatify-profiles' },
    );

    return { secure_url, public_id };
  } catch (error) {
    console.error('Image upload failed:', error.message);

    throw new AppError(502, 'Image upload failed, please try again');
  }
};

// Best effort: a leftover image on Cloudinary must not fail the request
exports.destroy = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Image delete failed:', error.message);
  }
};
