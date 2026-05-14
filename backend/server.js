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
const streamClients = new Map();

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
  new Date(isoString)
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0] + 'Z';

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
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

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
    typeof req.query.token === 'string'
      ? req.query.token
      : '';

  const token = bearerToken || queryToken;

  const userId = token ? readToken(token) : null;

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  req.userId = userId;

  return next();
};

const sendStreamEvent = (userId, payload) => {
  const clients = streamClients.get(userId);

  if (!clients || !clients.size) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;

  clients.forEach((client) => client.write(message));
};

const sendRefresh = (userId, scope = 'all') => {
  sendStreamEvent(userId, {
    type: 'refresh',
    scope,
    at: new Date().toISOString(),
  });
};

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/stream', authRequired, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders?.();

  const userId = req.userId;

  const clients = streamClients.get(userId) || new Set();

  clients.add(res);

  streamClients.set(userId, clients);

  res.write(
    `data: ${JSON.stringify({
      type: 'connected',
      at: new Date().toISOString(),
    })}\n\n`
  );

  const keepAlive = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);

    const nextClients = streamClients.get(userId);

    nextClients?.delete(res);

    if (!nextClients?.size) {
      streamClients.delete(userId);
    }
  });
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
      return res.status(400).json({
        error: 'name, email, and password are required',
      });
    }

    const existing = await db.getUserByEmail(email);

    if (existing) {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    const user = await db.createUser({
      name,
      email,
      password,
    });

    return res.json({
      token: createToken(user.id),
      user,
    });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required',
      });
    }

    const userRow = await db.getUserByEmail(email);

    if (!db.verifyPassword(userRow, password)) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const user = await db.getUserById(userRow.id);

    return res.json({
      token: createToken(user.id),
      user,
    });
  })
);

app.get(
  '/api/auth/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await db.getUserById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.json({ user });
  })
);

app.get(
  '/api/profile',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await db.getUserById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.json(user);
  })
);

app.patch(
  '/api/profile',
  authRequired,
  asyncHandler(async (req, res) => {
    const updated = await db.updateProfile(req.userId, req.body || {});

    if (!updated) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    sendRefresh(req.userId, 'profile');
    return res.json(updated);
  })
);

app.get(
  '/api/categories',
  authRequired,
  asyncHandler(async (_req, res) => {
    return res.json(await db.getCategories());
  })
);

app.get(
  '/api/discovery',
  authRequired,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const category = typeof req.query.category === 'string' ? req.query.category : 'All';
    const persona = typeof req.query.persona === 'string' ? req.query.persona : 'All';

    return res.json(
      await db.getDiscoveryCards(req.userId, q, category, persona)
    );
  })
);

app.post(
  '/api/discovery/:id/connect',
  authRequired,
  asyncHandler(async (req, res) => {
    const updated = await db.toggleConnect(req.userId, req.params.id);

    if (!updated) {
      return res.status(404).json({
        error: 'Profile not found',
      });
    }

    sendRefresh(req.userId, 'discovery');
    return res.json(updated);
  })
);

app.post(
  '/api/discovery/:id/favorite',
  authRequired,
  asyncHandler(async (req, res) => {
    const updated = await db.toggleFavorite(req.userId, req.params.id);

    if (!updated) {
      return res.status(404).json({
        error: 'Profile not found',
      });
    }

    sendRefresh(req.userId, 'discovery');
    return res.json(updated);
  })
);

app.get(
  '/api/sessions',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getSessions(req.userId));
  })
);

app.post(
  '/api/sessions/book',
  authRequired,
  asyncHandler(async (req, res) => {
    const { cardId, time, format, goal, note } = req.body || {};

    if (!cardId || !time) {
      return res.status(400).json({
        error: 'cardId and time are required',
      });
    }

    const session = await db.bookSession(req.userId, cardId, time, {
      format,
      goal,
      note,
    });

    if (!session) {
      return res.status(404).json({
        error: 'Member not found',
      });
    }

    sendRefresh(req.userId, 'sessions');
    return res.json(session);
  })
);

app.patch(
  '/api/sessions/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const updated = await db.updateSession(req.userId, req.params.id, req.body || {});

    if (!updated) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    sendRefresh(req.userId, 'sessions');
    return res.json(updated);
  })
);

app.patch(
  '/api/sessions/:id/status',
  authRequired,
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({
        error: 'status is required',
      });
    }

    const updated = await db.updateSessionStatus(req.userId, req.params.id, status);

    if (!updated) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    sendRefresh(req.userId, 'sessions');
    return res.json(updated);
  })
);

app.get(
  '/api/sessions/:id/calendar',
  authRequired,
  asyncHandler(async (req, res) => {
    const session = await db.getSessionById(req.userId, req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    const start = new Date(session.time);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const summary = `${session.skill} session with ${session.with_name}`;
    const descriptionParts = [
      session.goal ? `Goal: ${session.goal}` : '',
      session.note ? `Note: ${session.note}` : '',
      session.meeting_link ? `Meeting link: ${session.meeting_link}` : '',
    ].filter(Boolean);
    const location = session.meeting_link || 'SkillsSwap';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SkillsSwap//EN',
      'BEGIN:VEVENT',
      `UID:${session.id}@skillsswap`,
      `DTSTAMP:${formatDateForICS(new Date().toISOString())}`,
      `DTSTART:${formatDateForICS(start.toISOString())}`,
      `DTEND:${formatDateForICS(end.toISOString())}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${descriptionParts.join('\\n')}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${session.id}.ics"`);
    return res.send(ics);
  })
);

app.get(
  '/api/events',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getEvents(req.userId));
  })
);

app.post(
  '/api/events/:id/join',
  authRequired,
  asyncHandler(async (req, res) => {
    const event = await db.joinEvent(req.userId, req.params.id);

    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
      });
    }

    sendRefresh(req.userId, 'events');
    return res.json(event);
  })
);

app.post(
  '/api/events/:id/reminder',
  authRequired,
  asyncHandler(async (req, res) => {
    const event = await db.toggleEventReminder(req.userId, req.params.id);

    if (!event) {
      return res.status(404).json({
        error: 'Event not found',
      });
    }

    sendRefresh(req.userId, 'events');
    return res.json(event);
  })
);

app.get(
  '/api/learning-plan',
  authRequired,
  asyncHandler(async (req, res) => {
    const plan = await db.getLearningPlan(req.userId);

    if (!plan) {
      return res.status(404).json({
        error: 'Learning plan not found',
      });
    }

    return res.json(plan);
  })
);

app.patch(
  '/api/learning-plan',
  authRequired,
  asyncHandler(async (req, res) => {
    const plan = await db.updateLearningPlan(req.userId, req.body || {});

    if (!plan) {
      return res.status(404).json({
        error: 'Learning plan not found',
      });
    }

    sendRefresh(req.userId, 'learning-plan');
    return res.json(plan);
  })
);

app.get(
  '/api/messages',
  authRequired,
  asyncHandler(async (req, res) => {
    const messages = await db.getMessages(req.userId);
    return res.json({
      unreadCount: Number(messages?.unreadCount ?? messages?.unread_count ?? 0),
      humanUnread: Number(messages?.humanUnread ?? messages?.human_unread ?? 0),
      systemUnread: Number(messages?.systemUnread ?? messages?.system_unread ?? 0),
      bookingUnread: Number(messages?.bookingUnread ?? messages?.booking_unread ?? 0),
    });
  })
);

app.post(
  '/api/messages/read',
  authRequired,
  asyncHandler(async (req, res) => {
    const messages = await db.markMessagesRead(req.userId);
    sendRefresh(req.userId, 'messages');
    return res.json(messages);
  })
);

app.get(
  '/api/notifications',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getNotifications(req.userId));
  })
);

app.post(
  '/api/notifications/read',
  authRequired,
  asyncHandler(async (req, res) => {
    const notifications = await db.markNotificationsRead(req.userId);
    sendRefresh(req.userId, 'notifications');
    return res.json(notifications);
  })
);

app.get(
  '/api/messages/threads',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getMessageThreads(req.userId));
  })
);

app.post(
  '/api/messages/threads/:id/reply',
  authRequired,
  asyncHandler(async (req, res) => {
    const { message } = req.body || {};

    if (!String(message || '').trim()) {
      return res.status(400).json({
        error: 'message is required',
      });
    }

    const thread = await db.replyThread(req.userId, req.params.id, message);

    if (!thread) {
      return res.status(404).json({
        error: 'Thread not found',
      });
    }

    sendRefresh(req.userId, 'threads');
    return res.json(thread);
  })
);

app.get(
  '/api/admin/dashboard',
  authRequired,
  asyncHandler(async (req, res) => {
    const dashboard = await db.getAdminDashboard(req.userId);

    if (!dashboard) {
      return res.status(403).json({
        error: 'Operator access required',
      });
    }

    return res.json(dashboard);
  })
);

app.post(
  '/api/admin/mentors/:id/feature',
  authRequired,
  asyncHandler(async (req, res) => {
    const card = await db.featureMentor(
      req.userId,
      req.params.id,
      Boolean(req.body?.featured)
    );

    if (!card) {
      return res.status(404).json({
        error: 'Mentor not found or operator access required',
      });
    }

    sendRefresh(req.userId, 'admin');
    return res.json(card);
  })
);

app.post(
  '/api/admin/reports/:id/resolve',
  authRequired,
  asyncHandler(async (req, res) => {
    const dashboard = await db.resolveAdminReport(req.userId, req.params.id);

    if (!dashboard) {
      return res.status(404).json({
        error: 'Report not found or operator access required',
      });
    }

    sendRefresh(req.userId, 'admin');
    return res.json(dashboard);
  })
);

app.patch(
  '/api/admin/events/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const event = await db.updateAdminEvent(req.userId, req.params.id, req.body || {});

    if (!event) {
      return res.status(404).json({
        error: 'Event not found or operator access required',
      });
    }

    sendRefresh(req.userId, 'events');
    return res.json(event);
  })
);

app.get(
  '/api/portfolio/assets',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getPortfolioAssets(req.userId));
  })
);

app.post(
  '/api/portfolio/assets',
  authRequired,
  asyncHandler(async (req, res) => {
    const { title, url, kind } = req.body || {};

    if (!String(title || '').trim() || !String(url || '').trim()) {
      return res.status(400).json({
        error: 'title and url are required',
      });
    }

    const asset = await db.addPortfolioAsset(req.userId, { title, url, kind });
    sendRefresh(req.userId, 'portfolio');
    return res.json(asset);
  })
);

app.delete(
  '/api/portfolio/assets/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const removed = await db.removePortfolioAsset(req.userId, req.params.id);

    if (!removed) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    sendRefresh(req.userId, 'portfolio');
    return res.json({ ok: true });
  })
);

app.get(
  '/api/events/:id/discussion',
  authRequired,
  asyncHandler(async (req, res) => {
    return res.json(await db.getEventDiscussion(req.userId, req.params.id));
  })
);

app.post(
  '/api/events/:id/discussion',
  authRequired,
  asyncHandler(async (req, res) => {
    const { message } = req.body || {};

    if (!String(message || '').trim()) {
      return res.status(400).json({
        error: 'message is required',
      });
    }

    const created = await db.postEventDiscussion(req.userId, req.params.id, message);

    if (!created) {
      return res.status(404).json({
        error: 'Event not found',
      });
    }

    sendRefresh(req.userId, 'events');
    return res.json(created);
  })
);

app.use((error, _req, res, _next) => {
  console.error(error);

  res.status(500).json({
    error: 'Internal server error',
  });
});

if (require.main === module) {
  dbReady
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(
          `SkillSwap backend listening on http://0.0.0.0:${PORT}`
        );

        console.log(
          `Health check: http://10.104.32.54:${PORT}/api/health`
        );
      });
    })
    .catch((error) => {
      console.error(
        'Failed to start SkillSwap backend',
        error
      );

      process.exit(1);
    });
}

module.exports = app;
