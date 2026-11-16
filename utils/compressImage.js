const sharp = require('sharp');

exports.compressImage = async (imagePath) => {
  try {
    const resizedImageBuffer = await sharp(imagePath)
      .rotate() // respect EXIF orientation from phone cameras
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return resizedImageBuffer;
  } catch (error) {
    console.error('Error compressing image:', error);

    throw error;
  }
};
