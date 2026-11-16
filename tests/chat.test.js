jest.mock('../services/sendEmail');
jest.mock('../services/cloudinary');

const { connectDB, disconnectDB, createLoggedInUser } = require('./helpers');
const Message = require('../models/messageModel');

beforeAll(connectDB);
afterAll(disconnectDB);

describe('private chats & messages', () => {
  let alice;
  let bob;
  let eve;
  let chatId;

  beforeAll(async () => {
    [alice, bob, eve] = await Promise.all([
      createLoggedInUser(),
      createLoggedInUser(),
      createLoggedInUser(),
    ]);
  });

  it('creates a private chat once and returns it afterwards', async () => {
    const created = await alice.agent
      .post('/api/chat')
      .send({ userId: bob.user._id })
      .expect(201);
    chatId = created.body.newChatWithPopulated._id;

    const again = await bob.agent
      .post('/api/chat')
      .send({ userId: alice.user._id })
      .expect(200);

    expect(again.body.newChatWithPopulated._id).toBe(chatId);
  });

  it('validates the other user', async () => {
    await alice.agent.post('/api/chat').send({ userId: 'bad' }).expect(400);
    await alice.agent
      .post('/api/chat')
      .send({ userId: alice.user._id })
      .expect(400);
  });

  it('lets members send and read messages', async () => {
    await alice.agent
      .post('/api/message')
      .send({ chatId, content: '  Hi Bob!  ' })
      .expect(201);
    await bob.agent
      .post('/api/message')
      .send({ chatId, content: 'Hey Alice' })
      .expect(201);

    const res = await bob.agent.get(`/api/message/${chatId}`).expect(200);

    expect(res.body.messages.map((m) => m.content)).toEqual([
      'Hi Bob!',
      'Hey Alice',
    ]);
  });

  it('rejects empty messages', async () => {
    await alice.agent
      .post('/api/message')
      .send({ chatId, content: '   ' })
      .expect(400);
  });

  it('shows the latest message in the chat list', async () => {
    const res = await alice.agent.get('/api/chat').expect(200);

    expect(res.body.populatedChats[0].latestMessage.content).toBe('Hey Alice');
  });

  it('does not let outsiders read or write a chat', async () => {
    await eve.agent.get(`/api/message/${chatId}`).expect(403);
    await eve.agent
      .post('/api/message')
      .send({ chatId, content: 'spoofed' })
      .expect(403);
  });
});

describe('group chats', () => {
  let admin;
  let member;
  let other;
  let outsider;
  let groupId;

  beforeAll(async () => {
    [admin, member, other, outsider] = await Promise.all([
      createLoggedInUser(),
      createLoggedInUser(),
      createLoggedInUser(),
      createLoggedInUser(),
    ]);
  });

  it('requires at least two other members', async () => {
    await admin.agent
      .post('/api/chat/create-group')
      .field('groupName', 'Tiny')
      .field('users', `${member.user._id}`)
      .expect(400);
  });

  it('creates a group with the creator as admin', async () => {
    const res = await admin.agent
      .post('/api/chat/create-group')
      .field('groupName', 'Team')
      .field('users', `${member.user._id},${other.user._id}`)
      .expect(201);

    groupId = res.body._id;
    expect(res.body.groupAdmin._id).toBe(String(admin.user._id));
    expect(res.body.users).toHaveLength(3);
  });

  it('lets members rename the group', async () => {
    const res = await member.agent
      .patch('/api/chat/rename-group')
      .send({ chatId: groupId, chatName: 'Dream Team' })
      .expect(200);

    expect(res.body.updatedChat.chatName).toBe('Dream Team');
  });

  it('only lets the admin add users', async () => {
    await member.agent
      .patch('/api/chat/add-user')
      .send({ chatId: groupId, userId: outsider.user._id })
      .expect(403);

    const res = await admin.agent
      .patch('/api/chat/add-user')
      .send({ chatId: groupId, userId: outsider.user._id })
      .expect(200);

    expect(res.body.updatedChat.users).toHaveLength(4);
  });

  it('lets members leave but not remove others', async () => {
    await member.agent
      .patch('/api/chat/remove-user')
      .send({ chatId: groupId, userId: other.user._id })
      .expect(403);

    await outsider.agent
      .patch('/api/chat/remove-user')
      .send({ chatId: groupId, userId: outsider.user._id })
      .expect(200);
  });

  it('never removes the admin', async () => {
    await admin.agent
      .patch('/api/chat/remove-user')
      .send({ chatId: groupId, userId: admin.user._id })
      .expect(400);
  });

  it('only lets the admin delete the group, along with its messages', async () => {
    await member.agent
      .post('/api/message')
      .send({ chatId: groupId, content: 'bye' })
      .expect(201);

    await member.agent
      .post('/api/chat/delete-group')
      .send({ chatId: groupId })
      .expect(403);

    await admin.agent
      .post('/api/chat/delete-group')
      .send({ chatId: groupId })
      .expect(200);

    expect(await Message.countDocuments({ chat: groupId })).toBe(0);
  });
});
