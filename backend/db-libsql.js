const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');
const {
  DATABASE_URL,
  DATABASE_AUTH_TOKEN,
  SEED_DATA_FILE,
} = require('./config');

const seed = JSON.parse(fs.readFileSync(SEED_DATA_FILE, 'utf8'));
const client = createClient({
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN || undefined,
});

const parseList = (value) => {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
};

const boolInt = (value) => (value ? 1 : 0);
const nowIso = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

const rowValue = (row, key) => row[key];
const rowCount = (row, key = 'count') => Number(rowValue(row, key) || 0);

const sanitizeUserRow = (row) => {
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
    skillsOffered: parseList(row.skills_offered),
    skillsToLearn: parseList(row.skills_to_learn),
    createdAt: row.created_at,
  };
};

const rowToCard = (row) => ({
  id: row.id,
  name: row.name,
  persona: row.persona,
  title: row.title,
  skill: row.skill,
  category: row.category,
  country: row.country,
  rating: Number(row.rating),
  bio: row.bio,
  nextSessionSlots: parseList(row.next_session_slots),
  connected: Boolean(row.connected),
  favorited: Boolean(row.favorited),
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

const rowToEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  participants: Number(row.participants),
  joined: Boolean(row.joined),
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

const profileCompleted = (user) =>
  Boolean(
    user.headline &&
      user.bio &&
      user.country &&
      user.skillsOffered.length &&
      user.skillsToLearn.length
  );

const execute = async (sql, args = []) => client.execute({ sql, args });

const getRow = async (sql, args = []) => {
  const result = await execute(sql, args);
  return result.rows[0] || null;
};

const getAll = async (sql, args = []) => {
  const result = await execute(sql, args);
  return result.rows;
};

const runMigrations = async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      skills_offered TEXT NOT NULL DEFAULT '[]',
      skills_to_learn TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS discovery_cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      persona TEXT NOT NULL,
      title TEXT NOT NULL,
      skill TEXT NOT NULL,
      category TEXT NOT NULL,
      country TEXT NOT NULL,
      rating REAL NOT NULL,
      bio TEXT NOT NULL,
      next_session_slots TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS user_card_state (
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      connected INTEGER NOT NULL DEFAULT 0,
      favorited INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, card_id)
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      with_name TEXT NOT NULL,
      skill TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      calendar_url TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      base_participants INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS user_event_state (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id)
    )`,
    `CREATE TABLE IF NOT EXISTS learning_plans (
      user_id TEXT PRIMARY KEY,
      profile_completed INTEGER NOT NULL DEFAULT 0,
      first_session_booked INTEGER NOT NULL DEFAULT 0,
      challenge_joined INTEGER NOT NULL DEFAULT 0,
      skills_target INTEGER NOT NULL DEFAULT 4,
      skills_completed INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      user_id TEXT PRIMARY KEY,
      unread_count INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS message_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      participant TEXT NOT NULL,
      topic TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 0,
      last_message TEXT NOT NULL,
      last_at TEXT NOT NULL
    )`,
  ];

  for (const sql of statements) {
    await execute(sql);
  }
};

const ensureUserState = async (userId, overrides = {}) => {
  await execute(
    `INSERT OR IGNORE INTO learning_plans (
      user_id, profile_completed, first_session_booked, challenge_joined, skills_target, skills_completed
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      boolInt(overrides.profileCompleted),
      boolInt(overrides.firstSessionBooked),
      boolInt(overrides.challengeJoined),
      overrides.skillsTarget ?? 4,
      overrides.skillsCompleted ?? 0,
    ]
  );

  await execute(
    'INSERT OR IGNORE INTO messages (user_id, unread_count) VALUES (?, ?)',
    [userId, overrides.unreadCount ?? 0]
  );
};

const pushNotification = async (userId, title, detail) => {
  await execute(
    `INSERT INTO notifications (id, user_id, title, detail, created_at, read)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [newId('n'), userId, title, detail, nowIso()]
  );
};

const seedDatabase = async () => {
  const hasUsers = await getRow('SELECT COUNT(*) AS count FROM users');
  if (rowCount(hasUsers) > 0) {
    return;
  }

  for (const name of seed.categories) {
    await execute('INSERT INTO categories (name) VALUES (?)', [name]);
  }

  for (const card of seed.discoveryCards) {
    await execute(
      `INSERT INTO discovery_cards (
        id, name, persona, title, skill, category, country, rating, bio, next_session_slots
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.name,
        card.persona,
        card.title,
        card.skill,
        card.category,
        card.country,
        card.rating,
        card.bio,
        JSON.stringify(card.nextSessionSlots),
      ]
    );
  }

  for (const event of seed.events) {
    await execute(
      'INSERT INTO events (id, title, description, base_participants) VALUES (?, ?, ?, ?)',
      [
        event.id,
        event.title,
        event.description,
        Math.max(event.participants - (event.joined ? 1 : 0), 0),
      ]
    );
  }

  const demoUser = seed.users[0];
  const demoUserId = demoUser.id;
  await execute(
    `INSERT INTO users (
      id, name, email, password_hash, headline, bio, country, skills_offered, skills_to_learn, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      demoUser.id,
      demoUser.name,
      demoUser.email.toLowerCase(),
      bcrypt.hashSync(demoUser.password, 10),
      demoUser.headline,
      demoUser.bio,
      demoUser.country,
      JSON.stringify(demoUser.skillsOffered),
      JSON.stringify(demoUser.skillsToLearn),
      nowIso(),
    ]
  );

  await ensureUserState(demoUserId, {
    profileCompleted: seed.learningPlan.profileCompleted,
    firstSessionBooked: seed.learningPlan.firstSessionBooked,
    challengeJoined: seed.learningPlan.challengeJoined,
    skillsTarget: seed.learningPlan.skillsTarget,
    skillsCompleted: seed.learningPlan.skillsCompleted,
    unreadCount: seed.messages.unreadCount,
  });

  for (const card of seed.discoveryCards) {
    if (card.connected || card.favorited) {
      await execute(
        `INSERT INTO user_card_state (user_id, card_id, connected, favorited)
         VALUES (?, ?, ?, ?)`,
        [
          demoUserId,
          card.id,
          boolInt(card.connected),
          boolInt(card.favorited),
        ]
      );
    }
  }

  for (const session of seed.sessions) {
    await execute(
      `INSERT INTO sessions (
        id, user_id, card_id, with_name, skill, time, status, created_at, calendar_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        demoUserId,
        session.cardId,
        session.with,
        session.skill,
        session.time,
        session.status,
        session.createdAt,
        session.calendarUrl,
      ]
    );
  }

  for (const event of seed.events.filter((item) => item.joined)) {
    await execute(
      'INSERT OR IGNORE INTO user_event_state (user_id, event_id, joined_at) VALUES (?, ?, ?)',
      [demoUserId, event.id, nowIso()]
    );
  }

  for (const notification of seed.notifications) {
    await execute(
      `INSERT INTO notifications (id, user_id, title, detail, created_at, read)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        demoUserId,
        notification.title,
        notification.detail,
        notification.createdAt,
        boolInt(notification.read),
      ]
    );
  }

  for (const thread of seed.messageThreads) {
    await execute(
      `INSERT INTO message_threads (id, user_id, participant, topic, unread, last_message, last_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        thread.id,
        demoUserId,
        thread.participant,
        thread.topic,
        thread.unread,
        thread.lastMessage,
        thread.lastAt,
      ]
    );
  }
};

let initPromise;

const init = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await runMigrations();
      await seedDatabase();
    })();
  }
  return initPromise;
};

const createUser = async ({ name, email, password }) => {
  await init();
  const id = newId('user');
  const normalizedEmail = String(email).toLowerCase().trim();
  const passwordHash = bcrypt.hashSync(String(password), 10);

  await execute(
    `INSERT INTO users (
      id, name, email, password_hash, headline, bio, country, skills_offered, skills_to_learn, created_at
    ) VALUES (?, ?, ?, ?, '', '', '', '[]', '[]', ?)`,
    [id, String(name).trim(), normalizedEmail, passwordHash, nowIso()]
  );

  await ensureUserState(id);
  return getUserById(id);
};

const getUserByEmail = async (email) =>
  getRow('SELECT * FROM users WHERE email = ?', [
    String(email).toLowerCase().trim(),
  ]);

const getUserById = async (userId) =>
  sanitizeUserRow(await getRow('SELECT * FROM users WHERE id = ?', [userId]));

const verifyPassword = (userRow, password) =>
  Boolean(userRow && bcrypt.compareSync(String(password), userRow.password_hash));

const updateProfile = async (userId, updates) => {
  await init();
  const current = await getRow('SELECT * FROM users WHERE id = ?', [userId]);
  if (!current) {
    return null;
  }

  const next = {
    name: updates.name ?? current.name,
    headline: updates.headline ?? current.headline,
    bio: updates.bio ?? current.bio,
    country: updates.country ?? current.country,
    skillsOffered: updates.skillsOffered ?? parseList(current.skills_offered),
    skillsToLearn: updates.skillsToLearn ?? parseList(current.skills_to_learn),
  };

  await execute(
    `UPDATE users
     SET name = ?, headline = ?, bio = ?, country = ?, skills_offered = ?, skills_to_learn = ?
     WHERE id = ?`,
    [
      next.name,
      next.headline,
      next.bio,
      next.country,
      JSON.stringify(next.skillsOffered),
      JSON.stringify(next.skillsToLearn),
      userId,
    ]
  );

  await execute(
    'UPDATE learning_plans SET profile_completed = ? WHERE user_id = ?',
    [boolInt(profileCompleted(next)), userId]
  );

  return getUserById(userId);
};

const getPublicOverview = async () => {
  await init();
  const mentorCount = rowCount(
    await getRow(
      "SELECT COUNT(*) AS count FROM discovery_cards WHERE persona = 'teacher'"
    )
  );
  const learnerCount = rowCount(
    await getRow(
      "SELECT COUNT(*) AS count FROM discovery_cards WHERE persona = 'learner'"
    )
  );
  const featuredCards = (
    await getAll(
      `SELECT id, name, persona, title, skill, category, country, rating, bio, next_session_slots,
              0 AS connected, 0 AS favorited
       FROM discovery_cards
       ORDER BY rating DESC
       LIMIT 4`
    )
  ).map(rowToCard);
  const featuredEvents = await getAll(
    `SELECT id, title, description, base_participants AS participants, 0 AS joined
     FROM events
     ORDER BY base_participants DESC
     LIMIT 3`
  );

  return {
    totalMembers:
      rowCount(await getRow('SELECT COUNT(*) AS count FROM users')) +
      rowCount(await getRow('SELECT COUNT(*) AS count FROM discovery_cards')),
    mentorCount,
    learnerCount,
    sessionCount: rowCount(await getRow('SELECT COUNT(*) AS count FROM sessions')),
    categories: (await getAll('SELECT name FROM categories ORDER BY name')).map(
      (row) => row.name
    ),
    featuredCards,
    featuredEvents,
  };
};

const getCategories = async () =>
  (await getAll('SELECT name FROM categories ORDER BY name')).map(
    (row) => row.name
  );

const getDiscoveryCards = async (
  userId,
  { q = '', category = 'All', persona = 'All' }
) => {
  await init();
  const query = String(q).toLowerCase().trim();
  return (
    await getAll(
      `SELECT c.*,
              COALESCE(s.connected, 0) AS connected,
              COALESCE(s.favorited, 0) AS favorited
       FROM discovery_cards c
       LEFT JOIN user_card_state s
         ON s.card_id = c.id AND s.user_id = ?
       WHERE (? = '' OR lower(c.name) LIKE ? OR lower(c.skill) LIKE ? OR lower(c.title) LIKE ?)
         AND (? = 'All' OR c.category = ?)
         AND (? = 'All' OR c.persona = ?)
       ORDER BY c.rating DESC, c.name ASC`,
      [
        userId,
        query,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        category,
        category,
        persona,
        persona,
      ]
    )
  ).map(rowToCard);
};

const upsertCardState = async (userId, cardId, next) => {
  await execute(
    `INSERT INTO user_card_state (user_id, card_id, connected, favorited)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, card_id)
     DO UPDATE SET connected = excluded.connected, favorited = excluded.favorited`,
    [userId, cardId, boolInt(next.connected), boolInt(next.favorited)]
  );
};

const getCardForUser = async (userId, cardId) =>
  getRow(
    `SELECT c.*,
            COALESCE(s.connected, 0) AS connected,
            COALESCE(s.favorited, 0) AS favorited
     FROM discovery_cards c
     LEFT JOIN user_card_state s
       ON s.card_id = c.id AND s.user_id = ?
     WHERE c.id = ?`,
    [userId, cardId]
  );

const incrementUnreadMessages = async (userId, amount = 1) => {
  await execute(
    'UPDATE messages SET unread_count = unread_count + ? WHERE user_id = ?',
    [amount, userId]
  );
};

const toggleConnect = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextConnected = !Boolean(current.connected);
  await upsertCardState(userId, cardId, {
    connected: nextConnected,
    favorited: Boolean(current.favorited),
  });
  if (nextConnected) {
    await incrementUnreadMessages(userId, 1);
    await pushNotification(
      userId,
      'New connection',
      `You connected with ${current.name} for ${current.skill}.`
    );
  }
  return rowToCard(await getCardForUser(userId, cardId));
};

const toggleFavorite = async (userId, cardId) => {
  await init();
  const current = await getCardForUser(userId, cardId);
  if (!current) {
    return null;
  }
  const nextFavorited = !Boolean(current.favorited);
  await upsertCardState(userId, cardId, {
    connected: Boolean(current.connected),
    favorited: nextFavorited,
  });
  if (nextFavorited) {
    await pushNotification(
      userId,
      'Saved profile',
      `${current.name} was added to your favorites list.`
    );
  }
  return rowToCard(await getCardForUser(userId, cardId));
};

const getSessions = async (userId) =>
  (
    await getAll(
      `SELECT * FROM sessions
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`,
      [userId]
    )
  ).map(rowToSession);

const bookSession = async (userId, cardId, time) => {
  await init();
  const card = await getRow('SELECT * FROM discovery_cards WHERE id = ?', [cardId]);
  if (!card) {
    return null;
  }
  const id = newId('session');
  const createdAt = nowIso();
  const calendarUrl = `/api/sessions/${id}/calendar`;

  await execute(
    `INSERT INTO sessions (
      id, user_id, card_id, with_name, skill, time, status, created_at, calendar_url
    ) VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)`,
    [id, userId, card.id, card.name, card.skill, time, createdAt, calendarUrl]
  );

  await execute(
    `UPDATE learning_plans
     SET first_session_booked = 1
     WHERE user_id = ?`,
    [userId]
  );

  await incrementUnreadMessages(userId, 1);
  await pushNotification(
    userId,
    'Booking confirmed',
    `${card.name} session is booked for ${time}.`
  );
  return rowToSession(await getRow('SELECT * FROM sessions WHERE id = ?', [id]));
};

const updateSessionStatus = async (userId, sessionId, status) => {
  await init();
  const session = await getRow(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  if (!session) {
    return null;
  }
  await execute('UPDATE sessions SET status = ? WHERE id = ? AND user_id = ?', [
    status,
    sessionId,
    userId,
  ]);
  await pushNotification(
    userId,
    'Session status updated',
    `${session.skill} with ${session.with_name} is now ${status}.`
  );
  return rowToSession(
    await getRow('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [
      sessionId,
      userId,
    ])
  );
};

const getSessionById = async (userId, sessionId) =>
  getRow('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [
    sessionId,
    userId,
  ]);

const getEvents = async (userId) =>
  (
    await getAll(
      `SELECT e.id, e.title, e.description,
              e.base_participants + COUNT(ues.user_id) AS participants,
              MAX(CASE WHEN ues.user_id = ? THEN 1 ELSE 0 END) AS joined
       FROM events e
       LEFT JOIN user_event_state ues ON ues.event_id = e.id
       GROUP BY e.id
       ORDER BY participants DESC, e.title ASC`,
      [userId]
    )
  ).map(rowToEvent);

const joinEvent = async (userId, eventId) => {
  await init();
  const event = await getRow('SELECT * FROM events WHERE id = ?', [eventId]);
  if (!event) {
    return null;
  }
  const existing = await getRow(
    'SELECT 1 AS found FROM user_event_state WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );
  if (!existing) {
    await execute(
      'INSERT INTO user_event_state (user_id, event_id, joined_at) VALUES (?, ?, ?)',
      [userId, eventId, nowIso()]
    );
    await execute(
      'UPDATE learning_plans SET challenge_joined = 1 WHERE user_id = ?',
      [userId]
    );
    await incrementUnreadMessages(userId, 1);
    await pushNotification(userId, 'Event joined', `You joined "${event.title}".`);
  }
  return (await getEvents(userId)).find((item) => item.id === eventId) || null;
};

const getLearningPlan = async (userId) =>
  rowToLearningPlan(
    await getRow('SELECT * FROM learning_plans WHERE user_id = ?', [userId])
  );

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
  await execute(
    `UPDATE learning_plans
     SET profile_completed = ?, first_session_booked = ?, challenge_joined = ?, skills_target = ?, skills_completed = ?
     WHERE user_id = ?`,
    [
      boolInt(next.profileCompleted),
      boolInt(next.firstSessionBooked),
      boolInt(next.challengeJoined),
      next.skillsTarget,
      next.skillsCompleted,
      userId,
    ]
  );
  return getLearningPlan(userId);
};

const getMessages = async (userId) =>
  (await getRow('SELECT unread_count FROM messages WHERE user_id = ?', [userId])) || {
    unread_count: 0,
  };

const markMessagesRead = async (userId) => {
  await init();
  await execute('UPDATE messages SET unread_count = 0 WHERE user_id = ?', [userId]);
  await execute('UPDATE message_threads SET unread = 0 WHERE user_id = ?', [userId]);
  return { unreadCount: 0 };
};

const getNotifications = async (userId) =>
  (
    await getAll(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`,
      [userId]
    )
  ).map(rowToNotification);

const markNotificationsRead = async (userId) => {
  await init();
  await execute('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
  return getNotifications(userId);
};

const getMessageThreads = async (userId) =>
  (
    await getAll(
      `SELECT * FROM message_threads
       WHERE user_id = ?
       ORDER BY datetime(last_at) DESC`,
      [userId]
    )
  ).map(rowToThread);

const replyThread = async (userId, threadId, message) => {
  await init();
  const thread = await getRow(
    'SELECT * FROM message_threads WHERE id = ? AND user_id = ?',
    [threadId, userId]
  );
  if (!thread) {
    return null;
  }
  await execute(
    `UPDATE message_threads
     SET last_message = ?, last_at = ?, unread = 0
     WHERE id = ? AND user_id = ?`,
    [String(message).trim(), nowIso(), threadId, userId]
  );
  await pushNotification(
    userId,
    'Message sent',
    `Your reply was sent to ${thread.participant}.`
  );
  return rowToThread(
    await getRow('SELECT * FROM message_threads WHERE id = ? AND user_id = ?', [
      threadId,
      userId,
    ])
  );
};

module.exports = {
  provider: 'libsql',
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
