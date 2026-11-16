require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const initSocket = require('./socket');
const connectToMongoDB = require('./config/DBconfig');

const PORT = process.env.PORT || 5000;

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing required env variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const server = http.createServer(app);

// Controllers emit real-time events through the same io instance
app.set('io', initSocket(server));

const start = async () => {
  await connectToMongoDB();

  server.listen(PORT, () => {
    console.log(`Listening to server on port ${PORT}`);
  });
};

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
