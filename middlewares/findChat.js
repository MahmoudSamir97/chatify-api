const { isValidObjectId } = require('mongoose');
const Chat = require('../models/chatModel.js');
const User = require('../models/userModel.js');
const AppError = require('../utils/error-handlers/AppError.js');
const { catchAsync } = require('../utils/error-handlers/catchAsync.js');

const findPrivateChat = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId || !isValidObjectId(userId))
    return next(new AppError(400, 'A valid user id is required'));

  if (String(userId) === String(req.user._id))
    return next(new AppError(400, 'You cannot start a chat with yourself'));

  let newChatWithPopulated = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [req.user._id, userId] },
  })
    .populate('users')
    .populate('latestMessage');

  newChatWithPopulated = await User.populate(newChatWithPopulated, {
    path: 'latestMessage.sender',
    select: 'username profileImage email',
  });

  if (newChatWithPopulated)
    return res.status(200).json({ newChatWithPopulated });

  next();
});

module.exports = findPrivateChat;
