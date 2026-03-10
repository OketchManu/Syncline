// api/src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./config/database');
const { initializeWebSocket } = require('./config/websocket');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Static file serving for uploaded avatars
const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Multer — multipart/form-data for avatar uploads
let multerMiddleware = (req, res, next) => next();
try {
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `user-${req.user?.id || 'unknown'}-${Date.now()}${ext}`);
        },
    });
    const upload = multer({
        storage,
        limits: { fileSize: 3 * 1024 * 1024 },
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Syncline API' });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        message: 'Syncline API v1.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login:    'POST /api/auth/login',
                refresh:  'POST /api/auth/refresh',
                me:       'GET /api/auth/me',
                logout:   'POST /api/auth/logout'
            },
            tasks: {
                getAll:   'GET /api/tasks',
                getById:  'GET /api/tasks/:id',
                getMy:    'GET /api/tasks/my',
                getStats: 'GET /api/tasks/stats',
                getOverdue: 'GET /api/tasks/overdue',
                create:   'POST /api/tasks',
                update:   'PUT /api/tasks/:id',
                flag:     'PATCH /api/tasks/:id/flag',
                unflag:   'PATCH /api/tasks/:id/unflag',
                delete:   'DELETE /api/tasks/:id',
                audit:    'GET /api/tasks/:id/audit'
            },
            users: {
                getAll:         'GET /api/users',
                getOnline:      'GET /api/users/online',
                getMe:          'GET /api/users/me',
                updateMe:       'PUT /api/users/me',
                changePassword: 'PUT /api/users/me/password',
                deleteMe:       'DELETE /api/users/me'
            },
            company: {
                team:          'GET /api/company/team',
                invite:        'POST /api/company/team/invite',
                invitations:   'GET /api/company/invitations',
                join:          'POST /api/company/join/:code',
                updateRole:    'PATCH /api/company/team/:id/role',
                removeMember:  'DELETE /api/company/team/:id'
            },
            websocket: 'ws://localhost:3001/ws'
        }
    });
});

// Route modules — only imported once, from the correct relative path
const authRoutes        = require('./routes/auth.routes');
const taskRoutes        = require('./routes/task.routes');
const userRoutes        = require('./routes/users.routes');
const companyRoutes     = require('./routes/company.routes');
const taskReportsRoutes = require('./routes/task-reports.routes');

// Mount routes — /api/tasks/reports must come before /api/tasks to avoid conflict
app.use('/api/auth',          authRoutes);
app.use('/api/tasks/reports', taskReportsRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/company',       companyRoutes);

console.log('✅ All routes loaded successfully');

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
async function startServer() {
    try {
        await initializeDatabase();

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
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

process.on('SIGTERM', () => { console.log('SIGTERM received, shutting down...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('\nSIGINT received, shutting down...');  process.exit(0); });