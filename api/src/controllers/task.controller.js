// api/src/controllers/task.controller.js
// COMPLETE FIXED VERSION - visibility removed from INSERT queries

const { runQuery, getOne, getAll } = require('../config/database');

// ══════════════════════════════════════════════════════════════════════════════
// CREATE TASK
// ══════════════════════════════════════════════════════════════════════════════
async function createTask(req, res) {
    try {
        const { title, description, status, priority, assigneeId, deadline, visibility } = req.body;
        const userId = req.user.id;
        const companyId = req.user.company_id;
        const orgId = req.user.org_id;

        // Validate required fields
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // ✅ FIX #1: Removed visibility from INSERT query
        // Changed from 9 columns to 8 columns
        const result = await runQuery(
            `INSERT INTO tasks (title, description, status, priority, assignee_id, created_by, deadline, company_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, status || 'pending', priority || 'medium', assigneeId, userId, deadline, companyId]
        );

        const newTask = await getOne(
            `SELECT t.*, 
                    u1.full_name as creator_name,
                    u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE t.id = ?`,
            [result.id]
        );

        res.status(201).json(newTask);
    } catch (error) {
        console.error('❌ POST /tasks error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE TASK (ALTERNATIVE VERSION - if you have another create function)
// ══════════════════════════════════════════════════════════════════════════════
async function createTaskAlt(req, res) {
    try {
        const { title, description, status, priority, assigneeId, deadline, visibility } = req.body;
        const createdBy = req.user.id;
        const companyId = req.user.company_id;
        const orgId = req.user.org_id;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // ✅ FIX #2: Removed visibility from INSERT query
        // Changed from 10 columns to 9 columns
        const result = await runQuery(
            `INSERT INTO tasks
                (title, description, status, priority, created_by, assignee_id,
                 company_id, org_id, deadline, flagged, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [title, description, status || 'pending', priority || 'medium', createdBy, assigneeId, companyId, orgId, deadline]
        );

        const newTask = await getOne('SELECT * FROM tasks WHERE id = ?', [result.id]);
        res.status(201).json(newTask);
    } catch (error) {
        console.error('❌ POST /tasks error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL TASKS
// ══════════════════════════════════════════════════════════════════════════════
async function getAllTasks(req, res) {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        const role = req.user.role;

        let query;
        let params;

        // Admins and owners see all company tasks
        if (role === 'admin' || role === 'owner') {
            query = `
                SELECT t.*, 
                       u1.full_name as creator_name,
                       u2.full_name as assignee_name
                FROM tasks t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assignee_id = u2.id
                WHERE t.company_id = ?
                ORDER BY t.created_at DESC
            `;
            params = [companyId];
        } else {
            // Members see only their tasks
            query = `
                SELECT t.*, 
                       u1.full_name as creator_name,
                       u2.full_name as assignee_name
                FROM tasks t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assignee_id = u2.id
                WHERE (t.created_by = ? OR t.assignee_id = ?)
                ORDER BY t.created_at DESC
            `;
            params = [userId, userId];
        }

        const tasks = await getAll(query, params);
        res.json(tasks);
    } catch (error) {
        console.error('❌ GET /tasks error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET TASK BY ID
// ══════════════════════════════════════════════════════════════════════════════
async function getTaskById(req, res) {
    try {
        const { id } = req.params;
        const task = await getOne(
            `SELECT t.*, 
                    u1.full_name as creator_name,
                    u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE t.id = ?`,
            [id]
        );

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(task);
    } catch (error) {
        console.error('❌ GET /tasks/:id error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE TASK
// ══════════════════════════════════════════════════════════════════════════════
async function updateTask(req, res) {
    try {
        const { id } = req.params;
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        // Check if task exists
        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update task
        await runQuery(
            `UPDATE tasks 
             SET title = ?, description = ?, status = ?, priority = ?, 
                 assignee_id = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, description, status, priority, assigneeId, deadline, id]
        );

        const updatedTask = await getOne(
            `SELECT t.*, 
                    u1.full_name as creator_name,
                    u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE t.id = ?`,
            [id]
        );

        res.json(updatedTask);
    } catch (error) {
        console.error('❌ PUT /tasks/:id error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE TASK
// ══════════════════════════════════════════════════════════════════════════════
async function deleteTask(req, res) {
    try {
        const { id } = req.params;

        // Check if task exists
        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await runQuery('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('❌ DELETE /tasks/:id error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// FLAG TASK
// ══════════════════════════════════════════════════════════════════════════════
async function flagTask(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await runQuery(
            'UPDATE tasks SET flagged = 1, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reason, id]
        );

        const updatedTask = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        res.json(updatedTask);
    } catch (error) {
        console.error('❌ PATCH /tasks/:id/flag error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// UNFLAG TASK
// ══════════════════════════════════════════════════════════════════════════════
async function unflagTask(req, res) {
    try {
        const { id } = req.params;

        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await runQuery(
            'UPDATE tasks SET flagged = 0, flag_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        const updatedTask = await getOne('SELECT * FROM tasks WHERE id = ?', [id]);
        res.json(updatedTask);
    } catch (error) {
        console.error('❌ PATCH /tasks/:id/unflag error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET MY TASKS
// ══════════════════════════════════════════════════════════════════════════════
async function getMyTasks(req, res) {
    try {
        const userId = req.user.id;

        const tasks = await getAll(
            `SELECT t.*, 
                    u1.full_name as creator_name,
                    u2.full_name as assignee_name
             FROM tasks t
             LEFT JOIN users u1 ON t.created_by = u1.id
             LEFT JOIN users u2 ON t.assignee_id = u2.id
             WHERE t.created_by = ? OR t.assignee_id = ?
             ORDER BY t.created_at DESC`,
            [userId, userId]
        );

        res.json(tasks);
    } catch (error) {
        console.error('❌ GET /tasks/my error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET TASK STATS
// ══════════════════════════════════════════════════════════════════════════════
async function getTaskStats(req, res) {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;

        const stats = await getOne(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN flagged = 1 THEN 1 ELSE 0 END) as flagged
             FROM tasks
             WHERE company_id = ?`,
            [companyId]
        );

        res.json(stats);
    } catch (error) {
        console.error('❌ GET /tasks/stats error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
    createTask,
    createTaskAlt,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    flagTask,
    unflagTask,
    getMyTasks,
    getTaskStats
};