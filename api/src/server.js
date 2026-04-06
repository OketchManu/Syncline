// api/src/server.js
require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// ✅ 1. Initialize Firebase Admin
const { initializeFirebase } = require('./config/firebase');
initializeFirebase();

// ✅ 2. PRE-EMPTIVE RESET (Solves "users_old" ghost table error)
// If RESET_DB=true is set, we delete the file BEFORE requiring database.js
// This ensures no stale connection is held.
if (process.env.RESET_DB === 'true') {
    console.log('⚠️  RESET_DB=true detected. Attempting to wipe stale database...');
    const dbPaths = [
        path.join(__dirname, '../../../database/syncline.db'),
        path.join(__dirname, '../../data/syncline.db'),
        path.join(__dirname, '../data/syncline.db')
    ];
    dbPaths.forEach(p => {
        if (fs.existsSync(p)) {
            try {
                fs.unlinkSync(p);
                console.log(`🗑️  Deleted: ${p}`);
            } catch (e) {
                console.error(`❌ Could not delete ${p}:`, e.message);
            }
        }
    });
}

// ✅ 3. Now require Database (Safe connection)
const { initializeDatabase } = require('./config/database');
const { runMigrations }      = require('./config/migrate');
const { backfillInviteCodes } = require('./config/backfill');
const { initializeWebSocket } = require('./config/websocket');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        'https://syncline-8010e.web.app',
        'https://syncline-8010e.firebaseapp.com',
        'http://localhost:5173',
        'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Static uploads
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health checks
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Syncline API' }));
app.get('/', (req, res) => res.json({ message: 'Syncline API v1.0' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/tasks',        require('./routes/task.routes'));
app.use('/api/users',        require('./routes/users.routes'));
app.use('/api/company',      require('./routes/company.routes'));
app.use('/api/task-reports', require('./routes/task-reports.routes'));

// 404 & Error Handler
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ─── Server Startup ───────────────────────────────────────────────────────────
async function startServer() {
    try {
        console.log('🔄 Initializing Database...');
        await initializeDatabase();
        
        console.log('🔄 Running Migrations...');
        await runMigrations();
        
        console.log('🔄 Maintenance: Backfilling codes...');
        await backfillInviteCodes();

        const server = http.createServer(app);
        initializeWebSocket(server);

        server.listen(PORT, () => {
            console.log('╔═══════════════════════════════════════════╗');
            console.log(`║      Syncline API Server on Port ${PORT}     ║`);
            console.log('╚═══════════════════════════════════════════╝');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));