// api/src/routes/task.routes.js
const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { runQuery, getOne, getAll } = require('../config/database');

// ─── NOTE: No startup ALTER TABLE here ───────────────────────────────────────
// All DDL runs in server.js → ensureTaskSchema() + runMigrations() BEFORE
// any route file is loaded. Putting ALTER TABLE in route files causes a race
// where the route fires before the ALTER TABLE callback completes.

router.use(authenticateToken);

// ── Scope helper ──────────────────────────────────────────────────────────────
const scopeUser = (req, _res, next) => {
    req.userContext = {
        companyId: req.user.company_id || null,
        userId:    req.user.id,
        role:      req.user.role,
    };
    next();
};

function buildScope(ctx) {
    if (ctx.companyId) {
        return {
            where:  'WHERE (t.company_id = ? OR t.org_id = ?)',
            params: [ctx.companyId, ctx.companyId],
        };
    }
    return {
        where:  'WHERE (t.created_by = ? OR t.assignee_id = ?)',
        params: [ctx.userId, ctx.userId],
    };
}

async function findTask(taskId, ctx) {
    const s = buildScope(ctx);
    return getOne(
        `SELECT t.*,
                u1.full_name AS creator_name,
                u2.full_name AS assignee_name
         FROM tasks t
         LEFT JOIN users u1 ON t.created_by  = u1.id
         LEFT JOIN users u2 ON t.assignee_id = u2.id
         ${s.where} AND t.id = ?`,
        [...s.params, taskId]
    );
}

// ── GET /api/tasks ────────────────────────────────────────────────────────────
router.get('/', scopeUser, async (req, res) => {
    try {
        const s = buildScope(req.userContext);
        const extra = [];
        const ep    = [];

        if (req.query.status)     { extra.push('t.status = ?');      ep.push(req.query.status); }
        if (req.query.priority)   { extra.push('t.priority = ?');    ep.push(req.query.priority); }
        if (req.query.assigneeId) { extra.push('t.assignee_id = ?'); ep.push(req.query.assigneeId); }
        if (req.query.flagged !== undefined) {
            extra.push('t.flagged = ?');
            ep.push(req.query.flagged === 'true' ? 1 : 0);
        }

        const where  = extra.length ? `${s.where} AND ${extra.join(' AND ')}` : s.where;
        const params = [...s.params, ...ep];

        const tasks = await getAll(
            `SELECT t.*,
                    u1.full_name AS creator_name,
                    u2.full_name AS assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by  = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             ${where}
             ORDER BY
                 CASE t.priority
                     WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
                     WHEN 'medium' THEN 3 WHEN 'low'  THEN 4 ELSE 5
                 END, t.created_at DESC`,
            params
        );
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (err) {
        console.error('❌ GET /tasks error:', err);
        res.status(500).json({ error: 'Failed to load tasks. Please try again.' });
    }
});

// ── GET /api/tasks/stats ──────────────────────────────────────────────────────
router.get('/stats', scopeUser, async (req, res) => {
    try {
        const s    = buildScope(req.userContext);
        const rows = await getAll(
            `SELECT status, COUNT(*) as count FROM tasks t ${s.where} GROUP BY status`,
            s.params
        );
        const stats = { total:0, pending:0, in_progress:0, completed:0, blocked:0 };
        (rows || []).forEach(r => { stats[r.status] = r.count; stats.total += r.count; });
        res.json({ stats });
    } catch (err) {
        console.error('❌ GET /tasks/stats error:', err);
        res.status(500).json({ error: 'Failed to load statistics.' });
    }
});

// ── GET /api/tasks/overdue ────────────────────────────────────────────────────
router.get('/overdue', scopeUser, async (req, res) => {
    try {
        const s = buildScope(req.userContext);
        const tasks = await getAll(
            `SELECT t.*, u1.full_name AS creator_name, u2.full_name AS assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by  = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             ${s.where} AND t.deadline < datetime('now') AND t.status != 'completed'
             ORDER BY t.deadline ASC`,
            s.params
        );
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (err) {
        console.error('❌ GET /tasks/overdue error:', err);
        res.status(500).json({ error: 'Failed to load overdue tasks.' });
    }
});

// ── GET /api/tasks/my ─────────────────────────────────────────────────────────
router.get('/my', scopeUser, async (req, res) => {
    try {
        const tasks = await getAll(
            `SELECT t.*, u1.full_name AS creator_name, u2.full_name AS assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by  = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE (t.created_by = ? OR t.assignee_id = ?)
             ORDER BY t.created_at DESC`,
            [req.user.id, req.user.id]
        );
        res.json({ tasks: tasks || [], count: (tasks || []).length });
    } catch (err) {
        console.error('❌ GET /tasks/my error:', err);
        res.status(500).json({ error: 'Failed to load your tasks.' });
    }
});

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
router.get('/:id', scopeUser, async (req, res) => {
    try {
        const task = await findTask(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or you do not have access.' });
        res.json({ task });
    } catch (err) {
        console.error('❌ GET /tasks/:id error:', err);
        res.status(500).json({ error: 'Failed to load task.' });
    }
});

// ── POST /api/tasks ───────────────────────────────────────────────────────────
// FIX: visibility column is intentionally OMITTED from the INSERT.
// It has a DEFAULT 'personal' in the schema so SQLite fills it automatically.
// Previously including it caused SQLITE_ERROR when the column didn't yet exist
// in older databases (column added via ALTER TABLE which is async/fire-and-forget).
router.post('/', scopeUser, async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        if (!title || !title.trim())
            return res.status(400).json({ error: 'Task title is required.' });

        const VALID_STATUS   = ['pending','in_progress','completed','blocked'];
        const VALID_PRIORITY = ['low','medium','high','urgent'];

        if (status   && !VALID_STATUS.includes(status))
            return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUS.join(', ')}.` });
        if (priority && !VALID_PRIORITY.includes(priority))
            return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITY.join(', ')}.` });

        const companyId = req.user.company_id || null;

        // ── visibility intentionally excluded — uses column DEFAULT 'personal' ──
        const result = await runQuery(
            `INSERT INTO tasks
                (title, description, status, priority,
                 created_by, assignee_id, company_id, org_id,
                 deadline, flagged, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                title.trim(),
                description || null,
                status      || 'pending',
                priority    || 'medium',
                req.user.id,
                assigneeId  || null,
                companyId,
                companyId,  // org_id mirrors company_id
                deadline    || null,
            ]
        );

        const task = await findTask(result.id, req.userContext);
        console.log(`✅ Task created: id=${result.id} title="${title.trim()}" by user=${req.user.id}`);
        res.status(201).json({ message: 'Task created successfully.', task });
    } catch (err) {
        console.error('❌ POST /tasks error:', err);
        res.status(500).json({ error: 'Failed to create task. Please try again.', details: err.message });
    }
});

// ── PUT /api/tasks/:id ────────────────────────────────────────────────────────
router.put('/:id', scopeUser, async (req, res) => {
    try {
        const existing = await findTask(req.params.id, req.userContext);
        if (!existing) return res.status(404).json({ error: 'Task not found or you do not have access.' });

        const { title, description, status, priority, assigneeId, deadline } = req.body;
        const VALID_STATUS   = ['pending','in_progress','completed','blocked'];
        const VALID_PRIORITY = ['low','medium','high','urgent'];

        if (status   && !VALID_STATUS.includes(status))
            return res.status(400).json({ error: `Invalid status "${status}".` });
        if (priority && !VALID_PRIORITY.includes(priority))
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
                description !== undefined ? (description || null) : null,
                status      || null,
                priority    || null,
                assigneeId  !== undefined ? (assigneeId  || null) : null,
                deadline    !== undefined ? (deadline    || null) : null,
                req.params.id,
            ]
        );

        const task = await findTask(req.params.id, req.userContext);
        res.json({ message: 'Task updated successfully.', task });
    } catch (err) {
        console.error('❌ PUT /tasks/:id error:', err);
        res.status(500).json({ error: 'Failed to update task. Please try again.' });
    }
});

// ── PATCH /api/tasks/:id/flag ─────────────────────────────────────────────────
router.patch('/:id/flag', scopeUser, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'A reason is required to flag a task.' });

        const task = await findTask(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        await runQuery(
            'UPDATE tasks SET flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reason, req.params.id]
        );
        res.json({ message: 'Task flagged.', task: await findTask(req.params.id, req.userContext) });
    } catch (err) {
        console.error('❌ PATCH /tasks/:id/flag error:', err);
        res.status(500).json({ error: 'Failed to flag task.' });
    }
});

// ── PATCH /api/tasks/:id/unflag ───────────────────────────────────────────────
router.patch('/:id/unflag', scopeUser, async (req, res) => {
    try {
        const task = await findTask(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        await runQuery(
            'UPDATE tasks SET flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'Task unflagged.', task: await findTask(req.params.id, req.userContext) });
    } catch (err) {
        console.error('❌ PATCH /tasks/:id/unflag error:', err);
        res.status(500).json({ error: 'Failed to unflag task.' });
    }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
router.delete('/:id', scopeUser, async (req, res) => {
    try {
        const task = await findTask(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const isAdmin   = ['admin','manager','owner'].includes(req.user.role);
        const isCreator = String(task.created_by) === String(req.user.id);
        if (!isAdmin && !isCreator)
            return res.status(403).json({ error: 'You can only delete tasks you created.' });

        await runQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task deleted successfully.' });
    } catch (err) {
        console.error('❌ DELETE /tasks/:id error:', err);
        res.status(500).json({ error: 'Failed to delete task. Please try again.' });
    }
});

module.exports = router;