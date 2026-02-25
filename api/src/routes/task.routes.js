// Task management endpoints

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
    getTaskStats
} = require('../models/Task');

// Apply authentication to all task routes
router.use(authenticateToken);

/**
 * GET /api/tasks
 * Get all tasks with optional filters
 */
router.get('/', async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            priority: req.query.priority,
            assigneeId: req.query.assigneeId,
            createdBy: req.query.createdBy,
            flagged: req.query.flagged === 'true' ? true : req.query.flagged === 'false' ? false : undefined
        };

        const tasks = await getAllTasks(filters);

        res.json({
            tasks,
            count: tasks.length
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            error: 'Failed to get tasks',
            details: error.message
        });
    }
});

/**
 * GET /api/tasks/stats
 * Get task statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.query.userId || null;
        const stats = await getTaskStats(userId);

        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            error: 'Failed to get statistics',
            details: error.message
        });
    }
});

/**
 * GET /api/tasks/overdue
 * Get all overdue tasks
 */
router.get('/overdue', async (req, res) => {
    try {
        const tasks = await getOverdueTasks();

        res.json({
            tasks,
            count: tasks.length
        });
    } catch (error) {
        console.error('Get overdue tasks error:', error);
        res.status(500).json({
            error: 'Failed to get overdue tasks',
            details: error.message
        });
    }
});

/**
 * GET /api/tasks/my
 * Get tasks assigned to current user
 */
router.get('/my', async (req, res) => {
    try {
        const tasks = await getTasksByUser(req.user.id);

        res.json({
            tasks,
            count: tasks.length
        });
    } catch (error) {
        console.error('Get my tasks error:', error);
        res.status(500).json({
            error: 'Failed to get your tasks',
            details: error.message
        });
    }
});

/**
 * GET /api/tasks/:id
 * Get single task by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const task = await getTaskById(req.params.id);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        res.json({ task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            error: 'Failed to get task',
            details: error.message
        });
    }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req, res) => {
    try {
        const { title, description, status, priority, assigneeId, deadline } = req.body;

        // Validation
        if (!title) {
            return res.status(400).json({
                error: 'Task title is required'
            });
        }

        // Validate status
        const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                validStatuses
            });
        }

        // Validate priority
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                error: 'Invalid priority',
                validPriorities
            });
        }

        const taskId = await createTask({
            title,
            description,
            status,
            priority,
            assigneeId,
            createdBy: req.user.id,
            deadline
        });

        const task = await getTaskById(taskId);

        res.status(201).json({
            message: 'Task created successfully',
            task
        });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            error: 'Failed to create task',
            details: error.message
        });
    }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const updates = req.body;

        // Check if task exists
        const existingTask = await getTaskById(taskId);
        if (!existingTask) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        // Validate status if provided
        if (updates.status) {
            const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
            if (!validStatuses.includes(updates.status)) {
                return res.status(400).json({
                    error: 'Invalid status',
                    validStatuses
                });
            }
        }

        // Validate priority if provided
        if (updates.priority) {
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (!validPriorities.includes(updates.priority)) {
                return res.status(400).json({
                    error: 'Invalid priority',
                    validPriorities
                });
            }
        }

        const success = await updateTask(taskId, updates, req.user.id);

        if (!success) {
            return res.status(500).json({
                error: 'Failed to update task'
            });
        }

        const task = await getTaskById(taskId);

        res.json({
            message: 'Task updated successfully',
            task
        });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            error: 'Failed to update task',
            details: error.message
        });
    }
});

/**
 * PATCH /api/tasks/:id/flag
 * Flag a task as stuck/delayed
 */
router.patch('/:id/flag', async (req, res) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                error: 'Flag reason is required'
            });
        }

        const success = await flagTask(req.params.id, reason);

        if (!success) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        const task = await getTaskById(req.params.id);

        res.json({
            message: 'Task flagged successfully',
            task
        });
    } catch (error) {
        console.error('Flag task error:', error);
        res.status(500).json({
            error: 'Failed to flag task',
            details: error.message
        });
    }
});

/**
 * PATCH /api/tasks/:id/unflag
 * Remove flag from a task
 */
router.patch('/:id/unflag', async (req, res) => {
    try {
        const success = await unflagTask(req.params.id);

        if (!success) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        const task = await getTaskById(req.params.id);

        res.json({
            message: 'Task unflagged successfully',
            task
        });
    } catch (error) {
        console.error('Unflag task error:', error);
        res.status(500).json({
            error: 'Failed to unflag task',
            details: error.message
        });
    }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (admin/manager only)
 */
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const success = await deleteTask(req.params.id);

        if (!success) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        res.json({
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            error: 'Failed to delete task',
            details: error.message
        });
    }
});

module.exports = router;