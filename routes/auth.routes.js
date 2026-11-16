const resetMiddleware = require('../middlewares/resetMiddleware');
const authRouter = require('express').Router();
const resetSchema = require('../utils/validation-schema/resetPasswordSchema');
const signupSchema = require('../utils/validation-schema/signupSchema');
const { validation } = require('../middlewares/validation');
const { authLimiter } = require('../middlewares/rateLimiters');
const {
  signup,
  login,
  logout,
  forgetPassword,
  resetPassword,
  verifyEmail,
} = require('../controllers/authController');

authRouter.post(
  '/signup',
  authLimiter,
  validation({ body: signupSchema }),
  signup,
);
authRouter.get('/:id/verify/:token', verifyEmail);
authRouter.post('/login', authLimiter, login);
authRouter.post('/forget-password', authLimiter, forgetPassword);
authRouter.post('/logout', logout);

authRouter.post(
  '/reset-password/:id/:token',
  authLimiter,
  resetMiddleware,
  validation({ body: resetSchema }),
  resetPassword,
);

module.exports = authRouter;
