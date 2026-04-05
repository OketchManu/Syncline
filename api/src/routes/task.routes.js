// api/src/routes/task.routes.js
const express = require('express');
const router  = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { db, runQuery, getOne, getAll }   = require('../config/database');

// ─── Startup DDL (Ensures columns exist if migrations skipped them) ──────────
db.serialize(() => {
    db.run(`ALTER TABLE tasks ADD COLUMN visibility  TEXT DEFAULT 'personal'`, [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN company_id  INTEGER`,                 [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN org_id      INTEGER`,                 [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN flagged     INTEGER DEFAULT 0`,       [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN flag_reason TEXT`,                    [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN updated_at  TEXT`,                    [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN deadline    TEXT`,                    [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN assignee_id INTEGER`,                 [], () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN priority    TEXT DEFAULT 'medium'`,   [], () => {});
});

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

function buildTaskScope(userContext) {
    const { companyId, userId } = userContext;
    if (companyId) {
        return { where: 'WHERE (t.company_id = ? OR t.org_id = ?)', params: [companyId, companyId] };
    }
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
        res.status(500).json({ error: 'Failed to load tasks.', details: error.message });
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
            return res.status(400).json({ error: `Invalid status "${status}".` });
        if (priority && !validPriorities.includes(priority))
            return res.status(400).json({ error: `Invalid priority "${priority}".` });

        const companyId  = req.user.company_id || null;
        const visibility = companyId ? 'company' : 'personal';

        // EXACT MAPPING: 13 Columns, 13 Values
        const result = await runQuery(
            `INSERT INTO tasks 
            (title, description, status, priority, created_by, assignee_id, 
             company_id, org_id, visibility, deadline, flagged, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                title.trim(),
                description || null,
                status   || 'pending',
                priority || 'medium',
                req.user.id,
                assigneeId || null,
                companyId,
                companyId,   // org_id mirrors company_id
                visibility,
                deadline || null
            ]
        );

        const task = await getTaskById(result.id, req.userContext);
        res.status(201).json({ message: 'Task created successfully.', task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task.', details: error.message });
    }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', scopeUser, async (req, res) => {
    try {
        const taskId = req.params.id;
        const existingTask = await getTaskById(taskId, req.userContext);
        if (!existingTask)
            return res.status(404).json({ error: 'Task not found or access denied.' });

        const { title, description, status, priority, assigneeId, deadline } = req.body;

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
            [title || null, description || null, status || null, priority || null, assigneeId || null, deadline || null, taskId]
        );

        const task = await getTaskById(taskId, req.userContext);
        res.json({ message: 'Task updated successfully.', task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const isAdmin = ['admin', 'manager', 'owner'].includes(req.user.role);
        const isCreator = String(task.created_by) === String(req.user.id);

        if (!isAdmin && !isCreator)
            return res.status(403).json({ error: 'Permission denied.' });

        await runQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

module.exports = router;