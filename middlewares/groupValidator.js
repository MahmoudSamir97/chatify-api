const { isValidObjectId } = require('mongoose');
const User = require('../models/userModel');
const AppError = require('../utils/error-handlers/AppError.js');
const { catchAsync } = require('../utils/error-handlers/catchAsync.js');

const MIN_GROUP_MEMBERS = 2; // besides the creator

const groupValidator = catchAsync(async (req, res, next) => {
  const { users, groupName } = req.body;

  if (!users || !groupName?.trim())
    return next(new AppError(400, 'Please fill all the fields'));

  // Sent as a comma-separated string from multipart/form-data
  const list = Array.isArray(users) ? users : String(users).split(',');
  const creatorId = String(req.user._id);

  const memberIds = [
    ...new Set(list.map((id) => String(id).trim()).filter(Boolean)),
  ].filter((id) => id !== creatorId);

  if (!memberIds.every(isValidObjectId))
    return next(new AppError(400, 'Invalid user id provided'));

  if (memberIds.length < MIN_GROUP_MEMBERS)
    return next(
      new AppError(
        400,
        `At least ${MIN_GROUP_MEMBERS} other users are required to form a group chat`,
      ),
    );

  const existingCount = await User.countDocuments({ _id: { $in: memberIds } });
  if (existingCount !== memberIds.length)
    return next(new AppError(404, 'Some of the selected users do not exist'));

  req.users = [...memberIds, creatorId];

  next();
});

module.exports = groupValidator;
