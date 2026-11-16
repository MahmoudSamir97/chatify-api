const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/userModel');
const generateTokenAndSetCookie = require('../utils/generateToken');
const authCookieOptions = require('../utils/cookieOptions');
const { catchAsync } = require('../utils/error-handlers/catchAsync');
const Token = require('../models/tokenModel');
const sendEmail = require('../services/sendEmail');
const verifyTemplate = require('../utils/email-templates/verifyTemplate');
const AppError = require('../utils/error-handlers/AppError');
const resetTemplate = require('../utils/email-templates/resetPasswordTemplate');

const hashPassword = (password) =>
  bcrypt.hash(password, Number(process.env.BCRYPT_SALT) || 10);

const createToken = (userId) =>
  Token.create({ userId, token: crypto.randomBytes(32).toString('hex') });

exports.signup = catchAsync(async (req, res, next) => {
  const { fullname, username, email, password } = req.body;

  const foundedUser = await User.findOne({ email });
  if (foundedUser) {
    return next(new AppError(400, 'User already exists'));
  }

  const user = await User.create({
    fullname,
    username,
    email,
    password: await hashPassword(password),
  });

  const { token } = await createToken(user._id);

  const URL = `${process.env.BASE_URL}/auth/${user._id}/verify/${token}`;

  sendEmail(user, 'Verify email', verifyTemplate, URL);

  res.status(201).json({
    message: 'Please verify your email address',
  });
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) return next(new AppError(400, 'Invalid link'));

  // Opening the link twice (e.g. email scanners, React StrictMode) is not an error
  if (user.isVerified)
    return res.status(200).json({ message: 'Email already verified' });

  const token = await Token.findOne({
    userId: user._id,
    token: req.params.token,
  });

  if (!token) return next(new AppError(400, 'Invalid or expired link'));

  user.isVerified = true;
  await user.save();
  await Token.findByIdAndDelete(token._id);

  res.status(200).json({
    message: 'Email verified successfully',
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new AppError(400, 'Please provide email and password'));

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password)))
    return next(new AppError(401, 'Invalid email or password'));

  if (!user.isVerified)
    return next(new AppError(401, 'Please verify your email!'));

  generateTokenAndSetCookie(user._id, res);

  // Never send the password hash back to the client
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    user,
  });
});

exports.forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new AppError(400, 'Please provide your email'));

  const user = await User.findOne({ email });

  // Same response whether the email exists or not, to avoid account enumeration
  if (user) {
    await Token.deleteMany({ userId: user._id });
    const { token } = await createToken(user._id);

    const URL = `${process.env.BASE_URL}/auth/reset-password/${user._id}/${token}`;

    sendEmail(user, 'Reset password', resetTemplate, URL);
  }

  res.status(200).json({
    status: 'success',
    message: 'If this email is registered, a reset link has been sent!',
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { user, token } = req.data;
  const { newPassword } = req.body;

  user.password = await hashPassword(newPassword);
  await user.save();
  await Token.findByIdAndDelete(token._id);

  res
    .status(200)
    .json({ status: 'success', message: 'Password updated successfully!' });
});

exports.logout = catchAsync(async (req, res, next) => {
  res.clearCookie('token', authCookieOptions());

  res.status(200).json({ message: 'Logged out successfully' });
});
