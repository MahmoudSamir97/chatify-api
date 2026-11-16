const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { isValidObjectId } = require('mongoose');
const Chat = require('../models/chatModel');
const getClientOrigins = require('../config/clientOrigins');

// userId -> Set of socket ids (a user can have several tabs open)
const onlineUsers = new Map();

const readCookie = (header = '', name) => {
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
};

const broadcastOnlineUsers = (io) =>
  io.emit('getOnlineUsers', [...onlineUsers.keys()]);

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: getClientOrigins(), credentials: true },
  });

  // Authenticate every connection with the same httpOnly JWT cookie as the REST API
  io.use((socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, 'token');
      const { userId } = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = String(userId);

      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket;

    // Each user listens on a personal room for new messages
    socket.join(userId);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    broadcastOnlineUsers(io);

    socket.on('join chat', async (chatId) => {
      if (!isValidObjectId(chatId)) return;

      const isMember = await Chat.exists({ _id: chatId, users: userId });
      if (isMember) socket.join(String(chatId));
    });

    socket.on('typing', (chatId) => {
      if (socket.rooms.has(chatId)) socket.to(chatId).emit('typing', chatId);
    });

    socket.on('stop typing', (chatId) => {
      if (socket.rooms.has(chatId))
        socket.to(chatId).emit('stop typing', chatId);
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      sockets?.delete(socket.id);
      if (!sockets?.size) onlineUsers.delete(userId);

      broadcastOnlineUsers(io);
    });
  });

  return io;
};

module.exports = initSocket;
