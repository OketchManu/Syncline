// api/src/routes/task.routes.js
const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, runQuery, getOne, getAll } = require('../config/database');

// ─── SELF-HEALING SCHEMA CHECK ───────────────────────────────────────────────
// This ensures that even if migrations failed on Render, the columns exist.
db.serialize(() => {
    const columns = [
        { name: 'visibility',  type: "TEXT DEFAULT 'personal'" },
        { name: 'company_id',  type: "INTEGER" },
        { name: 'org_id',      type: "INTEGER" },
        { name: 'assignee_id', type: "INTEGER" },
        { name: 'deadline',    type: "TEXT" },
        { name: 'flagged',     type: "INTEGER DEFAULT 0" },
        { name: 'flag_reason', type: "TEXT" },
        { name: 'updated_at',  type: "TEXT" }
    ];

    columns.forEach(col => {
        db.run(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Error adding column ${col.name}:`, err.message);
            }
        });
    });
});

router.use(authenticateToken);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const scopeUser = (req, res, next) => {
    req.userContext = {
        companyId: req.user.company_id || null,
        userId:    req.user.id,
        role:      req.user.role,
    };
    next();
};

async function getTaskById(taskId, userContext) {
    const { companyId, userId } = userContext;
    let query = `
        SELECT t.*, u1.full_name as creator_name, u2.full_name as assignee_name
        FROM tasks t
        LEFT JOIN users u1 ON t.created_by = u1.id
        LEFT JOIN users u2 ON t.assignee_id = u2.id
        WHERE t.id = ? AND (t.created_by = ? OR t.assignee_id = ?`;
    
    let params = [taskId, userId, userId];
    
    if (companyId) {
        query += ` OR t.company_id = ?)`;
        params.push(companyId);
    } else {
        query += `)`;
    }
    
    return await getOne(query, params);
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', scopeUser, async (req, res) => {
    try {
        const { companyId, userId } = req.userContext;
        let query = `
            SELECT t.*, u1.full_name as creator_name, u2.full_name as assignee_name
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by = u1.id
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE (t.created_by = ? OR t.assignee_id = ?`;
        
        let params = [userId, userId];

        if (companyId) {
            query += ` OR t.company_id = ?)`;
            params.push(companyId);
        } else {
            query += `)`;
        }

        query += ` ORDER BY t.created_at DESC`;
        const tasks = await getAll(query, params);
        res.json({ tasks: tasks || [] });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to load tasks.' });
    }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', scopeUser, async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const userId    = req.user.id;
        const companyId = req.user.company_id || null;
        const visibility = companyId ? 'company' : 'personal';

        // 13 Columns, 13 Values
        const sql = `
            INSERT INTO tasks (
                title, description, status, priority, 
                created_by, assignee_id, company_id, org_id, 
                visibility, deadline, flagged, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await runQuery(sql, [
            title,
            description || '',
            status || 'pending',
            priority || 'medium',
            userId,
            assigneeId || null,
            companyId,
            companyId, // org_id defaults to company_id
            visibility,
            deadline || null
        ]);

        const task = await getTaskById(result.id, req.userContext);
        res.status(201).json({ message: 'Task created', task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', scopeUser, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        await runQuery(
            `UPDATE tasks SET 
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                assignee_id = COALESCE(?, assignee_id),
                deadline = COALESCE(?, deadline),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, description, status, priority, assigneeId, deadline, taskId]
        );

        const task = await getTaskById(taskId, req.userContext);
        res.json({ message: 'Task updated', task });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', scopeUser, async (req, res) => {
    try {
        await runQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;