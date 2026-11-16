const User = require('../models/userModel');
const { uploadImage, destroy } = require('../services/cloudinary');
const AppError = require('../utils/error-handlers/AppError');
const { catchAsync } = require('../utils/error-handlers/catchAsync');

const SEARCH_RESULTS_LIMIT = 20;

// Treat the search text literally (no regex injection / ReDoS)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getUsersForSidebar = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user._id;

  const filteredUsers = await User.find({
    _id: { $ne: loggedInUserId },
  });

  res.status(200).json(filteredUsers);
});

exports.getSearchedUsers = catchAsync(async (req, res, next) => {
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (!search) return res.status(200).json([]);

  const pattern = new RegExp(escapeRegex(search), 'i');

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ username: pattern }, { email: pattern }],
  })
    .select('username email fullname profileImage')
    .limit(SEARCH_RESULTS_LIMIT);

  res.status(200).json(users);
});

exports.showProfile = catchAsync(async (req, res, next) => {
  res.status(200).json({ user: req.user });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const updates = {};

  ['fullname', 'username', 'phoneNumber', 'bio'].forEach((field) => {
    const value = req.body[field];
    // Empty fullname/username means "unchanged", while bio/phone can be cleared
    const isRequiredField = field === 'fullname' || field === 'username';

    if (value === undefined || (isRequiredField && value === '')) return;

    updates[field] = value;
  });

  const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'data updated successfully',
    updatedUser,
  });
});

exports.addProfileImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError(400, 'No image provided'));

  const oldImageId = req.user.profileImage?.public_id;
  const profileImage = await uploadImage(req.file);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profileImage },
    { new: true },
  );

  if (oldImageId) destroy(oldImageId);

  res.status(200).json({ status: 'success', user });
});

exports.removeProfileImage = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (user.profileImage?.public_id) await destroy(user.profileImage.public_id);

  user.profileImage = {
    public_id: '',
    secure_url: '',
  };

  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Image deleted successfully',
    user,
  });
});
