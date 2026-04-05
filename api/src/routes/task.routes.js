// api/src/routes/task.routes.js
const express = require('express');
const router  = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { db, runQuery, getOne, getAll }   = require('../config/database');

// ─── Startup DDL ──────────────────────────────────────────────────────────────
db.run(`ALTER TABLE tasks ADD COLUMN visibility  TEXT DEFAULT 'personal'`, [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN company_id  INTEGER`,                 [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN flagged     INTEGER DEFAULT 0`,       [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN flag_reason TEXT`,                    [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN updated_at  TEXT`,                    [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN deadline    TEXT`,                    [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN assignee_id INTEGER`,                 [], () => {});
db.run(`ALTER TABLE tasks ADD COLUMN priority    TEXT DEFAULT 'medium'`,   [], () => {});

router.use(authenticateToken);

// Attach scope to every request
const scopeUser = (req, res, next) => {
    req.userContext = {
        companyId: req.user.company_id || null,
        userId:    req.user.id,
        role:      req.user.role,
    };
    next();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build the WHERE clause based on whether the user is personal or company
function buildTaskScope(userContext) {
    const { companyId, userId } = userContext;
    if (companyId) {
        // Company users see all tasks belonging to their company
        return { where: 'WHERE (t.company_id = ? OR t.org_id = ?)', params: [companyId, companyId] };
    }
    // Personal users see only their own tasks
    return { where: 'WHERE (t.created_by = ? OR t.assignee_id = ?)', params: [userId, userId] };
}

async function getTaskById(taskId, userContext) {
    const scope = buildTaskScope(userContext);
    return await getOne(
        `SELECT t.*,
                u1.full_name as creator_name,
                u2.full_name as assignee_name
         FROM tasks t
         LEFT JOIN users u1 ON t.created_by  = u1.id
         LEFT JOIN users u2 ON t.assignee_id = u2.id
         ${scope.where} AND t.id = ?`,
        [...scope.params, taskId]
    );
}

async function getAllTasksScoped(filters, userContext) {
    const scope = buildTaskScope(userContext);
    const conditions = [scope.where.replace('WHERE ', '')];
    const params     = [...scope.params];

    if (filters.status)   { conditions.push('t.status = ?');   params.push(filters.status); }
    if (filters.priority) { conditions.push('t.priority = ?'); params.push(filters.priority); }
    if (filters.assigneeId) { conditions.push('t.assignee_id = ?'); params.push(filters.assigneeId); }
    if (filters.flagged !== undefined) { conditions.push('t.flagged = ?'); params.push(filters.flagged ? 1 : 0); }

    return await getAll(
        `SELECT t.*,
                u1.full_name as creator_name,
                u2.full_name as assignee_name
         FROM tasks t
         LEFT JOIN users u1 ON t.created_by  = u1.id
         LEFT JOIN users u2 ON t.assignee_id = u2.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY
             CASE t.priority
                 WHEN 'urgent' THEN 1
                 WHEN 'high'   THEN 2
                 WHEN 'medium' THEN 3
                 WHEN 'low'    THEN 4
                 ELSE 5
             END,
             t.created_at DESC`,
        params
    );
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', scopeUser, async (req, res) => {
    try {
        const filters = {
            status:     req.query.status,
            priority:   req.query.priority,
            assigneeId: req.query.assigneeId,
            flagged:    req.query.flagged === 'true' ? true : req.query.flagged === 'false' ? false : undefined,
        };

        const tasks = await getAllTasksScoped(filters, req.userContext);
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to load tasks. Please try again.', details: error.message });
    }
});

// ─── GET /api/tasks/overdue ───────────────────────────────────────────────────
router.get('/overdue', scopeUser, async (req, res) => {
    try {
        const scope = buildTaskScope(req.userContext);
        const tasks = await getAll(
            `SELECT t.*, u1.full_name as creator_name, u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by  = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             ${scope.where}
               AND t.deadline < datetime('now')
               AND t.status != 'completed'
             ORDER BY t.deadline ASC`,
            scope.params
        );
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (error) {
        console.error('Get overdue tasks error:', error);
        res.status(500).json({ error: 'Failed to load overdue tasks. Please try again.', details: error.message });
    }
});

// ─── GET /api/tasks/stats ─────────────────────────────────────────────────────
router.get('/stats', scopeUser, async (req, res) => {
    try {
        const scope = buildTaskScope(req.userContext);
        const rows  = await getAll(
            `SELECT status, COUNT(*) as count FROM tasks t ${scope.where} GROUP BY status`,
            scope.params
        );
        const stats = { total:0, pending:0, in_progress:0, completed:0, blocked:0 };
        (rows || []).forEach(r => { stats[r.status] = r.count; stats.total += r.count; });
        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to load task statistics. Please try again.', details: error.message });
    }
});

// ─── GET /api/tasks/my ───────────────────────────────────────────────────────
router.get('/my', scopeUser, async (req, res) => {
    try {
        const tasks = await getAll(
            `SELECT t.*, u1.full_name as creator_name, u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by  = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE (t.created_by = ? OR t.assignee_id = ?)
             ORDER BY t.created_at DESC`,
            [req.user.id, req.user.id]
        );
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({ error: 'Failed to load your tasks. Please try again.', details: error.message });
    }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get('/:id', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or you do not have access to it.' });
        res.json({ task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Failed to load task. Please try again.', details: error.message });
    }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', scopeUser, async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        if (!title || !title.trim())
            return res.status(400).json({ error: 'Task title is required.' });

        const validStatuses   = ['pending', 'in_progress', 'completed', 'blocked'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (status   && !validStatuses.includes(status))
            return res.status(400).json({ error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}.` });
        if (priority && !validPriorities.includes(priority))
            return res.status(400).json({ error: `Invalid priority "${priority}". Must be one of: ${validPriorities.join(', ')}.` });

        // FIX: Build INSERT directly instead of going through Task model
        // which may have scope issues. This guarantees company_id is set correctly.
        const companyId  = req.user.company_id || null;
        const visibility = companyId ? 'company' : 'personal';

        const result = await runQuery(
           `INSERT INTO tasks
    (title, description, status, priority, created_by, assignee_id,
     company_id, org_id, deadline, flagged, created_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                title.trim(),
                description || null,
                status   || 'pending',
                priority || 'medium',
                req.user.id,
                assigneeId || null,
                companyId,
                companyId, // org_id mirrors company_id
                visibility,
                deadline || null,
            ]
        );

        const task = await getTaskById(result.id, req.userContext);
        res.status(201).json({ message: 'Task created successfully.', task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task. Please try again.', details: error.message });
    }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', scopeUser, async (req, res) => {
    try {
        const taskId = req.params.id;

        const existingTask = await getTaskById(taskId, req.userContext);
        if (!existingTask)
            return res.status(404).json({ error: 'Task not found or you do not have access to it.' });

        const { title, description, status, priority, assigneeId, deadline } = req.body;
        const validStatuses   = ['pending', 'in_progress', 'completed', 'blocked'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (status   && !validStatuses.includes(status))
            return res.status(400).json({ error: `Invalid status "${status}".` });
        if (priority && !validPriorities.includes(priority))
            return res.status(400).json({ error: `Invalid priority "${priority}".` });

        await runQuery(
            `UPDATE tasks SET
                title       = COALESCE(?, title),
                description = COALESCE(?, description),
                status      = COALESCE(?, status),
                priority    = COALESCE(?, priority),
                assignee_id = COALESCE(?, assignee_id),
                deadline    = COALESCE(?, deadline),
                updated_at  = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                title       || null,
                description !== undefined ? description : null,
                status      || null,
                priority    || null,
                assigneeId  !== undefined ? assigneeId : null,
                deadline    !== undefined ? deadline   : null,
                taskId,
            ]
        );

        const task = await getTaskById(taskId, req.userContext);
        res.json({ message: 'Task updated successfully.', task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task. Please try again.', details: error.message });
    }
});

// ─── PATCH /api/tasks/:id/flag ────────────────────────────────────────────────
router.patch('/:id/flag', scopeUser, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'A reason is required to flag a task.' });

        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or you do not have access to it.' });

        await runQuery(
            'UPDATE tasks SET flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reason, req.params.id]
        );
        const updated = await getTaskById(req.params.id, req.userContext);
        res.json({ message: 'Task flagged successfully.', task: updated });
    } catch (error) {
        console.error('Flag task error:', error);
        res.status(500).json({ error: 'Failed to flag task. Please try again.', details: error.message });
    }
});

// ─── PATCH /api/tasks/:id/unflag ─────────────────────────────────────────────
router.patch('/:id/unflag', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or you do not have access to it.' });

        await runQuery(
            'UPDATE tasks SET flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [req.params.id]
        );
        const updated = await getTaskById(req.params.id, req.userContext);
        res.json({ message: 'Task unflagged successfully.', task: updated });
    } catch (error) {
        console.error('Unflag task error:', error);
        res.status(500).json({ error: 'Failed to unflag task. Please try again.', details: error.message });
    }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or you do not have access to it.' });

        const isAdminOrManager = ['admin', 'manager', 'owner'].includes(req.user.role);
        const isCreator        = String(task.created_by) === String(req.user.id);

        if (!isAdminOrManager && !isCreator)
            return res.status(403).json({ error: 'You can only delete tasks that you created.' });

        await runQuery('UPDATE tasks SET created_by = NULL, assignee_id = NULL WHERE id = ?', [req.params.id]);
        await runQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);

        res.json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task. Please try again.', details: error.message });
    }
});

module.exports = router;