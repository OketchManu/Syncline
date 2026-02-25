// api/src/websocket/events.js
// WebSocket event broadcasters for real-time updates

const { broadcast, sendToUser } = require('../config/websocket');

/**
 * Broadcast task creation
 */
function broadcastTaskCreated(task, creatorInfo) {
    broadcast({
        type: 'task:created',
        task: task,
        creator: {
            id: creatorInfo.id,
            email: creatorInfo.email,
            fullName: creatorInfo.fullName
        },
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: Task created - "${task.title}"`);
}

/**
 * Broadcast task update
 */
function broadcastTaskUpdated(task, updaterInfo) {
    broadcast({
        type: 'task:updated',
        task: task,
        updater: {
            id: updaterInfo.id,
            email: updaterInfo.email,
            fullName: updaterInfo.fullName
        },
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: Task updated - "${task.title}"`);
}

/**
 * Broadcast task deletion
 */
function broadcastTaskDeleted(taskId, deleterInfo) {
    broadcast({
        type: 'task:deleted',
        taskId: taskId,
        deleter: {
            id: deleterInfo.id,
            email: deleterInfo.email,
            fullName: deleterInfo.fullName
        },
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: Task deleted - ID: ${taskId}`);
}

/**
 * Broadcast task status change
 */
function broadcastTaskStatusChanged(task, oldStatus, newStatus, updaterInfo) {
    broadcast({
        type: 'task:status_changed',
        taskId: task.id,
        title: task.title,
        oldStatus: oldStatus,
        newStatus: newStatus,
        task: task,
        updater: {
            id: updaterInfo.id,
            email: updaterInfo.email,
            fullName: updaterInfo.fullName
        },
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: Task status changed - "${task.title}" (${oldStatus} → ${newStatus})`);
}

/**
 * Broadcast task flagged
 */
function broadcastTaskFlagged(task, reason, flaggerInfo) {
    broadcast({
        type: 'task:flagged',
        task: task,
        reason: reason,
        flagger: {
            id: flaggerInfo.id,
            email: flaggerInfo.email,
            fullName: flaggerInfo.fullName
        },
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: Task flagged - "${task.title}"`);
}

/**
 * Broadcast activity created
 */
function broadcastActivity(activity) {
    broadcast({
        type: 'activity:new',
        activity: activity,
        timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted: New activity - ${activity.action}`);
}

/**
 * Send notification to specific user
 */
function sendNotificationToUser(userId, notification) {
    sendToUser(userId, {
        type: 'notification:new',
        notification: notification,
        timestamp: new Date().toISOString()
    });
    
    console.log(`📨 Sent notification to user ${userId}`);
}

/**
 * Broadcast user status change
 */
function broadcastUserStatusChanged(userId, email, isOnline) {
    broadcast({
        type: isOnline ? 'user:online' : 'user:offline',
        userId: userId,
        email: email,
        timestamp: new Date().toISOString()
    });
}

module.exports = {
    broadcastTaskCreated,
    broadcastTaskUpdated,
    broadcastTaskDeleted,
    broadcastTaskStatusChanged,
    broadcastTaskFlagged,
    broadcastActivity,
    sendNotificationToUser,
    broadcastUserStatusChanged
};