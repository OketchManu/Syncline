// api/src/routes/company.routes.js
// Company Management Routes

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE - Role Checks
// ═══════════════════════════════════════════════════════════════

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user.company_id) {
            return res.status(403).json({ error: 'Company membership required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// ═══════════════════════════════════════════════════════════════
// COMPANY REGISTRATION & SETUP
// ═══════════════════════════════════════════════════════════════

// Register new company
router.post('/register', authenticateToken, async (req, res) => {
    try {
        const { name, industry, size, website } = req.body;
        
        // Check if user already belongs to a company
        if (req.user.company_id) {
            return res.status(400).json({ error: 'You already belong to a company' });
        }

        // Create company
        const company = await db.run(
            `INSERT INTO companies (name, industry, size, website, subscription_plan, subscription_status)
             VALUES (?, ?, ?, ?, 'free', 'trial')`,
            [name, industry, size, website]
        );

        // Update user to be company owner
        await db.run(
            `UPDATE users SET company_id = ?, role = 'owner' WHERE id = ?`,
            [company.lastID, req.user.id]
        );

        // Create default department
        await db.run(
            `INSERT INTO departments (company_id, name, description, manager_id)
             VALUES (?, 'General', 'Default department', ?)`,
            [company.lastID, req.user.id]
        );

        // Log activity
        await db.run(
            `INSERT INTO activities (company_id, user_id, action, entity_type, entity_id)
             VALUES (?, ?, 'company_created', 'company', ?)`,
            [company.lastID, req.user.id, company.lastID]
        );

        const newCompany = await db.get('SELECT * FROM companies WHERE id = ?', [company.lastID]);

        res.json({
            message: 'Company registered successfully',
            company: newCompany
        });

    } catch (error) {
        console.error('Company registration error:', error);
        res.status(500).json({ error: 'Failed to register company' });
    }
});

// Get company details
router.get('/details', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id) {
            return res.status(404).json({ error: 'Not part of any company' });
        }

        const company = await db.get(
            'SELECT * FROM companies WHERE id = ?',
            [req.user.company_id]
        );

        // Get member count
        const memberCount = await db.get(
            'SELECT COUNT(*) as count FROM users WHERE company_id = ?',
            [req.user.company_id]
        );

        // Get department count
        const deptCount = await db.get(
            'SELECT COUNT(*) as count FROM departments WHERE company_id = ?',
            [req.user.company_id]
        );

        res.json({
            company: {
                ...company,
                member_count: memberCount.count,
                department_count: deptCount.count
            }
        });

    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to get company details' });
    }
});

// Update company details
router.patch('/details', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    try {
        const { name, industry, size, website, phone, address } = req.body;

        await db.run(
            `UPDATE companies 
             SET name = ?, industry = ?, size = ?, website = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, industry, size, website, phone, address, req.user.company_id]
        );

        const updated = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);

        res.json({
            message: 'Company updated successfully',
            company: updated
        });

    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
});

// ═══════════════════════════════════════════════════════════════
// TEAM MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// Get all team members
router.get('/team', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id) {
            return res.status(403).json({ error: 'Company membership required' });
        }

        const { department, role, active } = req.query;

        let query = `
            SELECT u.*, d.name as department_name 
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.company_id = ?
        `;
        const params = [req.user.company_id];

        if (department) {
            query += ' AND u.department_id = ?';
            params.push(department);
        }

        if (role) {
            query += ' AND u.role = ?';
            params.push(role);
        }

        if (active !== undefined) {
            query += ' AND u.is_active = ?';
            params.push(active === 'true' ? 1 : 0);
        }

        query += ' ORDER BY u.role DESC, u.full_name ASC';

        const members = await db.all(query, params);

        // Remove sensitive data
        const sanitized = members.map(m => ({
            ...m,
            password: undefined
        }));

        res.json({ members: sanitized });

    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team members' });
    }
});

// Invite team member
router.post('/team/invite', authenticateToken, requireRole(['owner', 'admin', 'manager']), async (req, res) => {
    try {
        const { email, role, department_id } = req.body;

        // Validate role
        const allowedRoles = req.user.role === 'owner' 
            ? ['admin', 'manager', 'member']
            : ['member'];

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Cannot assign that role' });
        }

        // Check if already invited or member
        const existing = await db.get(
            'SELECT * FROM users WHERE email = ? AND company_id = ?',
            [email, req.user.company_id]
        );

        if (existing) {
            return res.status(400).json({ error: 'User already part of company' });
        }

        // Create invitation token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.run(
            `INSERT INTO invitations (company_id, email, role, department_id, invited_by, token, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.company_id, email, role, department_id, req.user.id, token, expiresAt.toISOString()]
        );

        // TODO: Send invitation email

        // Log activity
        await db.run(
            `INSERT INTO activities (company_id, user_id, action, details)
             VALUES (?, ?, 'user_invited', ?)`,
            [req.user.company_id, req.user.id, JSON.stringify({ email, role })]
        );

        res.json({
            message: 'Invitation sent successfully',
            invitation: {
                email,
                role,
                expires_at: expiresAt,
                token // In production, don't send this - use email link
            }
        });

    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Update team member role
router.patch('/team/:userId/role', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // Can't change own role
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot change your own role' });
        }

        // Get target user
        const targetUser = await db.get(
            'SELECT * FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Owner can change any role, admin can only change member/manager
        if (req.user.role === 'admin' && ['owner', 'admin'].includes(role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        await db.run(
            'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [role, userId]
        );

        res.json({ message: 'Role updated successfully' });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Remove team member
router.delete('/team/:userId', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    try {
        const { userId } = req.params;

        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot remove yourself' });
        }

        const targetUser = await db.get(
            'SELECT * FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove from company (set company_id to null, keep user account)
        await db.run(
            'UPDATE users SET company_id = NULL, department_id = NULL, role = \'member\' WHERE id = ?',
            [userId]
        );

        res.json({ message: 'User removed from company' });

    } catch (error) {
        console.error('Remove user error:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

// ═══════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════

// Get all departments
router.get('/departments', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id) {
            return res.status(403).json({ error: 'Company membership required' });
        }

        const departments = await db.all(
            `SELECT d.*, u.full_name as manager_name,
             (SELECT COUNT(*) FROM users WHERE department_id = d.id) as member_count
             FROM departments d
             LEFT JOIN users u ON d.manager_id = u.id
             WHERE d.company_id = ?
             ORDER BY d.name`,
            [req.user.company_id]
        );

        res.json({ departments });

    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Failed to get departments' });
    }
});

// Create department
router.post('/departments', authenticateToken, requireRole(['owner', 'admin']), async (req, res) => {
    try {
        const { name, description, manager_id } = req.body;

        const result = await db.run(
            `INSERT INTO departments (company_id, name, description, manager_id)
             VALUES (?, ?, ?, ?)`,
            [req.user.company_id, name, description, manager_id]
        );

        const department = await db.get('SELECT * FROM departments WHERE id = ?', [result.lastID]);

        res.json({
            message: 'Department created successfully',
            department
        });

    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS & REPORTS
// ═══════════════════════════════════════════════════════════════

// Get company analytics
router.get('/analytics', authenticateToken, requireRole(['owner', 'admin', 'manager']), async (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

        // Total tasks
        const taskStats = await db.get(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN deadline < datetime('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
             FROM tasks 
             WHERE company_id = ? AND created_at >= ?`,
            [req.user.company_id, startDate.toISOString()]
        );

        // Active users
        const activeUsers = await db.get(
            `SELECT COUNT(DISTINCT user_id) as count
             FROM activities 
             WHERE company_id = ? AND created_at >= ?`,
            [req.user.company_id, startDate.toISOString()]
        );

        // Reports submitted
        const reportStats = await db.get(
            `SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
             FROM task_reports tr
             JOIN tasks t ON tr.task_id = t.id
             WHERE t.company_id = ? AND tr.submitted_at >= ?`,
            [req.user.company_id, startDate.toISOString()]
        );

        res.json({
            period: `${period} days`,
            tasks: taskStats,
            active_users: activeUsers.count,
            reports: reportStats
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Get team performance
router.get('/performance', authenticateToken, requireRole(['owner', 'admin', 'manager']), async (req, res) => {
    try {
        const { department_id } = req.query;

        let query = `
            SELECT 
                u.id, u.full_name, u.role, u.job_title,
                COUNT(DISTINCT t.id) as tasks_assigned,
                SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as tasks_completed,
                SUM(CASE WHEN t.deadline < datetime('now') AND t.status != 'completed' THEN 1 ELSE 0 END) as tasks_overdue,
                COUNT(DISTINCT tr.id) as reports_submitted,
                AVG(tp.progress_percent) as avg_progress
            FROM users u
            LEFT JOIN tasks t ON t.assigned_to = u.id
            LEFT JOIN task_reports tr ON tr.submitted_by = u.id
            LEFT JOIN task_progress tp ON tp.user_id = u.id
            WHERE u.company_id = ? AND u.is_active = 1
        `;
        const params = [req.user.company_id];

        if (department_id) {
            query += ' AND u.department_id = ?';
            params.push(department_id);
        }

        query += ' GROUP BY u.id ORDER BY tasks_completed DESC';

        const performance = await db.all(query, params);

        res.json({ performance });

    } catch (error) {
        console.error('Performance error:', error);
        res.status(500).json({ error: 'Failed to get performance data' });
    }
});

module.exports = router;
