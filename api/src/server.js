// api/src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');
const { initializeWebSocket } = require('./config/websocket');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Syncline API'
    });
});

// API Routes
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');

app.get('/api', (req, res) => {
    res.json({
        message: 'Syncline API v1.0',
        endpoints: {
            health: '/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                refresh: 'POST /api/auth/refresh',
                me: 'GET /api/auth/me',
                logout: 'POST /api/auth/logout'
            },
            tasks: {
                getAll: 'GET /api/tasks',
                getById: 'GET /api/tasks/:id',
                getMy: 'GET /api/tasks/my',
                getStats: 'GET /api/tasks/stats',
                getOverdue: 'GET /api/tasks/overdue',
                create: 'POST /api/tasks',
                update: 'PUT /api/tasks/:id',
                flag: 'PATCH /api/tasks/:id/flag',
                unflag: 'PATCH /api/tasks/:id/unflag',
                delete: 'DELETE /api/tasks/:id'
            },
            websocket: 'ws://localhost:3001/ws',
            users: '/api/users (coming soon)',
            activities: '/api/activities (coming soon)',
            sync: '/api/sync (coming soon)'
        }
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.path 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Create HTTP server
        const server = http.createServer(app);
        
        // Initialize WebSocket
        initializeWebSocket(server);
        
        // Start listening
        server.listen(PORT, () => {
            console.log('╔════════════════════════════════════════╗');
            console.log('║      Syncline API Server Started      ║');
            console.log('╚════════════════════════════════════════╝');
            console.log(`🚀 HTTP Server: http://localhost:${PORT}`);
            console.log(`⚡ WebSocket: ws://localhost:${PORT}/ws`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`💾 Database: ${process.env.DATABASE_URL}`);
            console.log('');
            console.log('✅ Routes mounted:');
            console.log('   - /api/auth');
            console.log('   - /api/tasks');
            console.log('   - /ws (WebSocket)');
            console.log('');
            console.log('Available endpoints:');
            console.log(`  - http://localhost:${PORT}/health`);
            console.log(`  - http://localhost:${PORT}/api`);
            console.log(`  - http://localhost:${PORT}/api/tasks`);
            console.log('');
            console.log('Press Ctrl+C to stop the server');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    process.exit(0);
});