const jwt = require('jsonwebtoken');
const authCookieOptions = require('./cookieOptions');

const generateTokenAndSetCookie = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.COOKIE_EXPIRES || '15d',
  });

  res.cookie('token', token, {
    ...authCookieOptions(),
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });
};

module.exports = generateTokenAndSetCookie;
