jest.mock('../services/sendEmail');

const request = require('supertest');
const {
  app,
  PASSWORD,
  connectDB,
  disconnectDB,
  createLoggedInUser,
} = require('./helpers');
const sendEmail = require('../services/sendEmail');
const User = require('../models/userModel');
const Token = require('../models/tokenModel');

beforeAll(connectDB);
afterAll(disconnectDB);
beforeEach(() => jest.clearAllMocks());

const newUser = {
  fullname: 'Jane Developer',
  username: 'janedev1',
  email: 'jane@test.com',
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

describe('app', () => {
  it('exposes a health check', async () => {
    const res = await request(app).get('/api/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);

    expect(res.body.status).toBe('fail');
  });

  it('rejects malformed JSON with 400', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
  });
});

describe('signup & email verification', () => {
  it('rejects invalid signup data', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...newUser, password: 'weak' })
      .expect(400);

    expect(res.body.errors[0].path).toContain('password');
  });

  it('ignores fields a client must not control', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ ...newUser, isVerified: true })
      .expect(400);
  });

  it('creates an unverified user and emails a verification link', async () => {
    await request(app).post('/api/auth/signup').send(newUser).expect(201);

    const user = await User.findOne({ email: newUser.email }).select(
      '+password',
    );
    expect(user.isVerified).toBe(false);
    expect(user.password).not.toBe(PASSWORD);

    const [, subject, , url] = sendEmail.mock.calls[0];
    expect(subject).toBe('Verify email');
    expect(url).toMatch(`http://localhost:3000/auth/${user._id}/verify/`);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send(newUser).expect(400);
  });

  it('blocks login until the email is verified', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: PASSWORD })
      .expect(401);

    expect(res.body.message).toMatch(/verify/i);
  });

  it('verifies the email, and opening the link again is harmless', async () => {
    const user = await User.findOne({ email: newUser.email });
    const { token } = await Token.findOne({ userId: user._id });
    const url = `/api/auth/${user._id}/verify/${token}`;

    await request(app).get(url).expect(200);
    await request(app).get(url).expect(200);

    expect((await User.findById(user._id)).isVerified).toBe(true);
    expect(await Token.countDocuments({ userId: user._id })).toBe(0);
  });

  it('rejects a bad verification token', async () => {
    const other = await User.create({
      ...newUser,
      email: 'other@test.com',
      username: 'otheruser1',
    });

    await request(app).get(`/api/auth/${other._id}/verify/nope`).expect(400);
  });
});

describe('login & logout', () => {
  it('rejects a wrong password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'Wrong1234@' })
      .expect(401);
  });

  it('sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: PASSWORD })
      .expect(200);

    expect(res.body.user.email).toBe(newUser.email);
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/^token=.+HttpOnly/);
  });

  it('protects private routes', async () => {
    await request(app).get('/api/user/profile').expect(401);

    await request(app)
      .get('/api/user/profile')
      .set('Cookie', 'token=not-a-jwt')
      .expect(401);
  });

  it('clears the auth cookie on logout', async () => {
    const { agent } = await createLoggedInUser();

    await agent.get('/api/user/profile').expect(200);

    const res = await agent.post('/api/auth/logout').expect(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=;/);

    await agent.get('/api/user/profile').expect(401);
  });
});

describe('password reset', () => {
  it('does not reveal whether an email is registered', async () => {
    const unknown = await request(app)
      .post('/api/auth/forget-password')
      .send({ email: 'nobody@test.com' })
      .expect(200);
    const known = await request(app)
      .post('/api/auth/forget-password')
      .send({ email: newUser.email })
      .expect(200);

    expect(unknown.body.message).toBe(known.body.message);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('resets the password with the emailed link, once', async () => {
    const user = await User.findOne({ email: newUser.email });
    const { token } = await Token.findOne({ userId: user._id });
    const url = `/api/auth/reset-password/${user._id}/${token}`;
    const newPassword = 'Newpassword9#';

    await request(app)
      .post(url)
      .send({ newPassword, confirmNewPassword: newPassword })
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: newPassword })
      .expect(200);

    await request(app)
      .post(url)
      .send({ newPassword, confirmNewPassword: newPassword })
      .expect(401);
  });
});

describe('profile', () => {
  it('updates allowed fields and ignores empty username', async () => {
    const { agent, user } = await createLoggedInUser();

    const res = await agent
      .patch('/api/user/profile')
      .send({ username: '', bio: 'Hello there' })
      .expect(200);

    expect(res.body.updatedUser.username).toBe(user.username);
    expect(res.body.updatedUser.bio).toBe('Hello there');
  });

  it('searches users literally (no regex injection)', async () => {
    const { agent } = await createLoggedInUser();

    const all = await agent.get('/api/user/find?search=.*').expect(200);
    expect(all.body).toEqual([]);

    const found = await agent.get('/api/user/find?search=JANEDEV').expect(200);
    expect(found.body.map((u) => u.username)).toEqual(['janedev1']);
  });
});
