jest.mock('../services/sendEmail');

const http = require('http');
const { io: connect } = require('socket.io-client');
const {
  app,
  connectDB,
  disconnectDB,
  createLoggedInUser,
} = require('./helpers');
const initSocket = require('../socket');

let server;
let url;
const clients = [];

const openSocket = (cookie) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, {
      transports: ['websocket'],
      extraHeaders: cookie ? { cookie: cookie.join('; ') } : {},
      reconnection: false,
    });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const nextEvent = (socket, event) =>
  new Promise((resolve) => socket.once(event, resolve));

beforeAll(async () => {
  await connectDB();

  server = http.createServer(app);
  app.set('io', initSocket(server));
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  clients.forEach((socket) => socket.close());
  await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

it('rejects connections without a valid auth cookie', async () => {
  await expect(openSocket()).rejects.toThrow('Unauthorized');
  await expect(openSocket(['token=forged'])).rejects.toThrow('Unauthorized');
});

it('delivers new messages in real time to the other members only', async () => {
  const alice = await createLoggedInUser();
  const bob = await createLoggedInUser();

  const aliceSocket = await openSocket(alice.cookie);
  const bobSocket = await openSocket(bob.cookie);

  const aliceSpy = jest.fn();
  aliceSocket.on('message received', aliceSpy);

  const { body } = await alice.agent
    .post('/api/chat')
    .send({ userId: bob.user._id })
    .expect(201);

  const received = nextEvent(bobSocket, 'message received');

  await alice.agent
    .post('/api/message')
    .send({ chatId: body.newChatWithPopulated._id, content: 'Realtime!' })
    .expect(201);

  const message = await received;

  expect(message.content).toBe('Realtime!');
  expect(message.sender._id).toBe(String(alice.user._id));
  expect(aliceSpy).not.toHaveBeenCalled();
});

it('relays typing only to members who joined the chat', async () => {
  const alice = await createLoggedInUser();
  const bob = await createLoggedInUser();
  const eve = await createLoggedInUser();

  const { body } = await alice.agent
    .post('/api/chat')
    .send({ userId: bob.user._id })
    .expect(201);
  const chatId = body.newChatWithPopulated._id;

  const [aliceSocket, bobSocket, eveSocket] = await Promise.all([
    openSocket(alice.cookie),
    openSocket(bob.cookie),
    openSocket(eve.cookie),
  ]);

  const eveSpy = jest.fn();
  eveSocket.on('typing', eveSpy);

  // Eve is not a member, so her join request is ignored
  [aliceSocket, bobSocket, eveSocket].forEach((s) =>
    s.emit('join chat', chatId),
  );
  await new Promise((resolve) => setTimeout(resolve, 200));

  const typing = nextEvent(bobSocket, 'typing');
  aliceSocket.emit('typing', chatId);

  expect(await typing).toBe(chatId);
  expect(eveSpy).not.toHaveBeenCalled();
});
