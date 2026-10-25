require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');

const db = require('./config/db');
const { apiRouter, googleAuth } = require('./routes/index');
const { autoCompleteExpiredVehicleReplacements } = require('./controllers/admin/vehicleReplacement.controller');
const { syncAllVehicleStatuses } = require('./services/vehicleSync.service');

const app = express();

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/documents', express.static(path.join(__dirname, 'Documents')));
app.use('/Documents', express.static(path.join(__dirname, 'Documents')));

// CORS Setup
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    // Allow any localhost port for development ease
    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Tunnel-Skip-Efficiency-Check'],
  exposedHeaders: ['Content-Length', 'Content-Disposition', 'Content-Type']
}));

// Body parsing middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Cross-Origin headers for OAuth popups
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Google OAuth routes (outside /api)
app.get('/auth/google/login', googleAuth.login);
app.get('/auth/google/callback', googleAuth.callback);

// Mount API router
app.use('/api', apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Cron Jobs (run every day at midnight: '0 0 * * *')
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running daily midnight tasks...');
  try {
    await autoCompleteExpiredVehicleReplacements();
    await syncAllVehicleStatuses();
    console.log('[CRON] Midnight tasks finished successfully');
  } catch (err) {
    console.error('[CRON] Midnight task error:', err);
  }
});

// Run once on startup
(async () => {
  try {
    console.log('[STARTUP] Reconciling vehicle statuses and checking expired replacements...');
    await autoCompleteExpiredVehicleReplacements();
    await syncAllVehicleStatuses();
    console.log('[STARTUP] Vehicle statuses reconciled');
  } catch (err) {
    console.error('[STARTUP] Error during initial sync:', err);
  }
})();

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '8080', 10);

if (require.main === module) {
  app.listen(port, host, () => {
    console.log(`Server running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  });
}

module.exports = app;
