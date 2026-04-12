import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import uploadRoute from './routes/upload.js';
import sendRoute from './routes/send.js';
import pingRoute from './routes/ping.js';
import aiRoute from './routes/ai.js';
import eventRoute from './routes/event.js';
import stripeRoute from './routes/stripe.js';
import tenantRoute from './routes/tenant.js';
import onboardRoute from './routes/onboard.js';
import platformRoute from './routes/platform.js';
import { requireProduct } from './lib/access.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://autofilm.io',
    'https://www.autofilm.io',
    /\.autofilm\.io$/,
    // Local dev
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/api/stripe-webhook', stripeRoute);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', env: process.env.NODE_ENV });
});

// Platform routes (shared across all products)
app.use('/api/platform', platformRoute);
app.use('/api/tenant', tenantRoute);
app.use('/api/onboard', onboardRoute);

// AutoFilm product routes (access-gated)
app.use('/api/upload', requireProduct('autofilm'), uploadRoute);
app.use('/api/send', requireProduct('autofilm'), sendRoute);
app.use('/v', pingRoute);           // public — player pings don't need auth
app.use('/api/ai-script', requireProduct('autofilm'), aiRoute);
app.use('/api/event', eventRoute);   // public — watch tracking

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.stack || err.message);
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[autofilm-api] Running on port ${PORT}`);
  console.log(`[autofilm-api] Env: ${process.env.NODE_ENV}`);
});
