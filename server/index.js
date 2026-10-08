import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config, ROOT } from './lib/config.js';
import './lib/db.js';
import dataRoutes from './routes/data.js';
import modelRoutes from './routes/models.js';
import aiRoutes from './routes/ai.js';
import shareRoutes from './routes/share.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Public share links work without the app password; everything else is protected when APP_PASSWORD is set.
app.use('/share', shareRoutes);

if (config.appPassword) {
  const want = crypto.createHash('sha256').update(config.appPassword).digest();
  app.use((req, res, next) => {
    const [type, value] = (req.headers.authorization || '').split(' ');
    if (type === 'Basic' && value) {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      const got = crypto.createHash('sha256').update(pass).digest();
      if (crypto.timingSafeEqual(want, got)) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="DealDesk", charset="UTF-8"');
    res.status(401).send('Password required');
  });
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/models', modelRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', dataRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built frontend in production (npm run build).
const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|share).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Errors: friendly message + any AI attempt details. Never echo secrets or stack traces.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500 && !err.attempts) console.error('[error]', err.message);
  res.status(status).json({ error: status >= 500 && !err.attempts ? 'Something went wrong on the server. Please try again.' : err.message, attempts: err.attempts });
});

app.listen(config.port, config.host, () => {
  console.log(`DealDesk API running at http://${config.host}:${config.port}`);
  if (fs.existsSync(dist)) console.log(`Open the app at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
});
