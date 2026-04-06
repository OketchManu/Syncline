// api/src/server.js
require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// ✅ Initialize Firebase FIRST
const { initializeFirebase } = require('./config/firebase');
initializeFirebase();

const { backfillInviteCodes }            = require('./config/backfill');
const { initializeDatabase, getDB_PATH } = require('./config/database');
const { runMigrations }                  = require('./config/migrate');
const { initializeWebSocket }            = require('./config/websocket');
const { resetDatabaseIfStale }           = require('./config/database');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://syncline-8010e.web.app',
    'https://syncline-8010e.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request logging ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ─── Static uploads ───────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Multer ───────────────────────────────────────────────────────────────────
let multerMiddleware = (req, res, next) => next();
try {
  const multer  = require('multer');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `user-${req.user?.id || 'unknown'}-${Date.now()}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits:     { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
  multerMiddleware = upload.single('avatar');
  console.log('✅ Multer loaded — avatar uploads enabled');
} catch (_) {
  console.log('ℹ️  Multer not installed — avatar uploads use base64 fallback');
}
app.set('multerMiddleware', multerMiddleware);

// ─── Logo uploads ─────────────────────────────────────────────────────────────
const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
  console.log('✅ Logo uploads enabled');
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Syncline API' });
});

app.get('/',    (req, res) => res.json({ message: 'Syncline API v1.0', status: 'running' }));
app.get('/api', (req, res) => res.json({ message: 'Syncline API v1.0' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth.routes');
const taskRoutes        = require('./routes/task.routes');
const userRoutes        = require('./routes/users.routes');
const companyRoutes     = require('./routes/company.routes');
const taskReportsRoutes = require('./routes/task-reports.routes');

app.use('/api/auth',         authRoutes);
app.use('/api/task-reports', taskReportsRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/company',      companyRoutes);

console.log('✅ All routes loaded successfully');

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // ── RESET_DB: nuclear option ─────────────────────────────────────────────
    // Set RESET_DB=true in Render env vars to wipe and recreate the DB.
    // After one successful deploy, remove the env var so it doesn't reset again.
    if (process.env.RESET_DB === 'true') {
      const { DB_PATH } = require('./config/database');
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('🗑️  RESET_DB=true — deleted stale database file:', DB_PATH);
      } else {
        console.log('ℹ️  RESET_DB=true — no database file found to delete');
      }
    }

    await resetDatabaseIfStale();   // no-op now, kept for safety
    await initializeDatabase();     // create tables
    await runMigrations();          // add missing columns / fix schema
    await backfillInviteCodes();    // backfill invite codes

    const server = http.createServer(app);
    initializeWebSocket(server);

    server.listen(PORT, () => {
      console.log('╔═══════════════════════════════════════════╗');
      console.log('║      Syncline API Server Started          ║');
      console.log('╚═══════════════════════════════════════════╝');
      console.log(`🚀 HTTP Server:  http://localhost:${PORT}`);
      console.log(`⚡ WebSocket:    ws://localhost:${PORT}/ws`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('✅ Routes mounted:');
      console.log('   - /api/auth');
      console.log('   - /api/tasks');
      console.log('   - /api/tasks/reports');
      console.log('   - /api/users');
      console.log('   - /api/company');
      console.log('   - /ws (WebSocket)');
      console.log('');
      console.log('Press Ctrl+C to stop the server');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('\nSIGINT received, shutting down...');  process.exit(0); });