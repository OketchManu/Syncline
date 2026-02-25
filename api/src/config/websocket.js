// api/src/config/websocket.js
// WebSocket server for real-time updates

const WebSocket = require('ws');
const { verifyToken } = require('./jwt');

let wss = null;
const clients = new Map(); // Store connected clients with user info

/**
 * Initialize WebSocket server
 */
function initializeWebSocket(server) {
    wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', handleConnection);

    console.log('✅ WebSocket server initialized on /ws');
    
    return wss;
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws, req) {
    console.log('🔌 New WebSocket connection attempt');

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        console.log('❌ Connection rejected: No token provided');
        ws.close(1008, 'Authentication required');
        return;
    }

    try {
        // Verify token
        const decoded = verifyToken(token);
        
        // Store client info
        const clientInfo = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            ws: ws,
            connectedAt: new Date()
        };

        clients.set(ws, clientInfo);

        console.log(`✅ User connected: ${clientInfo.email} (ID: ${clientInfo.userId})`);
        console.log(`👥 Total connected clients: ${clients.size}`);

        // Send welcome message
        sendToClient(ws, {
            type: 'connection',
            message: 'Connected to Syncline WebSocket',
            userId: clientInfo.userId,
            timestamp: new Date().toISOString()
        });

        // Broadcast user online status
        broadcast({
            type: 'user:online',
            userId: clientInfo.userId,
            email: clientInfo.email,
            timestamp: new Date().toISOString()
        }, ws); // Exclude sender

        // Handle messages from client
        ws.on('message', (data) => handleMessage(ws, data, clientInfo));

        // Handle disconnection
        ws.on('close', () => handleDisconnection(ws, clientInfo));

        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for user ${clientInfo.email}:`, error);
        });

    } catch (error) {
        console.log(`❌ Connection rejected: ${error.message}`);
        ws.close(1008, 'Invalid token');
    }
}

/**
 * Handle incoming messages from client
 */
function handleMessage(ws, data, clientInfo) {
    try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Message from ${clientInfo.email}:`, message.type);

        switch (message.type) {
            case 'ping':
                sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
                break;

            case 'heartbeat':
                // Update last seen
                clientInfo.lastSeen = new Date();
                sendToClient(ws, { type: 'heartbeat_ack' });
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

/**
 * Handle client disconnection
 */
function handleDisconnection(ws, clientInfo) {
    clients.delete(ws);
    
    console.log(`🔌 User disconnected: ${clientInfo.email} (ID: ${clientInfo.userId})`);
    console.log(`👥 Total connected clients: ${clients.size}`);

    // Broadcast user offline status
    broadcast({
        type: 'user:offline',
        userId: clientInfo.userId,
        email: clientInfo.email,
        timestamp: new Date().toISOString()
    });
}

/**
 * Send message to specific client
 */
function sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

/**
 * Broadcast message to all connected clients
 */
function broadcast(data, excludeWs = null) {
    const message = JSON.stringify(data);
    
    clients.forEach((clientInfo, ws) => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

/**
 * Broadcast message to specific user
 */
function sendToUser(userId, data) {
    clients.forEach((clientInfo, ws) => {
        if (clientInfo.userId === userId && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

/**
 * Get all connected users
 */
function getConnectedUsers() {
    const users = [];
    clients.forEach((clientInfo) => {
        users.push({
            userId: clientInfo.userId,
            email: clientInfo.email,
            role: clientInfo.role,
            connectedAt: clientInfo.connectedAt
        });
    });
    return users;
}

/**
 * Check if user is connected
 */
function isUserConnected(userId) {
    for (const clientInfo of clients.values()) {
        if (clientInfo.userId === userId) {
            return true;
        }
    }
    return false;
}

module.exports = {
    initializeWebSocket,
    broadcast,
    sendToUser,
    sendToClient,
    getConnectedUsers,
    isUserConnected
};