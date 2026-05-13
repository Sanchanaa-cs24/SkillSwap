const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const {
  MONGODB_URI,
  MONGODB_DB_NAME,
  SEED_DATA_FILE,
} = require('./config');

const seed = JSON.parse(fs.readFileSync(SEED_DATA_FILE, 'utf8'));

const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

let client;
let database;
let initPromise;

const profileCompleted = (user) =>
  Boolean(
    user.headline &&
      user.bio &&
      user.country &&
      user.skillsOffered.length &&
      user.skillsToLearn.length
  );

const rowToUser = (row) => {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    headline: row.headline,
    bio: row.bio,
    country: row.country,
    skillsOffered: row.skills_offered || [],
    skillsToLearn: row.skills_to_learn || [],
    createdAt: row.created_at,
  };
};

const rowToCard = (row, state = {}) => ({
  id: row.id,
  name: row.name,
  persona: row.persona,
  title: row.title,
  skill: row.skill,
  category: row.category,
  country: row.country,
  rating: Number(row.rating),
  bio: row.bio,
  nextSessionSlots: row.next_session_slots || [],
  connected: Boolean(state.connected),
  favorited: Boolean(state.favorited),
});

const rowToSession = (row) => ({
  id: row.id,
  cardId: row.card_id,
  with: row.with_name,
  skill: row.skill,
  time: row.time,
  status: row.status,
  createdAt: row.created_at,
  calendarUrl: row.calendar_url,
});

const rowToLearningPlan = (row) => ({
  profileCompleted: Boolean(row.profile_completed),
  firstSessionBooked: Boolean(row.first_session_booked),
  challengeJoined: Boolean(row.challenge_joined),
  skillsTarget: Number(row.skills_target),
  skillsCompleted: Number(row.skills_completed),
});

const rowToNotification = (row) => ({
  id: row.id,
  title: row.title,
  detail: row.detail,
  createdAt: row.created_at,
  read: Boolean(row.read),
});

const rowToThread = (row) => ({
  id: row.id,
  participant: row.participant,
  topic: row.topic,
  unread: Number(row.unread),
  lastMessage: row.last_message,
  lastAt: row.last_at,
});

const collections = () => ({
  users: database.collection('users'),
  categories: database.collection('categories'),
  discoveryCards: database.collection('discovery_cards'),
  userCardState: database.collection('user_card_state'),
  sessions: database.collection('sessions'),
  events: database.collection('events'),
  userEventState: database.collection('user_event_state'),
  learningPlans: database.collection('learning_plans'),
  messages: database.collection('messages'),
  notifications: database.collection('notifications'),
  messageThreads: database.collection('message_threads'),
});

const ensureIndexes = async () => {
  const c = collections();
  await Promise.all([
    c.users.createIndex({ id: 1 }, { unique: true }),
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.categories.createIndex({ name: 1 }, { unique: true }),
    c.discoveryCards.createIndex({ id: 1 }, { unique: true }),
    c.userCardState.createIndex({ user_id: 1, card_id: 1 }, { unique: true }),
    c.sessions.createIndex({ id: 1 }, { unique: true }),
    c.sessions.createIndex({ user_id: 1, created_at: -1 }),
    c.events.createIndex({ id: 1 }, { unique: true }),
    c.userEventState.createIndex({ user_id: 1, event_id: 1 }, { unique: true }),
    c.learningPlans.createIndex({ user_id: 1 }, { unique: true }),
    c.messages.createIndex({ user_id: 1 }, { unique: true }),
    c.notifications.createIndex({ id: 1 }, { unique: true }),
    c.notifications.createIndex({ user_id: 1, created_at: -1 }),
    c.messageThreads.createIndex({ id: 1 }, { unique: true }),
    c.messageThreads.createIndex({ user_id: 1, last_at: -1 }),
  ]);
};

const ensureUserState = async (userId, overrides = {}) => {
  const c = collections();
  await c.learningPlans.updateOne(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        profile_completed: Boolean(overrides.profileCompleted),
        first_session_booked: Boolean(overrides.firstSessionBooked),
        challenge_joined: Boolean(overrides.challengeJoined),
        skills_target: overrides.skillsTarget ?? 4,
        skills_completed: overrides.skillsCompleted ?? 0,
      },
    },
    { upsert: true }
  );

  await c.messages.updateOne(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        unread_count: overrides.unreadCount ?? 0,
      },
    },
    { upsert: true }
  );
};

const pushNotification = async (userId, title, detail) => {
  await collections().notifications.insertOne({
    id: newId('n'),
    user_id: userId,
    title,
    detail,
    created_at: nowIso(),
    read: false,
  });
};

const seedDatabase = async () => {
  const c = collections();
  if ((await c.users.countDocuments()) > 0) {
    return;
  }

  if (seed.categories.length) {
    await c.categories.insertMany(seed.categories.map((name) => ({ name })));
  }

  if (seed.discoveryCards.length) {
    await c.discoveryCards.insertMany(
      seed.discoveryCards.map((card) => ({
        id: card.id,
        name: card.name,
        persona: card.persona,
        title: card.title,
        skill: card.skill,
        category: card.category,
        country: card.country,
        rating: Number(card.rating),
        bio: card.bio,
        next_session_slots: card.nextSessionSlots,
      }))
    );
  }

  if (seed.events.length) {
    await c.events.insertMany(
      seed.events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        base_participants: Math.max(
          event.participants - (event.joined ? 1 : 0),
          0
        ),
      }))
    );
  }

  const demoUser = seed.users[0];
  const demoUserId = demoUser.id;
  await c.users.insertOne({
    id: demoUser.id,
    name: demoUser.name,
    email: demoUser.email.toLowerCase(),
    password_hash: bcrypt.hashSync(demoUser.password, 10),
    headline: demoUser.headline,
    bio: demoUser.bio,
    country: demoUser.country,
    skills_offered: demoUser.skillsOffered,
    skills_to_learn: demoUser.skillsToLearn,
    created_at: nowIso(),
  });

  await ensureUserState(demoUserId, {
    profileCompleted: seed.learningPlan.profileCompleted,
    firstSessionBooked: seed.learningPlan.firstSessionBooked,
    challengeJoined: seed.learningPlan.challengeJoined,
    skillsTarget: seed.learningPlan.skillsTarget,
    skillsCompleted: seed.learningPlan.skillsCompleted,
    unreadCount: seed.messages.unreadCount,
  });

  const initialCardState = seed.discoveryCards
    .filter((card) => card.connected || card.favorited)
    .map((card) => ({
      user_id: demoUserId,
      card_id: card.id,
      connected: Boolean(card.connected),
      favorited: Boolean(card.favorited),
    }));
  if (initialCardState.length) {
    await c.userCardState.insertMany(initialCardState);
  }

  if (seed.sessions.length) {
    await c.sessions.insertMany(
      seed.sessions.map((session) => ({
        id: session.id,
        user_id: demoUserId,
        card_id: session.cardId,
        with_name: session.with,
        skill: session.skill,
        time: session.time,
        status: session.status,
        created_at: session.createdAt,
        calendar_url: session.calendarUrl,
      }))
    );
  }

  const joinedEvents = seed.events
    .filter((event) => event.joined)
    .map((event) => ({
      user_id: demoUserId,
      event_id: event.id,
      joined_at: nowIso(),
    }));
  if (joinedEvents.length) {
    await c.userEventState.insertMany(joinedEvents);
  }

  if (seed.notifications.length) {
    await c.notifications.insertMany(
      seed.notifications.map((notification) => ({
        id: notification.id,
        user_id: demoUserId,
        title: notification.title,
        detail: notification.detail,
        created_at: notification.createdAt,
        read: Boolean(notification.read),
      }))
    );
  }

  if (seed.messageThreads.length) {
    await c.messageThreads.insertMany(
      seed.messageThreads.map((thread) => ({
        id: thread.id,
        user_id: demoUserId,
        participant: thread.participant,
        topic: thread.topic,
        unread: Number(thread.unread),
        last_message: thread.lastMessage,
        last_at: thread.lastAt,
      }))
    );
  }
};

const init = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      client = new MongoClient(MONGODB_URI, {
        appName: 'SkillsSwap',
      });
      await client.connect();
      database = client.db(MONGODB_DB_NAME);
      await ensureIndexes();
      await seedDatabase();
    })();
  }
  return initPromise;
};

const getUserByEmail = async (email) =>
  collections().users.findOne({
    email: String(email).toLowerCase().trim(),
  });

const getUserById = async (userId) =>
  rowToUser(await collections().users.findOne({ id: userId }));

const verifyPassword = (userRow, password) =>
  Boolean(userRow && bcrypt.compareSync(String(password), userRow.password_hash));

const createUser = async ({ name, email, password }) => {
  await init();
  const id = newId('user');
  await collections().users.insertOne({
    id,
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password_hash: bcrypt.hashSync(String(password), 10),
    headline: '',
    bio: '',
    country: '',
    skills_offered: [],
    skills_to_learn: [],
    created_at: nowIso(),
  });
  await ensureUserState(id);
  return getUserById(id);
};

const updateProfile = async (userId, updates) => {
  await init();
  const current = await collections().users.findOne({ id: userId });
  if (!current) {
    return null;
  }
  const next = {
    name: updates.name ?? current.name,
    headline: updates.headline ?? current.headline,
    bio: updates.bio ?? current.bio,
    country: updates.country ?? current.country,
    skillsOffered: updates.skillsOffered ?? current.skills_offered ?? [],
    skillsToLearn: updates.skillsToLearn ?? current.skills_to_learn ?? [],
  };

  await collections().users.updateOne(
    { id: userId },
    {
      $set: {
        name: next.name,
        headline: next.headline,
        bio: next.bio,
        country: next.country,
        skills_offered: next.skillsOffered,
        skills_to_learn: next.skillsToLearn,
      },
    }
  );

  await collections().learningPlans.updateOne(
    { user_id: userId },
    { $set: { profile_completed: profileCompleted(next) } },
    { upsert: true }
  );

  return getUserById(userId);
};

const getPublicOverview = async () => {
  await init();
  const c = collections();
  const [totalUsers, totalCards, mentorCount, learnerCount, sessionCount] =
    await Promise.all([
      c.users.countDocuments(),
      c.discoveryCards.countDocuments(),
      c.discoveryCards.countDocuments({ persona: 'teacher' }),
      c.discoveryCards.countDocuments({ persona: 'learner' }),
      c.sessions.countDocuments(),
    ]);

  const featuredCards = (
    await c.discoveryCards.find({}).sort({ rating: -1, name: 1 }).limit(4).toArray()
  ).map((row) => rowToCard(row));

  const featuredEvents = (await c.events
    .find({})
    .sort({ base_participants: -1, title: 1 })
    .limit(3)
    .toArray()).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    participants: Number(event.base_participants),
    joined: false,
  }));

  return {
    totalMembers: totalUsers + totalCards,
    mentorCount,
    learnerCount,
    sessionCount,
    categories: (await c.categories.find({}).sort({ name: 1 }).toArray()).map(
      (row) => row.name
    ),
    featuredCards,
    featuredEvents,
  };
};

const getCategories = async () =>
  (await collections().categories.find({}).sort({ name: 1 }).toArray()).map(
    (row) => row.name
  );

const getUserCardStateMap = async (userId, cardIds) => {
  const rows = await collections()
    .userCardState
    .find({ user_id: userId, card_id: { $in: cardIds } })
    .toArray();
  return new Map(rows.map((row) => [row.card_id, row]));
};

const getDiscoveryCards = async (
  userId,
  { q = '', category = 'All', persona = 'All' }
) => {
  await init();
  const filter = {};
  const query = String(q).trim();
  if (query) {
    const regex = new RegExp(query, 'i');
    filter.$or = [{ name: regex }, { skill: regex }, { title: regex }];
  }
  if (category !== 'All') {
    filter.category = category;
  }
  if (persona !== 'All') {
    filter.persona = persona;
  }

  const cards = await collections()
    .discoveryCards
    .find(filter)
    .sort({ rating: -1, name: 1 })
    .toArray();
  const stateMap = await getUserCardStateMap(
    userId,
    cards.map((card) => card.id)
  );
  return cards.map((card) => rowToCard(card, stateMap.get(card.id)));
};

const getCardForUser = async (userId, cardId) => {
  const [card, state] = await Promise.all([
    collections().discoveryCards.findOne({ id: cardId }),
    collections().userCardState.findOne({ user_id: userId, card_id: cardId }),
  ]);
  if (!card) {
    return null;
  }
  return { card, state: state || { connected: false, favorited: false } };
};

const incrementUnreadMessages = async (userId, amount = 1) => {
  await collections().messages.updateOne(
    { user_id: userId },
    { $inc: { unread_count: amount }, $setOnInsert: { user_id: userId } },
    { upsert: true }
  );
};

const toggleConnect = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextConnected = !Boolean(current.state.connected);
  await collections().userCardState.updateOne(
    { user_id: userId, card_id: cardId },
    {
      $set: {
        connected: nextConnected,
        favorited: Boolean(current.state.favorited),
      },
    },
    { upsert: true }
  );
  if (nextConnected) {
    await incrementUnreadMessages(userId, 1);
    await pushNotification(
      userId,
      'New connection',
      `You connected with ${current.card.name} for ${current.card.skill}.`
    );
  }
  const updated = await getCardForUser(userId, cardId);
  return rowToCard(updated.card, updated.state);
};

const toggleFavorite = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextFavorited = !Boolean(current.state.favorited);
  await collections().userCardState.updateOne(
    { user_id: userId, card_id: cardId },
    {
      $set: {
        connected: Boolean(current.state.connected),
        favorited: nextFavorited,
      },
    },
    { upsert: true }
  );
  if (nextFavorited) {
    await pushNotification(
      userId,
      'Saved profile',
      `${current.card.name} was added to your favorites list.`
    );
  }
  const updated = await getCardForUser(userId, cardId);
  return rowToCard(updated.card, updated.state);
};

const getSessions = async (userId) =>
  (await collections()
    .sessions
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()).map(rowToSession);

const bookSession = async (userId, cardId, time) => {
  await init();
  const card = await collections().discoveryCards.findOne({ id: cardId });
  if (!card) {
    return null;
  }
  const id = newId('session');
  const createdAt = nowIso();
  const calendarUrl = `/api/sessions/${id}/calendar`;

  await collections().sessions.insertOne({
    id,
    user_id: userId,
    card_id: card.id,
    with_name: card.name,
    skill: card.skill,
    time,
    status: 'upcoming',
    created_at: createdAt,
    calendar_url: calendarUrl,
  });

  await collections().learningPlans.updateOne(
    { user_id: userId },
    { $set: { first_session_booked: true }, $setOnInsert: { user_id: userId } },
    { upsert: true }
  );

  await incrementUnreadMessages(userId, 1);
  await pushNotification(
    userId,
    'Booking confirmed',
    `${card.name} session is booked for ${time}.`
  );

  return rowToSession(await collections().sessions.findOne({ id }));
};

const updateSessionStatus = async (userId, sessionId, status) => {
  await init();
  const session = await collections().sessions.findOne({
    id: sessionId,
    user_id: userId,
  });
  if (!session) {
    return null;
  }
  await collections().sessions.updateOne(
    { id: sessionId, user_id: userId },
    { $set: { status } }
  );
  await pushNotification(
    userId,
    'Session status updated',
    `${session.skill} with ${session.with_name} is now ${status}.`
  );
  return rowToSession(
    await collections().sessions.findOne({ id: sessionId, user_id: userId })
  );
};

const getSessionById = async (userId, sessionId) =>
  collections().sessions.findOne({ id: sessionId, user_id: userId });

const getEvents = async (userId) => {
  await init();
  const [events, joins] = await Promise.all([
    collections().events.find({}).sort({ base_participants: -1, title: 1 }).toArray(),
    collections().userEventState.find({}).toArray(),
  ]);
  const joinCounts = new Map();
  const userJoined = new Set();
  joins.forEach((join) => {
    joinCounts.set(join.event_id, (joinCounts.get(join.event_id) || 0) + 1);
    if (join.user_id === userId) {
      userJoined.add(join.event_id);
    }
  });
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    participants: Number(event.base_participants) + (joinCounts.get(event.id) || 0),
    joined: userJoined.has(event.id),
  }));
};

const joinEvent = async (userId, eventId) => {
  await init();
  const event = await collections().events.findOne({ id: eventId });
  if (!event) {
    return null;
  }
  const existing = await collections().userEventState.findOne({
    user_id: userId,
    event_id: eventId,
  });
  if (!existing) {
    await collections().userEventState.insertOne({
      user_id: userId,
      event_id: eventId,
      joined_at: nowIso(),
    });
    await collections().learningPlans.updateOne(
      { user_id: userId },
      { $set: { challenge_joined: true }, $setOnInsert: { user_id: userId } },
      { upsert: true }
    );
    await incrementUnreadMessages(userId, 1);
    await pushNotification(userId, 'Event joined', `You joined "${event.title}".`);
  }
  return (await getEvents(userId)).find((item) => item.id === eventId) || null;
};

const getLearningPlan = async (userId) => {
  const row = await collections().learningPlans.findOne({ user_id: userId });
  return row ? rowToLearningPlan(row) : null;
};

const updateLearningPlan = async (userId, updates) => {
  await init();
  const current = await getLearningPlan(userId);
  if (!current) {
    return null;
  }
  const next = {
    profileCompleted: updates.profileCompleted ?? current.profileCompleted,
    firstSessionBooked: updates.firstSessionBooked ?? current.firstSessionBooked,
    challengeJoined: updates.challengeJoined ?? current.challengeJoined,
    skillsTarget: updates.skillsTarget ?? current.skillsTarget,
    skillsCompleted: updates.skillsCompleted ?? current.skillsCompleted,
  };
  await collections().learningPlans.updateOne(
    { user_id: userId },
    {
      $set: {
        profile_completed: next.profileCompleted,
        first_session_booked: next.firstSessionBooked,
        challenge_joined: next.challengeJoined,
        skills_target: next.skillsTarget,
        skills_completed: next.skillsCompleted,
      },
    }
  );
  return getLearningPlan(userId);
};

const getMessages = async (userId) =>
  (await collections().messages.findOne({ user_id: userId })) || {
    unread_count: 0,
  };

const markMessagesRead = async (userId) => {
  await init();
  await collections().messages.updateOne(
    { user_id: userId },
    { $set: { unread_count: 0 }, $setOnInsert: { user_id: userId } },
    { upsert: true }
  );
  await collections().messageThreads.updateMany(
    { user_id: userId },
    { $set: { unread: 0 } }
  );
  return { unreadCount: 0 };
};

const getNotifications = async (userId) =>
  (await collections()
    .notifications
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray()).map(rowToNotification);

const markNotificationsRead = async (userId) => {
  await init();
  await collections().notifications.updateMany(
    { user_id: userId },
    { $set: { read: true } }
  );
  return getNotifications(userId);
};

const getMessageThreads = async (userId) =>
  (await collections()
    .messageThreads
    .find({ user_id: userId })
    .sort({ last_at: -1 })
    .toArray()).map(rowToThread);

const replyThread = async (userId, threadId, message) => {
  await init();
  const thread = await collections().messageThreads.findOne({
    id: threadId,
    user_id: userId,
  });
  if (!thread) {
    return null;
  }
  await collections().messageThreads.updateOne(
    { id: threadId, user_id: userId },
    {
      $set: {
        last_message: String(message).trim(),
        last_at: nowIso(),
        unread: 0,
      },
    }
  );
  await pushNotification(
    userId,
    'Message sent',
    `Your reply was sent to ${thread.participant}.`
  );
  return rowToThread(
    await collections().messageThreads.findOne({
      id: threadId,
      user_id: userId,
    })
  );
};

module.exports = {
  provider: 'mongo',
  init,
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateProfile,
  getPublicOverview,
  getCategories,
  getDiscoveryCards,
  toggleConnect,
  toggleFavorite,
  getSessions,
  bookSession,
  updateSessionStatus,
  getSessionById,
  getEvents,
  joinEvent,
  getLearningPlan,
  updateLearningPlan,
  getMessages,
  markMessagesRead,
  getNotifications,
  markNotificationsRead,
  getMessageThreads,
  replyThread,
};
