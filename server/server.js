'use strict';

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { init } = require('./core/db');
const { ensureAdmin } = require('./core/auth');
const { loginLimiter } = require('./core/rateLimit');
const { errorMiddleware } = require('./core/errors');
const { ok: okResp } = require('./core/errors');

// --- Module routes ---
const userRoutes = require('./modules/user/user.routes');
const saveRoutes = require('./modules/save/save.routes');
const configRoutes = require('./modules/game/config.routes');
const gameplayRoutes = require('./modules/game/gameplay.routes');
const boardRoutes = require('./modules/community/board.routes');
const leaderboardRoutes = require('./modules/community/leaderboard.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const simulatorRoutes = require('./modules/game/simulator.routes');
const metricsRoutes = require('./modules/community/metrics.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Global middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// --- Rate limiting ---
app.use('/api/auth/login', loginLimiter);

// --- API routes ---
app.use('/api', userRoutes);
app.use('/api', saveRoutes);
app.use('/api', configRoutes);
app.use('/api', gameplayRoutes);
app.use('/api', boardRoutes);
app.use('/api', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', simulatorRoutes);
app.use('/api/admin/metrics', metricsRoutes);

// --- Story endpoint ---
app.get('/api/story', (req, res) => {
  const fs = require('fs');
  const storyPath = path.join(__dirname, '..', 'client', 'game', 'story', 'story.v1.json');
  try {
    const data = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
    res.json(okResp(data));
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: 'STORY_LOAD_FAILED', message: e.message } });
  }
});

// --- Static assets ---
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/server-assets', express.static(path.join(__dirname, 'assets')));

// --- Global error handler (must be last) ---
app.use(errorMiddleware);

// --- Startup ---
init()
  .then(() => {
    ensureAdmin();
    app.listen(PORT, () => {
      console.log('Server running at http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('DB init failed:', err);
    process.exit(1);
  });
