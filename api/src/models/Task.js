// api/src/models/Task.js
const { runQuery, getOne, getAll } = require('../config/database');

/**
 * Create a new task with account isolation
 */
async function createTask(data) {
    const {
        title,
        description,
        status = 'pending',
        priority = 'medium',
        assigneeId = null,
        createdBy,
        deadline = null,
        companyId = null,
        visibility = companyId ? 'company' : 'personal'
    } = data;

    const result = await runQuery(
        `INSERT INTO tasks
            (title, description, status, priority, created_by, assignee_id,
             company_id, org_id, visibility, deadline, flagged, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            title.trim(),
            description || null,
            status,
            priority,
            createdBy,
            assigneeId,
            companyId,
            companyId,
            visibility,
            deadline
        ]
    );

    await logAuditEntry({
        taskId: result.id,
        userId: createdBy,
        action: 'created',
        newValue: JSON.stringify({ title, status, priority })
    });

    return result.id;
}

/**
 * Get all tasks scoped by user context with optional filters
 */
async function getAllTasks(filters = {}, userContext) {
    const { companyId, userId, role } = userContext;

    let sql = `
        SELECT
            t.*,
            u1.email AS assignee_email,
            u1.full_name AS assignee_name,
            u2.email AS creator_email,
            u2.full_name AS creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE 1=1
    `;
    const params = [];

    if (companyId) {
        sql += ' AND t.company_id = ?';
        params.push(companyId);
        if (role === 'member') {
            sql += ' AND (t.assignee_id = ? OR t.created_by = ?)';
            params.push(userId, userId);
        }
    } else {
        sql += ' AND t.created_by = ? AND (t.company_id IS NULL OR t.company_id = 0)';
        params.push(userId);
    }

    if (filters.status) sql += ' AND t.status = ?' && params.push(filters.status);
    if (filters.priority) sql += ' AND t.priority = ?' && params.push(filters.priority);
    if (filters.assigneeId) sql += ' AND t.assignee_id = ?' && params.push(filters.assigneeId);
    if (filters.flagged !== undefined) sql += ' AND t.flagged = ?' && params.push(filters.flagged ? 1 : 0);
    if (filters.createdBy) sql += ' AND t.created_by = ?' && params.push(filters.createdBy);

    sql += ' ORDER BY t.created_at DESC';
    return await getAll(sql, params);
}

/**
 * Get task by ID with access control
 */
async function getTaskById(id, userContext) {
    const task = await getOne(
        `SELECT
            t.*,
            u1.email AS assignee_email,
            u1.full_name AS assignee_name,
            u2.email AS creator_email,
            u2.full_name AS creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?`,
        [id]
    );

    if (!task) return null;
    if (!userContext) return task;

    const { companyId, userId, role } = userContext;

    if (companyId) {
        if (task.company_id !== companyId) return null;
        if (role === 'member' && task.assignee_id !== userId && task.created_by !== userId) return null;
    } else {
        if (task.created_by !== userId || task.company_id) return null;
    }

    return task;
}

/**
 * Update a task with audit logging
 */
async function updateTask(id, updates, userId, userContext) {
    const oldTask = await getTaskById(id, userContext);
    if (!oldTask) return false;

    const allowedFields = ['title','description','status','priority','assignee_id','deadline','flagged','flag_reason','visibility'];
    const fields = [];
    const values = [];
    const changes = [];

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
            if (oldTask[key] !== value) changes.push({ field: key, oldValue: oldTask[key], newValue: value });
        }
    }

    if (fields.length === 0) throw new Error('No valid fields to update');

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('version = version + 1');

    let sql;
    if (userContext.companyId) {
        values.push(id, userContext.companyId);
        sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`;
    } else {
        values.push(id, userContext.userId);
        sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND created_by = ? AND (company_id IS NULL OR company_id = 0)`;
    }

    const result = await runQuery(sql, values);

    for (const change of changes) {
        await logAuditEntry({
            taskId: id,
            userId,
            action: 'updated',
            fieldChanged: change.field,
            oldValue: String(change.oldValue),
            newValue: String(change.newValue)
        });
    }

    return result.changes > 0;
}

/**
 * Delete task with audit logging
 */
async function deleteTask(id, userId, userContext) {
    const task = await getTaskById(id, userContext);
    if (!task) return false;

    await logAuditEntry({
        taskId: id,
        userId,
        action: 'deleted',
        oldValue: JSON.stringify({ title: task.title, status: task.status })
    });

    const sql = userContext.companyId
        ? 'DELETE FROM tasks WHERE id = ? AND company_id = ?'
        : 'DELETE FROM tasks WHERE id = ? AND created_by = ? AND (company_id IS NULL OR company_id = 0)';

    const params = userContext.companyId ? [id, userContext.companyId] : [id, userId];
    const result = await runQuery(sql, params);
    return result.changes > 0;
}

/**
 * Get tasks assigned to a specific user
 */
async function getTasksByUser(userId, companyId = null) {
    let sql = `
        SELECT
            t.*,
            u.email AS creator_email,
            u.full_name AS creator_name
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.assignee_id = ?
    `;
    const params = [userId];

    if (companyId) {
        sql += ' AND t.company_id = ?';
        params.push(companyId);
    } else {
        sql += ' AND (t.company_id IS NULL OR t.company_id = 0)';
    }

    sql += ' ORDER BY t.created_at DESC';
    return await getAll(sql, params);
}

/**
 * Get overdue tasks
 */
async function getOverdueTasks(userContext) {
    const { companyId, userId, role } = userContext;

    let sql = `
        SELECT
            t.*,
            u1.email AS assignee_email,
            u1.full_name AS assignee_name,
            u2.email AS creator_email,
            u2.full_name AS creator_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assignee_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.deadline < datetime('now') AND t.status != 'completed'
    `;
    const params = [];

    if (companyId) {
        sql += ' AND t.company_id = ?';
        params.push(companyId);
        if (role === 'member') {
            sql += ' AND (t.assignee_id = ? OR t.created_by = ?)';
            params.push(userId, userId);
        }
    } else {
        sql += ' AND t.created_by = ? AND (t.company_id IS NULL OR t.company_id = 0)';
        params.push(userId);
    }

    sql += ' ORDER BY t.deadline ASC';
    return await getAll(sql, params);
}

/**
 * Get task statistics
 */
async function getTaskStats(userContext, targetUserId = null) {
    const { companyId, userId, role } = userContext;

    let sql = `
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN flagged = 1 THEN 1 ELSE 0 END) AS flagged,
            SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) AS overdue
        FROM tasks
        WHERE 1=1
    `;

    const params = [];

    if (companyId) {
        sql += ' AND company_id = ?';
        params.push(companyId);
        if (targetUserId) {
            sql += ' AND assignee_id = ?';
            params.push(targetUserId);
        } else if (role === 'member') {
            sql += ' AND (assignee_id = ? OR created_by = ?)';
            params.push(userId, userId);
        }
    } else {
        sql += ' AND created_by = ? AND (company_id IS NULL OR company_id = 0)';
        params.push(userId);
    }

    return await getOne(sql, params);
}

/**
 * Get task audit log (admin/owner only)
 */
async function getTaskAuditLog(taskId, userContext) {
    const { role } = userContext;
    if (!['owner','admin'].includes(role)) return [];

    return await getAll(
        `SELECT
            al.*,
            u.full_name AS user_name,
            u.email AS user_email
        FROM task_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.task_id = ?
        ORDER BY al.timestamp DESC`,
        [taskId]
    );
}

/**
 * Flag / unflag task
 */
async function flagTask(id, reason) {
    const result = await runQuery(
        'UPDATE tasks SET flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [reason, id]
    );
    return result.changes > 0;
}

async function unflagTask(id) {
    const result = await runQuery(
        'UPDATE tasks SET flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
    );
    return result.changes > 0;
}

/**
 * Log audit entry
 */
async function logAuditEntry(data) {
    const { taskId, userId, action, fieldChanged, oldValue, newValue, ipAddress, userAgent } = data;
    try {
        await runQuery(
            `INSERT INTO task_audit_log
                (task_id, user_id, action, field_changed, old_value, new_value, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [taskId, userId, action, fieldChanged || null, oldValue || null, newValue || null, ipAddress || null, userAgent || null]
        );
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

module.exports = {
    createTask,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    getTasksByUser,
    getOverdueTasks,
    getTaskStats,
    getTaskAuditLog,
    flagTask,
    unflagTask,
    logAuditEntry
};