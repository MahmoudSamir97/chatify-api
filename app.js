const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/auth.routes');
const userRouter = require('./routes/user.routes');
const messageRouter = require('./routes/message.routes');
const chatRouter = require('./routes/chat.routes');
const { globalErrorHandler } = require('./controllers/errorController');
const { apiLimiter } = require('./middlewares/rateLimiters');
const getClientOrigins = require('./config/clientOrigins');
const AppError = require('./utils/error-handlers/AppError');

const app = express();

app.set('trust proxy', 1);

app.use(cors({ origin: getClientOrigins(), credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/message', messageRouter);
app.use('/api/chat', chatRouter);
app.use('/api/user', userRouter);

app.all('*', (req, res, next) => {
  next(new AppError(404, `Can't find ${req.originalUrl} on this server!`));
});

app.use(globalErrorHandler);

module.exports = app;
