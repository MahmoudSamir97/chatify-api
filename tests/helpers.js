// Must run before the app is required: tests never use the developer's real .env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.BCRYPT_SALT = '4';
process.env.BASE_URL = 'http://localhost:3000';

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/userModel');

const PASSWORD = 'Password1@';

let mongoServer;
let userCounter = 0;

// Uses an in-memory MongoDB, or TEST_DATABASE_URL when provided (e.g. a CI service)
const connectDB = async () => {
  let uri = process.env.TEST_DATABASE_URL;

  if (!uri) {
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }

  await mongoose.connect(uri, {
    dbName: `chatify_test_${process.pid}_${Date.now()}`,
  });
};

const disconnectDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer?.stop();
};

// Creates a verified user and returns a supertest agent that is logged in as them
const createLoggedInUser = async (overrides = {}) => {
  userCounter += 1;

  const user = await User.create({
    fullname: `Test User ${userCounter}`,
    username: `testuser${userCounter}`,
    email: `user${userCounter}@test.com`,
    password: await bcrypt.hash(PASSWORD, 4),
    isVerified: true,
    ...overrides,
  });

  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: PASSWORD })
    .expect(200);

  return { user, agent, cookie: res.headers['set-cookie'] };
};

module.exports = { app, PASSWORD, connectDB, disconnectDB, createLoggedInUser };
