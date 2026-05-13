const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const {
  PORT,
  AUTH_SECRET,
  TOKEN_TTL_MS,
  CORS_ORIGIN,
} = require('./config');
const db = require('./db');

const app = express();
const dbReady = db.init();

app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
  })
);
app.use(express.json());
app.use(async (_, __, next) => {
  try {
    await dbReady;
    next();
  } catch (error) {
    next(error);
  }
});

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const formatDateForICS = (isoString) =>
  new Date(isoString).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const sign = (value) =>
  crypto.createHmac('sha256', AUTH_SECRET).update(value).digest('hex');

const createToken = (userId) => {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Date.now() + TOKEN_TTL_MS,
    }),
    'utf8'
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const readToken = (token) => {
  const [payload = '', signature = ''] = String(token).split('.');
  if (!payload || !signature) {
    return null;
  }
  const expected = sign(payload);
  if (expected !== signature) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed.userId;
  } catch {
    return null;
  }
};

const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : '';
  const queryToken =
    typeof req.query.token === 'string' ? req.query.token : '';
  const token = bearerToken || queryToken;
  const userId = token ? readToken(token) : null;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  return next();
};

app.get('/api/health', (_, res) => {
  res.json({ ok: true, database: db.provider || 'unknown' });
});

app.get(
  '/api/public-overview',
  asyncHandler(async (_, res) => {
    res.json(await db.getPublicOverview());
  })
);

app.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: 'name, email, and password are required' });
  }
  const existing = await db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = await db.createUser({ name, email, password });
  return res.json({ token: createToken(user.id), user });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const userRow = await db.getUserByEmail(email);
  if (!db.verifyPassword(userRow, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = await db.getUserById(userRow.id);
  return res.json({ token: createToken(user.id), user });
  })
);

app.get('/api/auth/me', authRequired, asyncHandler(async (req, res) => {
  const user = await db.getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
}));

app.get('/api/profile', authRequired, asyncHandler(async (req, res) => {
  const user = await db.getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
}));

app.patch('/api/profile', authRequired, asyncHandler(async (req, res) => {
  const nextUser = await db.updateProfile(req.userId, req.body || {});
  if (!nextUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(nextUser);
}));

app.get('/api/categories', authRequired, asyncHandler(async (_, res) => {
  res.json(await db.getCategories());
}));

app.get('/api/discovery', authRequired, asyncHandler(async (req, res) => {
  const { q = '', category = 'All', persona = 'All' } = req.query;
  res.json(
    await db.getDiscoveryCards(req.userId, {
      q,
      category,
      persona,
    })
  );
}));

app.post('/api/discovery/:id/connect', authRequired, asyncHandler(async (req, res) => {
  const card = await db.toggleConnect(req.userId, req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }
  return res.json(card);
}));

app.post('/api/discovery/:id/favorite', authRequired, asyncHandler(async (req, res) => {
  const card = await db.toggleFavorite(req.userId, req.params.id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }
  return res.json(card);
}));

app.get('/api/sessions', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.getSessions(req.userId));
}));

app.post('/api/sessions/book', authRequired, asyncHandler(async (req, res) => {
  const { cardId, time } = req.body;
  if (!cardId || !time) {
    return res.status(400).json({ error: 'cardId and time are required' });
  }
  const booking = await db.bookSession(req.userId, cardId, time);
  if (!booking) {
    return res.status(404).json({ error: 'Discovery card not found' });
  }
  return res.json(booking);
}));

app.patch('/api/sessions/:id/status', authRequired, asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = new Set(['upcoming', 'live', 'completed']);
  if (!allowed.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const session = await db.updateSessionStatus(req.userId, req.params.id, status);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  return res.json(session);
}));

app.get('/api/sessions/:id/calendar', authRequired, asyncHandler(async (req, res) => {
  const session = await db.getSessionById(req.userId, req.params.id);
  if (!session) {
    return res.status(404).send('Session not found');
  }
  const startAt = new Date(session.created_at).toISOString();
  const endAt = new Date(
    new Date(session.created_at).getTime() + 45 * 60 * 1000
  ).toISOString();
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkillSwap//Session Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@skillsswap.app`,
    `DTSTAMP:${formatDateForICS(new Date().toISOString())}`,
    `DTSTART:${formatDateForICS(startAt)}`,
    `DTEND:${formatDateForICS(endAt)}`,
    `SUMMARY:SkillSwap - ${session.skill}`,
    `DESCRIPTION:Session with ${session.with_name}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${session.id}.ics"`
  );
  return res.send(ics);
}));

app.get('/api/events', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.getEvents(req.userId));
}));

app.post('/api/events/:id/join', authRequired, asyncHandler(async (req, res) => {
  const event = await db.joinEvent(req.userId, req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  return res.json(event);
}));

app.get('/api/learning-plan', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.getLearningPlan(req.userId));
}));

app.patch('/api/learning-plan', authRequired, asyncHandler(async (req, res) => {
  const plan = await db.updateLearningPlan(req.userId, req.body || {});
  if (!plan) {
    return res.status(404).json({ error: 'Learning plan not found' });
  }
  return res.json(plan);
}));

app.get('/api/messages', authRequired, asyncHandler(async (req, res) => {
  const messages = await db.getMessages(req.userId);
  res.json({ unreadCount: Number(messages.unread_count || 0) });
}));

app.post('/api/messages/read', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.markMessagesRead(req.userId));
}));

app.get('/api/notifications', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.getNotifications(req.userId));
}));

app.post('/api/notifications/read', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.markNotificationsRead(req.userId));
}));

app.get('/api/messages/threads', authRequired, asyncHandler(async (req, res) => {
  res.json(await db.getMessageThreads(req.userId));
}));

app.post('/api/messages/threads/:id/reply', authRequired, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const thread = await db.replyThread(req.userId, req.params.id, message);
  if (!thread) {
    return res.status(404).json({ error: 'Thread not found' });
  }
  return res.json(thread);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  dbReady
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `SkillSwap backend listening on http://localhost:${PORT} using ${db.provider || 'unknown'}`
        );
      });
    })
    .catch((error) => {
      console.error('Failed to start SkillSwap backend', error);
      process.exit(1);
    });
}

module.exports = app;
