// api/src/routes/task.routes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    createTask,
    getAllTasks,
    getTaskById,
    updateTask,
    deleteTask,
    getTasksByUser,
    getOverdueTasks,
    flagTask,
    unflagTask,
    getTaskStats,
    getTaskAuditLog
} = require('../models/Task');

router.use(authenticateToken);

// Builds userContext from token for every route — works for both personal and company accounts
const scopeUser = (req, res, next) => {
    req.userContext = {
        companyId: req.user.company_id || null,
        userId:    req.user.id,
        role:      req.user.role
    };
    next();
};

/**
 * GET /api/tasks
 */
router.get('/', scopeUser, async (req, res) => {
    try {
        const filters = {
            status:     req.query.status,
            priority:   req.query.priority,
            assigneeId: req.query.assigneeId,
            createdBy:  req.query.createdBy,
            flagged:    req.query.flagged === 'true' ? true : req.query.flagged === 'false' ? false : undefined
        };

        const tasks = await getAllTasks(filters, req.userContext);
        res.json({ tasks, count: tasks.length });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks', details: error.message });
    }
});

/**
 * GET /api/tasks/stats
 */
router.get('/stats', scopeUser, async (req, res) => {
    try {
        const targetUserId = req.query.userId || null;
        const stats = await getTaskStats(req.userContext, targetUserId);
        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics', details: error.message });
    }
});

/**
 * GET /api/tasks/overdue
 */
router.get('/overdue', scopeUser, async (req, res) => {
    try {
        const tasks = await getOverdueTasks(req.userContext);
        res.json({ tasks, count: tasks.length });
    } catch (error) {
        console.error('Get overdue tasks error:', error);
        res.status(500).json({ error: 'Failed to get overdue tasks', details: error.message });
    }
});

/**
 * GET /api/tasks/my
 */
router.get('/my', scopeUser, async (req, res) => {
    try {
        const tasks = await getTasksByUser(req.user.id, req.user.company_id || null);
        res.json({ tasks, count: tasks.length });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({ error: 'Failed to get your tasks', details: error.message });
    }
});

/**
 * GET /api/tasks/:id/audit  — admin only
 */
router.get('/:id/audit', scopeUser, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const auditLog = await getTaskAuditLog(req.params.id, req.userContext);
        res.json({ auditLog, count: auditLog.length });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Failed to get audit log', details: error.message });
    }
});

/**
 * GET /api/tasks/:id
 */
router.get('/:id', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
        res.json({ task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Failed to get task', details: error.message });
    }
});

/**
 * POST /api/tasks
 */
router.post('/', scopeUser, async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        if (!title) return res.status(400).json({ error: 'Task title is required' });

        const validStatuses   = ['pending', 'in_progress', 'completed', 'blocked'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (status   && !validStatuses.includes(status))     return res.status(400).json({ error: 'Invalid status', validStatuses });
        if (priority && !validPriorities.includes(priority)) return res.status(400).json({ error: 'Invalid priority', validPriorities });

        const taskId = await createTask({
            title,
            description,
            status,
            priority,
            assigneeId,
            createdBy:  req.user.id,
            deadline,
            companyId:  req.user.company_id || null,
            visibility: req.user.company_id ? 'company' : 'personal'
        });

        const task = await getTaskById(taskId, req.userContext);
        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task', details: error.message });
    }
});

/**
 * PUT /api/tasks/:id
 */
router.put('/:id', scopeUser, async (req, res) => {
    try {
        const taskId = req.params.id;
        const updates = req.body;

        const existingTask = await getTaskById(taskId, req.userContext);
        if (!existingTask) return res.status(404).json({ error: 'Task not found or access denied' });

        const validStatuses   = ['pending', 'in_progress', 'completed', 'blocked'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (updates.status   && !validStatuses.includes(updates.status))     return res.status(400).json({ error: 'Invalid status', validStatuses });
        if (updates.priority && !validPriorities.includes(updates.priority)) return res.status(400).json({ error: 'Invalid priority', validPriorities });

        const success = await updateTask(taskId, updates, req.user.id, req.userContext);
        if (!success) return res.status(500).json({ error: 'Failed to update task' });

        const task = await getTaskById(taskId, req.userContext);
        res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task', details: error.message });
    }
});

/**
 * PATCH /api/tasks/:id/flag
 */
router.patch('/:id/flag', scopeUser, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'Flag reason is required' });

        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

        await flagTask(req.params.id, reason);
        const updated = await getTaskById(req.params.id, req.userContext);
        res.json({ message: 'Task flagged successfully', task: updated });
    } catch (error) {
        console.error('Flag task error:', error);
        res.status(500).json({ error: 'Failed to flag task', details: error.message });
    }
});

/**
 * PATCH /api/tasks/:id/unflag
 */
router.patch('/:id/unflag', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

        await unflagTask(req.params.id);
        const updated = await getTaskById(req.params.id, req.userContext);
        res.json({ message: 'Task unflagged successfully', task: updated });
    } catch (error) {
        console.error('Unflag task error:', error);
        res.status(500).json({ error: 'Failed to unflag task', details: error.message });
    }
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', scopeUser, async (req, res) => {
    try {
        const task = await getTaskById(req.params.id, req.userContext);
        if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

        const isAdminOrManager = ['admin', 'manager', 'owner'].includes(req.user.role);
        const isCreator        = String(task.created_by) === String(req.user.id);

        if (!isAdminOrManager && !isCreator) {
            return res.status(403).json({ error: 'You can only delete tasks you created' });
        }

        const success = await deleteTask(req.params.id, req.user.id, req.userContext);
        if (!success) return res.status(500).json({ error: 'Failed to delete task' });

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task', details: error.message });
    }
});

module.exports = router;