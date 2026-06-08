// api/src/server.js
require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// ── 1. Firebase Admin ─────────────────────────────────────────────────────────
const { initializeFirebase } = require('./config/firebase');
initializeFirebase();

// ── 2. Optional DB reset ──────────────────────────────────────────────────────
if (process.env.RESET_DB === 'true') {
    console.log('⚠️  RESET_DB=true — wiping stale database...');
    const dbPaths = [
        path.join(__dirname, '../../../database/syncline.db'),
        path.join(__dirname, '../../data/syncline.db'),
        path.join(__dirname, '../data/syncline.db'),
        path.join(__dirname, './database/syncline.db'),
    ];
    dbPaths.forEach(p => {
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); console.log(`🗑️  Deleted: ${p}`); }
            catch (e) { console.error(`❌ Could not delete ${p}:`, e.message); }
        }
    });
}

// ── 3. Database helpers ───────────────────────────────────────────────────────
const { initializeDatabase, ensureTaskSchema } = require('./config/database');
const { runMigrations }      = require('./config/migrate');
const { backfillInviteCodes } = require('./config/backfill');
const { initializeWebSocket } = require('./config/websocket');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── 4. Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        'https://syncline-8010e.web.app',
        'https://syncline-8010e.firebaseapp.com',
        'http://localhost:5173',
        'http://localhost:3000',
    ],
    credentials: true,
    methods:      ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Static uploads
const baseDir    = path.join(__dirname, '..');
const uploadsDir = path.join(baseDir, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(baseDir, 'uploads')));

// Health / root
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Syncline API' }));
app.get('/',       (_req, res) => res.json({ message: 'Syncline API v1.0' }));

// ── 5. Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/tasks',        require('./routes/task.routes'));
app.use('/api/users',        require('./routes/users.routes'));
app.use('/api/company',      require('./routes/company.routes'));
app.use('/api/task-reports', require('./routes/task-reports.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));

// 404 & error handler
app.use((_req, res)       => res.status(404).json({ error: 'Not Found' }));
app.use((err, _req, res, _next) => {
    console.error('Server Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── 6. Startup sequence ───────────────────────────────────────────────────────
// ORDER MATTERS:
//   a) initializeDatabase  — runs schema.sql / minimal schema → creates ALL tables
//   b) runMigrations       — adds missing columns, rebuilds if needed (needs tables to exist)
//   c) ensureTaskSchema    — belt-and-suspenders column heal (needs tasks table)
//   d) backfillInviteCodes — data backfill (needs companies table)
//
// Previously ensureTaskSchema ran BEFORE the tables were created which caused
// "no such table: tasks" errors in the heal step and left the `visibility`
// column missing → INSERT failed at runtime.
async function startServer() {
    try {
        console.log('🔄 Step 1: Initializing database (schema + tables)...');
        await initializeDatabase();
        console.log('✅ Database initialized successfully');

        console.log('🔄 Step 2: Running migrations (ALTER TABLE / rebuilds)...');
        await runMigrations();

        console.log('🔄 Step 3: Schema heal (belt-and-suspenders column check)...');
        await ensureTaskSchema();

        console.log('🔄 Step 4: Backfilling invite codes...');
        await backfillInviteCodes();

        const server = http.createServer(app);
        initializeWebSocket(server);

        server.listen(PORT, () => {
            console.log('\n╔═══════════════════════════════════════════╗');
            console.log('║      Syncline API Server Started          ║');
            console.log('╚═══════════════════════════════════════════╝');
            console.log(`\n🚀 HTTP Server: http://localhost:${PORT}`);
            console.log(`⚡ WebSocket:   ws://localhost:${PORT}/ws`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`);
            console.log('✅ Routes mounted:');
            console.log('   - /api/auth');
            console.log('   - /api/tasks');
            console.log('   - /api/users');
            console.log('   - /api/company');
            console.log('   - /api/task-reports');
            console.log('   - /ws (WebSocket)\n');
        });

        process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down...'); process.exit(0); });
        process.on('SIGINT',  () => { console.log('SIGINT received, shutting down...');  process.exit(0); });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();