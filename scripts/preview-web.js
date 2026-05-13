const express = require('express');
const path = require('path');

const app = express();
const distDir = path.join(__dirname, '..', 'dist');
const targetOrigin = process.env.PREVIEW_API_ORIGIN || 'http://localhost:4000';
const port = Number(process.env.PREVIEW_PORT || 3000);

app.use(
  '/api',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res, next) => {
    try {
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];

      const upstream = await fetch(`${targetOrigin}${req.originalUrl}`, {
        method: req.method,
        headers,
        body:
          req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-encoding') {
          return;
        }
        res.setHeader(key, value);
      });

      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    } catch (error) {
      next(error);
    }
  }
);

app.use(express.static(distDir));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Preview server error', error);
  res.status(502).json({ error: 'Preview server upstream failure' });
});

app.listen(port, () => {
  console.log(`SkillSwap preview available on http://localhost:${port}`);
});
