const messageRouter = require('express').Router();
const protectRoute = require('../middlewares/protectRoute');
const chatAccess = require('../middlewares/chatAccess');
const {
  getMessages,
  sendMessage,
} = require('../controllers/messageController');

messageRouter.use(protectRoute);

messageRouter.get('/:chatId', chatAccess(), getMessages);

messageRouter.post('/', chatAccess(), sendMessage);

module.exports = messageRouter;
