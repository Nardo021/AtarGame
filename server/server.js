const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { init, getDb } = require('./db');
const { ensureAdmin } = require('./auth');
const { loginLimiter } = require('./rateLimit');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const metricsRoutes = require('./metrics.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth/login', loginLimiter);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/metrics', metricsRoutes);

app.use(express.static(path.join(__dirname, '..', 'client')));
// 可选：将素材放在 server/assets，通过 /server-assets/ 访问
app.use('/server-assets', express.static(path.join(__dirname, 'assets')));

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
