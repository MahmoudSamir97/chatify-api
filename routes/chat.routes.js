const chatRouter = require('express').Router();
const upload = require('../middlewares/multer');
const findPrivateChat = require('../middlewares/findChat');
const groupValidator = require('../middlewares/groupValidator');
const protectRoute = require('../middlewares/protectRoute');
const chatAccess = require('../middlewares/chatAccess');
const {
  fetchChats,
  createGroupChat,
  renameGroup,
  removeFromGroup,
  addToGroup,
  createPrivateChat,
  changeGroupImage,
  deleteGroup,
} = require('../controllers/chatController');

chatRouter.use(protectRoute);

chatRouter.route('/').get(fetchChats).post(findPrivateChat, createPrivateChat);
chatRouter.post(
  '/create-group',
  upload.single('groupImage'),
  groupValidator,
  createGroupChat,
);
chatRouter.patch('/rename-group', chatAccess({ groupOnly: true }), renameGroup);
chatRouter.patch('/add-user', chatAccess({ adminOnly: true }), addToGroup);
chatRouter.patch(
  '/remove-user',
  chatAccess({ groupOnly: true }),
  removeFromGroup,
);
chatRouter.patch(
  '/update-image',
  upload.single('chatImage'),
  chatAccess({ groupOnly: true }),
  changeGroupImage,
);
chatRouter.post('/delete-group', chatAccess({ adminOnly: true }), deleteGroup);

module.exports = chatRouter;
