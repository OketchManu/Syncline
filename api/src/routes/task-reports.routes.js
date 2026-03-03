// api/src/routes/task-reports.routes.js
// Task Reports & Progress Tracking Routes

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');
const { broadcastToCompany } = require('../config/websocket');

// ═══════════════════════════════════════════════════════════════
// TASK ASSIGNMENT (for managers)
// ═══════════════════════════════════════════════════════════════

// Assign task to user(s)
router.post('/:taskId/assign', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { user_ids, require_report } = req.body; // Array of user IDs

        // Get task
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check permission (creator, manager, or admin can assign)
        if (task.created_by !== req.user.id && !['owner', 'admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized to assign this task' });
        }

        // Update primary assignee if single user
        if (user_ids.length === 1) {
            await db.run(
                'UPDATE tasks SET assigned_to = ?, reported_by = ? WHERE id = ?',
                [user_ids[0], require_report ? user_ids[0] : null, taskId]
            );
        }

        // Add assignments
        for (const userId of user_ids) {
            await db.run(
                `INSERT OR REPLACE INTO task_assignments (task_id, user_id, role, assigned_by)
                 VALUES (?, ?, 'contributor', ?)`,
                [taskId, userId, req.user.id]
            );

            // Create notification
            await db.run(
                `INSERT INTO notifications (user_id, type, title, message, related_task_id, priority)
                 VALUES (?, 'task_assigned', 'New Task Assigned', ?, ?, 'high')`,
                [userId, `You've been assigned to: ${task.title}`, taskId]
            );
        }

        // Log activity
        await db.run(
            `INSERT INTO activities (company_id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'task_assigned', 'task', ?, ?)`,
            [req.user.company_id, req.user.id, taskId, JSON.stringify({ assigned_to: user_ids })]
        );

        // Broadcast update
        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'task:assigned', {
                task_id: taskId,
                assigned_to: user_ids,
                assigned_by: req.user
            });
        }

        res.json({ message: 'Task assigned successfully' });

    } catch (error) {
        console.error('Assign task error:', error);
        res.status(500).json({ error: 'Failed to assign task' });
    }
});

// Get task assignments
router.get('/:taskId/assignments', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;

        const assignments = await db.all(
            `SELECT ta.*, u.full_name, u.avatar, u.email, u.job_title
             FROM task_assignments ta
             JOIN users u ON ta.user_id = u.id
             WHERE ta.task_id = ?
             ORDER BY ta.assigned_at DESC`,
            [taskId]
        );

        res.json({ assignments });

    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({ error: 'Failed to get assignments' });
    }
});

// ═══════════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════

// Submit progress update
router.post('/:taskId/progress', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { progress_percent, status_update, hours_worked, blockers, next_steps } = req.body;

        // Check if user is assigned to task
        const assignment = await db.get(
            'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
            [taskId, req.user.id]
        );

        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);

        if (!assignment && task.assigned_to !== req.user.id) {
            return res.status(403).json({ error: 'Not assigned to this task' });
        }

        // Insert progress update
        await db.run(
            `INSERT INTO task_progress 
             (task_id, user_id, progress_percent, status_update, hours_worked, blockers, next_steps)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [taskId, req.user.id, progress_percent, status_update, hours_worked, blockers, next_steps]
        );

        // Update task status if 100%
        if (progress_percent === 100 && task.status !== 'completed') {
            await db.run(
                'UPDATE tasks SET status = \'review\' WHERE id = ?',
                [taskId]
            );
        }

        // Notify managers
        const managers = await db.all(
            `SELECT DISTINCT u.id 
             FROM users u
             WHERE u.company_id = ? AND u.role IN ('owner', 'admin', 'manager')`,
            [req.user.company_id]
        );

        for (const manager of managers) {
            await db.run(
                `INSERT INTO notifications (user_id, type, title, message, related_task_id)
                 VALUES (?, 'progress_update', 'Task Progress Update', ?, ?)`,
                [manager.id, `${req.user.full_name} updated progress on: ${task.title}`, taskId]
            );
        }

        // Broadcast
        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'task:progress_updated', {
                task_id: taskId,
                user: req.user,
                progress: progress_percent
            });
        }

        res.json({ message: 'Progress updated successfully' });

    } catch (error) {
        console.error('Progress update error:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Get task progress history
router.get('/:taskId/progress', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;

        const progress = await db.all(
            `SELECT tp.*, u.full_name, u.avatar
             FROM task_progress tp
             JOIN users u ON tp.user_id = u.id
             WHERE tp.task_id = ?
             ORDER BY tp.created_at DESC`,
            [taskId]
        );

        res.json({ progress });

    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

// ═══════════════════════════════════════════════════════════════
// REPORT REQUESTS (for managers)
// ═══════════════════════════════════════════════════════════════

// Request report from user
router.post('/:taskId/request-report', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { user_id, message, due_date } = req.body;

        // Check if requester is manager/admin/owner
        if (!['owner', 'admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only managers can request reports' });
        }

        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Create report request
        await db.run(
            `INSERT INTO report_requests (task_id, requested_from, requested_by, message, due_date)
             VALUES (?, ?, ?, ?, ?)`,
            [taskId, user_id, req.user.id, message, due_date]
        );

        // Notify user
        await db.run(
            `INSERT INTO notifications (user_id, type, title, message, related_task_id, priority)
             VALUES (?, 'report_requested', 'Report Requested', ?, ?, 'high')`,
            [user_id, `${req.user.full_name} has requested a report for: ${task.title}`, taskId]
        );

        // Log activity
        await db.run(
            `INSERT INTO activities (company_id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'report_requested', 'task', ?, ?)`,
            [req.user.company_id, req.user.id, taskId, JSON.stringify({ requested_from: user_id })]
        );

        // Broadcast
        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'report:requested', {
                task_id: taskId,
                requested_from: user_id,
                requested_by: req.user
            });
        }

        res.json({ message: 'Report requested successfully' });

    } catch (error) {
        console.error('Request report error:', error);
        res.status(500).json({ error: 'Failed to request report' });
    }
});

// Get pending report requests for current user
router.get('/my-report-requests', authenticateToken, async (req, res) => {
    try {
        const requests = await db.all(
            `SELECT rr.*, t.title as task_title, u.full_name as requested_by_name
             FROM report_requests rr
             JOIN tasks t ON rr.task_id = t.id
             JOIN users u ON rr.requested_by = u.id
             WHERE rr.requested_from = ? AND rr.status = 'pending'
             ORDER BY rr.due_date ASC, rr.created_at DESC`,
            [req.user.id]
        );

        res.json({ requests });

    } catch (error) {
        console.error('Get report requests error:', error);
        res.status(500).json({ error: 'Failed to get report requests' });
    }
});

// ═══════════════════════════════════════════════════════════════
// REPORT SUBMISSION
// ═══════════════════════════════════════════════════════════════

// Submit task report
router.post('/:taskId/reports', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, content, summary, hours_spent, challenges, outcomes } = req.body;

        // Check if user is assigned
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        const assignment = await db.get(
            'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
            [taskId, req.user.id]
        );

        if (!assignment && task.assigned_to !== req.user.id) {
            return res.status(403).json({ error: 'Not assigned to this task' });
        }

        // Insert report
        const result = await db.run(
            `INSERT INTO task_reports 
             (task_id, submitted_by, title, content, summary, hours_spent, challenges, outcomes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [taskId, req.user.id, title, content, summary, hours_spent, challenges, outcomes]
        );

        // Mark report requests as submitted
        await db.run(
            `UPDATE report_requests 
             SET status = 'submitted' 
             WHERE task_id = ? AND requested_from = ? AND status = 'pending'`,
            [taskId, req.user.id]
        );

        // Notify managers and task creator
        const notifyUsers = await db.all(
            `SELECT DISTINCT u.id 
             FROM users u
             WHERE u.company_id = ? AND (u.role IN ('owner', 'admin', 'manager') OR u.id = ?)`,
            [req.user.company_id, task.created_by]
        );

        for (const user of notifyUsers) {
            await db.run(
                `INSERT INTO notifications (user_id, type, title, message, related_task_id)
                 VALUES (?, 'report_submitted', 'Report Submitted', ?, ?)`,
                [user.id, `${req.user.full_name} submitted a report for: ${task.title}`, taskId]
            );
        }

        // Broadcast
        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'report:submitted', {
                task_id: taskId,
                report_id: result.lastID,
                submitted_by: req.user
            });
        }

        res.json({
            message: 'Report submitted successfully',
            report_id: result.lastID
        });

    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// Get task reports
router.get('/:taskId/reports', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;

        const reports = await db.all(
            `SELECT tr.*, u.full_name as submitted_by_name, u.avatar,
             r.full_name as reviewed_by_name
             FROM task_reports tr
             JOIN users u ON tr.submitted_by = u.id
             LEFT JOIN users r ON tr.reviewed_by = r.id
             WHERE tr.task_id = ?
             ORDER BY tr.submitted_at DESC`,
            [taskId]
        );

        res.json({ reports });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// Review/Approve report
router.patch('/reports/:reportId/review', authenticateToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, review_notes } = req.body; // 'approved', 'rejected', 'revision_requested'

        // Only managers/admins can review
        if (!['owner', 'admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only managers can review reports' });
        }

        await db.run(
            `UPDATE task_reports 
             SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, review_notes, req.user.id, reportId]
        );

        // Get report to notify submitter
        const report = await db.get(
            'SELECT * FROM task_reports WHERE id = ?',
            [reportId]
        );

        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [report.task_id]);

        // Notify submitter
        await db.run(
            `INSERT INTO notifications (user_id, type, title, message, related_task_id)
             VALUES (?, 'report_reviewed', 'Report Reviewed', ?, ?)`,
            [
                report.submitted_by,
                `Your report for "${task.title}" was ${status}`,
                report.task_id
            ]
        );

        res.json({ message: 'Report reviewed successfully' });

    } catch (error) {
        console.error('Review report error:', error);
        res.status(500).json({ error: 'Failed to review report' });
    }
});

// ═══════════════════════════════════════════════════════════════
// MONITORING & ANALYTICS
// ═══════════════════════════════════════════════════════════════

// Get user's task overview
router.get('/user/:userId/overview', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check permission (can only view own data unless manager+)
        if (parseInt(userId) !== req.user.id && !['owner', 'admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Task statistics
        const taskStats = await db.get(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
             FROM tasks 
             WHERE assigned_to = ?`,
            [userId]
        );

        // Report statistics
        const reportStats = await db.get(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
             FROM task_reports 
             WHERE submitted_by = ?`,
            [userId]
        );

        // Pending report requests
        const pendingRequests = await db.get(
            `SELECT COUNT(*) as count
             FROM report_requests
             WHERE requested_from = ? AND status = 'pending'`,
            [userId]
        );

        res.json({
            tasks: taskStats,
            reports: reportStats,
            pending_requests: pendingRequests.count
        });

    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Failed to get overview' });
    }
});

module.exports = router;
