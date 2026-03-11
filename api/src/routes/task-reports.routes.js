// api/src/routes/task-reports.routes.js
// Task Reports & Progress Tracking Routes

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db, runQuery, getOne, getAll } = require('../config/database');
const { broadcastToCompany } = require('../config/websocket');

// ─────────────────────────────────────────────────────────────────
// STARTUP DDL — silently adds missing columns on old DBs
// ─────────────────────────────────────────────────────────────────
db.run(`ALTER TABLE task_reports ADD COLUMN blockers    TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN next_steps  TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN feedback    TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN company_id  INTEGER`, [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN content     TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN challenges  TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN outcomes    TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN summary     TEXT`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN hours_spent REAL`,    [], () => {});
db.run(`ALTER TABLE task_reports ADD COLUMN submitted_at TEXT`,   [], () => {});

// ═══════════════════════════════════════════════════════════════
// STATIC ROUTES FIRST (must come before any /:param routes)
// ═══════════════════════════════════════════════════════════════

// GET /api/task-reports
router.get('/', authenticateToken, async (req, res) => {
    try {
        const isManager = ['owner', 'admin', 'manager'].includes(req.user.role);

        let reports;
        if (req.user.company_id && isManager) {
            // Also catch reports from personal accounts who joined via invite (tr.company_id may be null)
            reports = await getAll(
                `SELECT tr.*,
                        u.full_name  AS author_name,
                        u.avatar_url AS author_avatar,
                        u.email      AS author_email,
                        rv.full_name AS reviewer_name,
                        t.title      AS task_title
                 FROM task_reports tr
                 JOIN users u       ON tr.submitted_by = u.id
                 LEFT JOIN users rv ON tr.reviewed_by  = rv.id
                 LEFT JOIN tasks t  ON tr.task_id      = t.id
                 WHERE tr.company_id = ?
                    OR u.company_id  = ?
                 ORDER BY tr.submitted_at DESC`,
                [req.user.company_id, req.user.company_id]
            );
        } else {
            reports = await getAll(
                `SELECT tr.*,
                        u.full_name  AS author_name,
                        u.avatar_url AS author_avatar,
                        u.email      AS author_email,
                        rv.full_name AS reviewer_name,
                        t.title      AS task_title
                 FROM task_reports tr
                 JOIN users u       ON tr.submitted_by = u.id
                 LEFT JOIN users rv ON tr.reviewed_by  = rv.id
                 LEFT JOIN tasks t  ON tr.task_id      = t.id
                 WHERE tr.submitted_by = ?
                 ORDER BY tr.submitted_at DESC`,
                [req.user.id]
            );
        }

        res.json({ reports: Array.isArray(reports) ? reports : [] });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports', details: error.message });
    }
});

// POST /api/task-reports
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { task_id, title, summary, hours_spent, blockers, next_steps, status = 'pending' } = req.body;

        if (!title?.trim())   return res.status(400).json({ error: 'Title is required' });
        if (!summary?.trim()) return res.status(400).json({ error: 'Summary is required' });

        // Personal accounts may have company_id on their users row even if not on the token
        let companyId = req.user.company_id || null;
        if (!companyId) {
            const userRow = await getOne(`SELECT company_id FROM users WHERE id = ?`, [req.user.id]);
            companyId = userRow?.company_id || null;
        }

        if (task_id) {
            const task = await getOne('SELECT * FROM tasks WHERE id = ?', [task_id]);
            if (!task) return res.status(404).json({ error: 'Task not found' });

            const isManager = ['owner', 'admin', 'manager'].includes(req.user.role);
            if (!isManager) {
                const assignment = await getOne(
                    'SELECT id FROM task_assignments WHERE task_id = ? AND user_id = ?',
                    [task_id, req.user.id]
                );
                if (!assignment && task.assignee_id !== req.user.id)
                    return res.status(403).json({ error: 'You are not assigned to this task' });
            }
        }

        const result = await runQuery(
            `INSERT INTO task_reports
             (task_id, submitted_by, company_id, title, content, summary, hours_spent,
              blockers, next_steps, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                task_id || null,
                req.user.id,
                companyId,
                title.trim(),
                summary.trim(),   // content = summary (satisfies NOT NULL)
                summary.trim(),
                hours_spent ? parseFloat(hours_spent) : null,
                blockers   || null,
                next_steps || null,
                status === 'draft' ? 'draft' : 'pending',
            ]
        );

        if (task_id) {
            await runQuery(
                `UPDATE report_requests SET status = 'submitted'
                 WHERE task_id = ? AND requested_from = ? AND status = 'pending'`,
                [task_id, req.user.id]
            ).catch(() => {});
        }

        if (companyId && status !== 'draft') {
            const managers = await getAll(
                `SELECT id FROM users
                 WHERE company_id = ? AND role IN ('owner','admin','manager') AND id != ?`,
                [companyId, req.user.id]
            );
            for (const m of (managers || [])) {
                await runQuery(
                    `INSERT INTO notifications (user_id, type, title, message)
                     VALUES (?, 'report_submitted', 'New Report Submitted', ?)`,
                    [m.id, `${req.user.full_name || req.user.email} submitted a report: ${title}`]
                ).catch(() => {});
            }
            broadcastToCompany(companyId, 'report:submitted', {
                report_id: result.id,
                submitted_by: req.user,
            });
        }

        res.status(201).json({ message: 'Report submitted successfully', report_id: result.id });

    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ error: 'Failed to submit report', details: error.message });
    }
});

// GET /api/task-reports/my-report-requests  ← static, must be before /:taskId routes
router.get('/my-report-requests', authenticateToken, async (req, res) => {
    try {
        const requests = await getAll(
            `SELECT rr.*, t.title as task_title, u.full_name as requested_by_name
             FROM report_requests rr
             JOIN tasks t ON rr.task_id = t.id
             JOIN users u ON rr.requested_by = u.id
             WHERE rr.requested_from = ? AND rr.status = 'pending'
             ORDER BY rr.due_date ASC, rr.created_at DESC`,
            [req.user.id]
        );
        res.json({ requests: Array.isArray(requests) ? requests : [] });
    } catch (error) {
        console.error('Get report requests error:', error);
        res.status(500).json({ error: 'Failed to get report requests' });
    }
});

// PATCH /api/task-reports/reports/:reportId/review  ← static "reports" segment, before /:id routes
router.patch('/reports/:reportId/review', authenticateToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, review_notes } = req.body;

        if (!['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Only managers can review reports' });

        await runQuery(
            `UPDATE task_reports
             SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, review_notes, req.user.id, reportId]
        );

        const report = await getOne('SELECT * FROM task_reports WHERE id = ?', [reportId]);
        const task   = report?.task_id ? await getOne('SELECT title FROM tasks WHERE id = ?', [report.task_id]) : null;

        await runQuery(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES (?, 'report_reviewed', 'Report Reviewed', ?)`,
            [report.submitted_by, `Your report for "${task?.title || 'task'}" was ${status}`]
        ).catch(() => {});

        res.json({ message: 'Report reviewed successfully' });
    } catch (error) {
        console.error('Review report error:', error);
        res.status(500).json({ error: 'Failed to review report' });
    }
});

// ═══════════════════════════════════════════════════════════════
// TASK ASSIGNMENT
// ═══════════════════════════════════════════════════════════════

router.post('/:taskId/assign', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { user_ids } = req.body;

        if (!Array.isArray(user_ids) || user_ids.length === 0)
            return res.status(400).json({ error: 'user_ids must be a non-empty array' });

        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        if (task.created_by !== req.user.id && !['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Not authorized to assign this task' });

        if (user_ids.length === 1) {
            await runQuery(
                'UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [user_ids[0], taskId]
            );
        }

        for (const userId of user_ids) {
            await runQuery(
                `INSERT OR REPLACE INTO task_assignments (task_id, user_id, role, assigned_by, assigned_at)
                 VALUES (?, ?, 'contributor', ?, datetime('now'))`,
                [taskId, userId, req.user.id]
            );
            await runQuery(
                `INSERT INTO notifications (user_id, type, title, message)
                 VALUES (?, 'task_assigned', 'New Task Assigned', ?)`,
                [userId, `You've been assigned to: ${task.title}`]
            ).catch(() => {});
        }

        await runQuery(
            `INSERT INTO activities (company_id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'task_assigned', 'task', ?, ?)`,
            [req.user.company_id, req.user.id, taskId, JSON.stringify({ assigned_to: user_ids })]
        ).catch(() => {});

        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'task:assigned', {
                task_id: taskId, assigned_to: user_ids, assigned_by: req.user,
            });
        }

        res.json({ message: 'Task assigned successfully' });
    } catch (error) {
        console.error('Assign task error:', error);
        res.status(500).json({ error: 'Failed to assign task', details: error.message });
    }
});

router.get('/:taskId/assignments', authenticateToken, async (req, res) => {
    try {
        const assignments = await getAll(
            `SELECT ta.*, u.full_name, u.avatar_url, u.email, u.job_title
             FROM task_assignments ta
             JOIN users u ON ta.user_id = u.id
             WHERE ta.task_id = ?
             ORDER BY ta.assigned_at DESC`,
            [req.params.taskId]
        );
        res.json({ assignments: Array.isArray(assignments) ? assignments : [] });
    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({ error: 'Failed to get assignments' });
    }
});

// ═══════════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════

router.post('/:taskId/progress', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { progress_percent, status_update, hours_worked, blockers, next_steps } = req.body;

        const assignment = await getOne(
            'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
            [taskId, req.user.id]
        );
        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [taskId]);

        if (!assignment && task.assignee_id !== req.user.id)
            return res.status(403).json({ error: 'Not assigned to this task' });

        await runQuery(
            `INSERT INTO task_progress
             (task_id, user_id, progress_percent, status_update, hours_worked, blockers, next_steps)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [taskId, req.user.id, progress_percent, status_update, hours_worked, blockers, next_steps]
        );

        if (progress_percent === 100 && task.status !== 'completed') {
            await runQuery(
                "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [taskId]
            );
        }

        const managers = await getAll(
            `SELECT DISTINCT u.id FROM users u
             WHERE u.company_id = ? AND u.role IN ('owner', 'admin', 'manager')`,
            [req.user.company_id]
        );
        for (const manager of (managers || [])) {
            await runQuery(
                `INSERT INTO notifications (user_id, type, title, message)
                 VALUES (?, 'progress_update', 'Task Progress Update', ?)`,
                [manager.id, `${req.user.full_name} updated progress on: ${task.title}`]
            ).catch(() => {});
        }

        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'task:progress_updated', {
                task_id: taskId, user: req.user, progress: progress_percent,
            });
        }

        res.json({ message: 'Progress updated successfully' });
    } catch (error) {
        console.error('Progress update error:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

router.get('/:taskId/progress', authenticateToken, async (req, res) => {
    try {
        const progress = await getAll(
            `SELECT tp.*, u.full_name, u.avatar_url
             FROM task_progress tp
             JOIN users u ON tp.user_id = u.id
             WHERE tp.task_id = ?
             ORDER BY tp.created_at DESC`,
            [req.params.taskId]
        );
        res.json({ progress: Array.isArray(progress) ? progress : [] });
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

// ═══════════════════════════════════════════════════════════════
// REPORT REQUESTS
// ═══════════════════════════════════════════════════════════════

router.post('/:taskId/request-report', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { user_id, message, due_date } = req.body;

        if (!['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Only managers can request reports' });

        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        await runQuery(
            `INSERT INTO report_requests (task_id, requested_from, requested_by, message, due_date)
             VALUES (?, ?, ?, ?, ?)`,
            [taskId, user_id, req.user.id, message, due_date]
        );

        await runQuery(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES (?, 'report_requested', 'Report Requested', ?)`,
            [user_id, `${req.user.full_name} has requested a report for: ${task.title}`]
        ).catch(() => {});

        await runQuery(
            `INSERT INTO activities (company_id, user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, 'report_requested', 'task', ?, ?)`,
            [req.user.company_id, req.user.id, taskId, JSON.stringify({ requested_from: user_id })]
        ).catch(() => {});

        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'report:requested', {
                task_id: taskId, requested_from: user_id, requested_by: req.user,
            });
        }

        res.json({ message: 'Report requested successfully' });
    } catch (error) {
        console.error('Request report error:', error);
        res.status(500).json({ error: 'Failed to request report' });
    }
});

// ═══════════════════════════════════════════════════════════════
// TASK-SCOPED REPORTS (backwards compat)
// ═══════════════════════════════════════════════════════════════

router.post('/:taskId/reports', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, content, summary, hours_spent, challenges, outcomes } = req.body;

        const task = await getOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
        const assignment = await getOne(
            'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
            [taskId, req.user.id]
        );

        if (!assignment && task.assignee_id !== req.user.id)
            return res.status(403).json({ error: 'Not assigned to this task' });

        const result = await runQuery(
            `INSERT INTO task_reports
             (task_id, submitted_by, company_id, title, content, summary,
              hours_spent, challenges, outcomes, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [taskId, req.user.id, req.user.company_id || null, title, content, summary, hours_spent, challenges, outcomes]
        );

        await runQuery(
            `UPDATE report_requests SET status = 'submitted'
             WHERE task_id = ? AND requested_from = ? AND status = 'pending'`,
            [taskId, req.user.id]
        ).catch(() => {});

        const notifyUsers = await getAll(
            `SELECT DISTINCT u.id FROM users u
             WHERE u.company_id = ? AND (u.role IN ('owner', 'admin', 'manager') OR u.id = ?)`,
            [req.user.company_id, task.created_by]
        );
        for (const u of (notifyUsers || [])) {
            await runQuery(
                `INSERT INTO notifications (user_id, type, title, message)
                 VALUES (?, 'report_submitted', 'Report Submitted', ?)`,
                [u.id, `${req.user.full_name} submitted a report for: ${task.title}`]
            ).catch(() => {});
        }

        if (req.user.company_id) {
            broadcastToCompany(req.user.company_id, 'report:submitted', {
                task_id: taskId, report_id: result.id, submitted_by: req.user,
            });
        }

        res.json({ message: 'Report submitted successfully', report_id: result.id });
    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

router.get('/:taskId/reports', authenticateToken, async (req, res) => {
    try {
        const reports = await getAll(
            `SELECT tr.*, u.full_name as submitted_by_name, u.avatar_url,
             r.full_name as reviewed_by_name
             FROM task_reports tr
             JOIN users u ON tr.submitted_by = u.id
             LEFT JOIN users r ON tr.reviewed_by = r.id
             WHERE tr.task_id = ?
             ORDER BY tr.submitted_at DESC`,
            [req.params.taskId]
        );
        res.json({ reports: Array.isArray(reports) ? reports : [] });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SINGLE REPORT ACTIONS — /:id  (after all /:taskId/* routes)
// ═══════════════════════════════════════════════════════════════

router.patch('/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (!['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Only managers can review reports' });

        const { feedback } = req.body;
        const report = await getOne('SELECT * FROM task_reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (report.company_id && report.company_id !== req.user.company_id)
            return res.status(403).json({ error: 'Report does not belong to your company' });

        await runQuery(
            `UPDATE task_reports
             SET status = 'approved', feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [feedback || null, req.user.id, req.params.id]
        );

        await runQuery(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES (?, 'report_reviewed', 'Report Approved', ?)`,
            [report.submitted_by, `Your report "${report.title}" was approved by ${req.user.full_name || req.user.email}`]
        ).catch(() => {});

        res.json({ message: 'Report approved' });
    } catch (error) {
        console.error('Approve error:', error);
        res.status(500).json({ error: 'Failed to approve report' });
    }
});

router.patch('/:id/reject', authenticateToken, async (req, res) => {
    try {
        if (!['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Only managers can review reports' });

        const { feedback } = req.body;
        const report = await getOne('SELECT * FROM task_reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        if (report.company_id && report.company_id !== req.user.company_id)
            return res.status(403).json({ error: 'Report does not belong to your company' });

        await runQuery(
            `UPDATE task_reports
             SET status = 'rejected', feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [feedback || null, req.user.id, req.params.id]
        );

        await runQuery(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES (?, 'report_reviewed', 'Report Needs Revision', ?)`,
            [report.submitted_by, `Your report "${report.title}" was rejected — check the feedback.`]
        ).catch(() => {});

        res.json({ message: 'Report rejected' });
    } catch (error) {
        console.error('Reject error:', error);
        res.status(500).json({ error: 'Failed to reject report' });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const report = await getOne('SELECT * FROM task_reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const isOwner   = report.submitted_by === req.user.id;
        const isManager = ['owner', 'admin', 'manager'].includes(req.user.role);
        const canAdmin  = isManager && report.company_id === req.user.company_id;

        if (!isOwner && !canAdmin)
            return res.status(403).json({ error: 'Not authorised to delete this report' });
        if (isOwner && !canAdmin && report.status === 'approved')
            return res.status(400).json({ error: 'Cannot delete an approved report' });

        await runQuery('DELETE FROM task_reports WHERE id = ?', [req.params.id]);
        res.json({ message: 'Report deleted' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// ═══════════════════════════════════════════════════════════════
// MONITORING & ANALYTICS
// ═══════════════════════════════════════════════════════════════

router.get('/user/:userId/overview', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        if (parseInt(userId) !== req.user.id && !['owner', 'admin', 'manager'].includes(req.user.role))
            return res.status(403).json({ error: 'Not authorized' });

        const taskStats = await getOne(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed'   THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
             FROM tasks WHERE assignee_id = ?`,
            [userId]
        );

        const reportStats = await getOne(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) as pending
             FROM task_reports WHERE submitted_by = ?`,
            [userId]
        );

        const pendingRequests = await getOne(
            `SELECT COUNT(*) as count FROM report_requests
             WHERE requested_from = ? AND status = 'pending'`,
            [userId]
        );

        res.json({
            tasks: taskStats,
            reports: reportStats,
            pending_requests: pendingRequests?.count || 0,
        });
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Failed to get overview' });
    }
});

module.exports = router;