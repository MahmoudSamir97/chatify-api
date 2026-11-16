const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const User = require('../models/userModel');
const AppError = require('../utils/error-handlers/AppError');
const { catchAsync } = require('../utils/error-handlers/catchAsync');

const MAX_MESSAGE_LENGTH = 5000;

exports.sendMessage = catchAsync(async (req, res, next) => {
  const content =
    typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const { chat } = req;

  if (!content) return next(new AppError(400, 'Message content is required'));

  if (content.length > MAX_MESSAGE_LENGTH)
    return next(
      new AppError(
        400,
        `Message is longer than ${MAX_MESSAGE_LENGTH} characters`,
      ),
    );

  let newMessage = await Message.create({
    sender: req.user._id,
    chat: chat._id,
    content,
  });

  newMessage = await newMessage.populate('sender', 'username profileImage');

  newMessage = await newMessage.populate('chat');

  newMessage = await User.populate(newMessage, {
    path: 'chat.users',
    select: 'username profileImage email',
  });

  await Chat.findByIdAndUpdate(chat._id, {
    latestMessage: newMessage._id,
  });

  // Deliver in real time from the server, using data we persisted ourselves
  // (never relay a client-provided payload to other users).
  const io = req.app.get('io');

  chat.users
    .filter((userId) => !userId.equals(req.user._id))
    .forEach((userId) =>
      io?.to(String(userId)).emit('message received', newMessage),
    );

  res.status(201).json({ newMessage });
});

exports.getMessages = catchAsync(async (req, res, next) => {
  const messages = await Message.find({ chat: req.chat._id })
    .sort({ createdAt: 1 })
    .populate('sender', 'username profileImage email')
    .populate('chat');

  res.status(200).json({ messages });
});
