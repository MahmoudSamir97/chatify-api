const { isValidObjectId } = require('mongoose');
const Chat = require('../models/chatModel');
const AppError = require('../utils/error-handlers/AppError');
const { catchAsync } = require('../utils/error-handlers/catchAsync');

// Loads the chat from `params.chatId` or `body.chatId` and makes sure the
// logged-in user is allowed to act on it. The chat is exposed as `req.chat`.
const chatAccess = ({ groupOnly = false, adminOnly = false } = {}) =>
  catchAsync(async (req, res, next) => {
    const chatId = req.params.chatId || req.body.chatId;

    if (!chatId || !isValidObjectId(chatId))
      return next(new AppError(400, 'A valid chat id is required'));

    const chat = await Chat.findById(chatId);
    if (!chat) return next(new AppError(404, 'Chat not found'));

    const isMember = chat.users.some((id) => id.equals(req.user._id));
    if (!isMember)
      return next(new AppError(403, 'You are not a member of this chat'));

    if ((groupOnly || adminOnly) && !chat.isGroupChat)
      return next(new AppError(400, 'This action is only for group chats'));

    if (adminOnly && !chat.groupAdmin?.equals(req.user._id))
      return next(new AppError(403, 'Only the group admin can do this'));

    req.chat = chat;

    next();
  });

module.exports = chatAccess;
