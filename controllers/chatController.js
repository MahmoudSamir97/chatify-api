const { isValidObjectId } = require('mongoose');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const { uploadImage, destroy } = require('../services/cloudinary');
const AppError = require('../utils/error-handlers/AppError');
const { catchAsync } = require('../utils/error-handlers/catchAsync');

const populateChat = (query) => query.populate('users').populate('groupAdmin');

exports.createPrivateChat = catchAsync(async (req, res, next) => {
  const { userId } = req.body; // validated by the findPrivateChat middleware

  if (!(await User.exists({ _id: userId })))
    return next(new AppError(404, 'User not found'));

  const newChat = await Chat.create({
    isGroupChat: false,
    users: [req.user._id, userId],
  });

  const newChatWithPopulated = await Chat.findById(newChat._id).populate(
    'users',
  );

  res.status(201).json({ newChatWithPopulated });
});

exports.fetchChats = catchAsync(async (req, res, next) => {
  const userChats = await populateChat(Chat.find({ users: req.user._id }))
    .populate('latestMessage')
    .sort({ updatedAt: -1 });

  const populatedChats = await User.populate(userChats, {
    path: 'latestMessage.sender',
    select: 'username profileImage email',
  });

  res.status(200).json({ populatedChats });
});

exports.createGroupChat = catchAsync(async (req, res) => {
  const { groupName } = req.body;

  const chatImage = req.file ? await uploadImage(req.file) : undefined;

  const groupChat = await Chat.create({
    chatName: groupName.trim(),
    users: req.users,
    isGroupChat: true,
    chatImage,
    groupAdmin: req.user._id,
  });

  const populatedGroupChat = await populateChat(Chat.findById(groupChat._id));

  res.status(201).json(populatedGroupChat);
});

exports.renameGroup = catchAsync(async (req, res, next) => {
  const chatName = req.body.chatName?.trim();

  if (!chatName) return next(new AppError(400, 'Group name is required'));

  const updatedChat = await populateChat(
    Chat.findByIdAndUpdate(req.chat._id, { chatName }, { new: true }),
  );

  res.status(200).json({ updatedChat });
});

exports.addToGroup = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  if (!isValidObjectId(userId) || !(await User.exists({ _id: userId })))
    return next(new AppError(404, 'User not found'));

  if (req.chat.users.some((id) => id.equals(userId)))
    return next(new AppError(400, 'User already in group chat'));

  const updatedChat = await populateChat(
    Chat.findByIdAndUpdate(
      req.chat._id,
      { $addToSet: { users: userId } },
      { new: true },
    ),
  );

  res.status(200).json({ updatedChat });
});

exports.removeFromGroup = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  const { chat, user } = req;

  const isAdmin = chat.groupAdmin.equals(user._id);
  const isLeaving = String(userId) === String(user._id);

  if (!isAdmin && !isLeaving)
    return next(new AppError(403, 'Only the group admin can remove users'));

  if (chat.groupAdmin.equals(userId))
    return next(new AppError(400, 'Cannot remove group admin'));

  const updatedChat = await populateChat(
    Chat.findByIdAndUpdate(
      chat._id,
      { $pull: { users: userId } },
      { new: true },
    ),
  );

  res.status(200).json({ updatedChat });
});

exports.changeGroupImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError(400, 'No image provided'));

  const oldImageId = req.chat.chatImage?.public_id;
  const chatImage = await uploadImage(req.file);

  const updatedChat = await populateChat(
    Chat.findByIdAndUpdate(req.chat._id, { chatImage }, { new: true }),
  );

  if (oldImageId) destroy(oldImageId);

  res.status(200).json({ updatedChat });
});

exports.deleteGroup = catchAsync(async (req, res, next) => {
  const { chat } = req;

  await Promise.all([
    Message.deleteMany({ chat: chat._id }),
    Chat.findByIdAndDelete(chat._id),
  ]);

  if (chat.chatImage?.public_id) destroy(chat.chatImage.public_id);

  res.status(200).json({ message: 'Group deleted successfully' });
});
