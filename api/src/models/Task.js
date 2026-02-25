// api/src/models/Task.js
// Task database operations

const { runQuery, getOne, getAll } = require('../config/database');

/**
 * Create a new task
 */
async function createTask(data) {
    const { title, description, status = 'pending', priority = 'medium', assigneeId, createdBy, deadline } = data;

    const result = await runQuery(
        `INSERT INTO tasks (title, description, status, priority, assignee_id, created_by, deadline) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, status, priority, assigneeId, createdBy, deadline]
    );

    return result.id;
}

/**
 * Get all tasks with user details
 */
async function getAllTasks(filters = {}) {
    let sql = `
        SELECT 
            t.*,
            u1.email as assignee_email,
            u1.full_name as assignee_name,
            u2.email as creator_email,
            u2.full_name as creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE 1=1
    `;
    
    const params = [];

    // Apply filters
    if (filters.status) {
        sql += ' AND t.status = ?';
        params.push(filters.status);
    }

    if (filters.priority) {
        sql += ' AND t.priority = ?';
        params.push(filters.priority);
    }

    if (filters.assigneeId) {
        sql += ' AND t.assignee_id = ?';
        params.push(filters.assigneeId);
    }

    if (filters.flagged !== undefined) {
        sql += ' AND t.flagged = ?';
        params.push(filters.flagged ? 1 : 0);
    }

    if (filters.createdBy) {
        sql += ' AND t.created_by = ?';
        params.push(filters.createdBy);
    }

    sql += ' ORDER BY t.created_at DESC';

    return await getAll(sql, params);
}

/**
 * Get task by ID
 */
async function getTaskById(id) {
    return await getOne(
        `SELECT 
            t.*,
            u1.email as assignee_email,
            u1.full_name as assignee_name,
            u2.email as creator_email,
            u2.full_name as creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?`,
        [id]
    );
}

/**
 * Update task
 */
async function updateTask(id, updates, userId) {
    const allowedFields = ['title', 'description', 'status', 'priority', 'assignee_id', 'deadline', 'flagged', 'flag_reason'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('version = version + 1');

    values.push(id);

    const result = await runQuery(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
        values
    );

    return result.changes > 0;
}

/**
 * Delete task
 */
async function deleteTask(id) {
    const result = await runQuery('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
}

/**
 * Get tasks by user
 */
async function getTasksByUser(userId) {
    return await getAll(
        `SELECT 
            t.*,
            u.email as creator_email,
            u.full_name as creator_name
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.assignee_id = ?
        ORDER BY t.created_at DESC`,
        [userId]
    );
}

/**
 * Get overdue tasks
 */
async function getOverdueTasks() {
    return await getAll(
        `SELECT 
            t.*,
            u1.email as assignee_email,
            u1.full_name as assignee_name,
            u2.email as creator_email,
            u2.full_name as creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.deadline < datetime('now') 
        AND t.status != 'completed'
        ORDER BY t.deadline ASC`
    );
}

/**
 * Flag task
 */
async function flagTask(id, reason) {
    const result = await runQuery(
        'UPDATE tasks SET flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [reason, id]
    );
    return result.changes > 0;
}

/**
 * Unflag task
 */
async function unflagTask(id) {
    const result = await runQuery(
        'UPDATE tasks SET flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
    );
    return result.changes > 0;
}

/**
 * Get task statistics
 */
async function getTaskStats(userId = null) {
    let sql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
            SUM(CASE WHEN flagged = 1 THEN 1 ELSE 0 END) as flagged,
            SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
        FROM tasks
    `;

    if (userId) {
        sql += ' WHERE assignee_id = ?';
        return await getOne(sql, [userId]);
    }

    return await getOne(sql);
}

module.exports = {
    createTask,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    getTasksByUser,
    getOverdueTasks,
    flagTask,
    unflagTask,
    getTaskStats
};