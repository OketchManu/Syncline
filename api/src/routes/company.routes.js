// api/src/routes/company.routes.js
const express = require('express');
const router  = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../config/database');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const requireRole = (roles) => (req, res, next) => {
    if (!req.user.company_id)
        return res.status(403).json({ error: 'Company membership required' });
    if (!roles.includes(req.user.role))
        return res.status(403).json({ error: 'Insufficient permissions' });
    next();
};

async function generateInviteCode(companyName) {
    const prefix = (companyName || 'SYNC')
        .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
    for (let i = 0; i < 10; i++) {
        const code   = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const exists = await db.get('SELECT id FROM companies WHERE invite_code = ?', [code]);
        if (!exists) return code;
    }
    throw new Error('Could not generate unique invite code');
}

// Create join_requests table if it doesn't exist yet
db.run(`
    CREATE TABLE IF NOT EXISTS join_requests (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id   INTEGER NOT NULL,
        user_id      INTEGER NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','accepted','declined')),
        requested_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at  TEXT,
        resolved_by  INTEGER,
        UNIQUE(company_id, user_id)
    )
`, [], (err) => { if (err) console.error('join_requests table:', err.message); });

// Add join_status column to users if it doesn't exist yet
db.run(`ALTER TABLE users ADD COLUMN join_status TEXT`, [], () => {});

// Add invite_code column to companies if it doesn't exist yet
db.run(`ALTER TABLE companies ADD COLUMN invite_code TEXT`, [], () => {});

// Back-fill invite codes for companies that don't have one
(async () => {
    try {
        const companies = await db.all('SELECT id, name FROM companies WHERE invite_code IS NULL');
        for (const c of companies) {
            const code = await generateInviteCode(c.name);
            await db.run('UPDATE companies SET invite_code=? WHERE id=?', [code, c.id]);
        }
    } catch (_) {}
})();

// ─────────────────────────────────────────────────────────────────
// GET /api/company/team
// Returns { members, company } — used by CompanyOnboarding + TeamManagement
// ─────────────────────────────────────────────────────────────────

router.get('/team', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id)
            return res.status(403).json({ error: 'Company membership required' });

        const members = await db.all(
            `SELECT id, full_name, email, role, job_title, avatar_url, is_active, account_type, join_status, created_at
             FROM users
             WHERE company_id = ?
               AND (join_status = 'accepted' OR join_status IS NULL)
             ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END, full_name ASC`,
            [req.user.company_id]
        );

        const company = await db.get(
            `SELECT id, name, industry, size, website, description, invite_code, logo_url FROM companies WHERE id = ?`,
            [req.user.company_id]
        );

        if (company) company.member_count = members.length;

        res.json({ members, company: company || null });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team members' });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/company/join/:code
// Personal account submits a JOIN REQUEST — pending until admin approves
// ─────────────────────────────────────────────────────────────────

router.post('/join/:code', authenticateToken, async (req, res) => {
    try {
        const code = req.params.code.trim().toUpperCase();

        // Already accepted into a company
        const currentUser = await db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
        if (currentUser.company_id && currentUser.join_status === 'accepted')
            return res.status(400).json({ error: 'You are already a member of a company.' });

        // Look up company by invite code — must match exactly what the system generated
        const company = await db.get('SELECT * FROM companies WHERE invite_code = ?', [code]);
        if (!company)
            return res.status(404).json({
                error: 'Invalid invite code. Make sure you are using the exact code from your admin.'
            });

        // Check for existing join request
        const existing = await db.get(
            'SELECT * FROM join_requests WHERE company_id=? AND user_id=?',
            [company.id, req.user.id]
        );

        if (existing) {
            if (existing.status === 'pending')
                return res.status(400).json({ error: 'You already have a pending request for this company.' });
            if (existing.status === 'accepted')
                return res.status(400).json({ error: 'You are already a member of this company.' });
            // Declined — allow re-apply
            await db.run(
                `UPDATE join_requests SET status='pending', requested_at=datetime('now'), resolved_at=NULL, resolved_by=NULL WHERE id=?`,
                [existing.id]
            );
        } else {
            await db.run(
                `INSERT INTO join_requests (company_id, user_id, status) VALUES (?, ?, 'pending')`,
                [company.id, req.user.id]
            );
        }

        // Tag the user with the company and pending status
        await db.run(
            `UPDATE users SET company_id=?, join_status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [company.id, req.user.id]
        );

        res.json({
            message: 'Join request sent. You will be notified once an admin approves your request.',
            status:  'pending',
            company: { id: company.id, name: company.name }
        });
    } catch (error) {
        console.error('Join error:', error);
        res.status(500).json({ error: 'Failed to submit join request' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/my-status
// Personal account polls their own join status
// ─────────────────────────────────────────────────────────────────

router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        const u = await db.get('SELECT company_id, join_status FROM users WHERE id=?', [req.user.id]);
        if (!u || !u.company_id) return res.json({ status: null, company: null });

        const company = await db.get('SELECT id, name FROM companies WHERE id=?', [u.company_id]);
        res.json({ status: u.join_status || null, company });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/join-requests
// Company admin/manager sees pending join requests
// ─────────────────────────────────────────────────────────────────

router.get('/join-requests', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const requests = await db.all(
            `SELECT jr.id, jr.status, jr.requested_at,
                    u.id as user_id, u.full_name, u.email, u.avatar_url, u.account_type
             FROM join_requests jr
             JOIN users u ON jr.user_id = u.id
             WHERE jr.company_id = ?
             ORDER BY jr.requested_at DESC`,
            [req.user.company_id]
        );
        res.json({ requests });
    } catch (error) {
        console.error('Get join requests error:', error);
        res.status(500).json({ error: 'Failed to get join requests' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/join-requests/:id/accept
// ─────────────────────────────────────────────────────────────────

router.patch('/join-requests/:id/accept', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const request = await db.get(
            'SELECT * FROM join_requests WHERE id=? AND company_id=?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

        await db.run(
            `UPDATE join_requests SET status='accepted', resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
            [req.user.id, request.id]
        );
        await db.run(
            `UPDATE users SET role='member', join_status='accepted', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [request.user_id]
        );

        const u = await db.get('SELECT full_name FROM users WHERE id=?', [request.user_id]);
        res.json({ message: `${u.full_name} has been accepted into the company.` });
    } catch (error) {
        console.error('Accept error:', error);
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/join-requests/:id/decline
// ─────────────────────────────────────────────────────────────────

router.patch('/join-requests/:id/decline', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const request = await db.get(
            'SELECT * FROM join_requests WHERE id=? AND company_id=?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

        await db.run(
            `UPDATE join_requests SET status='declined', resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
            [req.user.id, request.id]
        );
        // Unlink user from company entirely
        await db.run(
            `UPDATE users SET company_id=NULL, join_status=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [request.user_id]
        );

        const u = await db.get('SELECT full_name FROM users WHERE id=?', [request.user_id]);
        res.json({ message: `${u.full_name}'s request has been declined.` });
    } catch (error) {
        console.error('Decline error:', error);
        res.status(500).json({ error: 'Failed to decline request' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/details
// ─────────────────────────────────────────────────────────────────

router.patch('/details', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const body = req.body || {};
        const { name, industry, size, website, description } = body;
        await db.run(
            `UPDATE companies
             SET name=COALESCE(?,name), industry=COALESCE(?,industry), size=COALESCE(?,size),
                 website=COALESCE(?,website), description=COALESCE(?,description),
                 updated_at=CURRENT_TIMESTAMP
             WHERE id=?`,
            [name || null, industry || null, size || null, website || null, description || null, req.user.company_id]
        );
        const updated = await db.get('SELECT * FROM companies WHERE id=?', [req.user.company_id]);
        res.json({ message: 'Company updated', company: updated });
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/details
// ─────────────────────────────────────────────────────────────────

router.get('/details', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id)
            return res.status(404).json({ error: 'Not part of any company' });
        const company = await db.get('SELECT * FROM companies WHERE id=?', [req.user.company_id]);
        const { count } = await db.get(
            `SELECT COUNT(*) as count FROM users WHERE company_id=? AND (join_status='accepted' OR join_status IS NULL)`,
            [req.user.company_id]
        );
        res.json({ company: { ...company, member_count: count } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get company details' });
    }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/company/team/:userId
// ─────────────────────────────────────────────────────────────────

router.delete('/team/:userId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'Cannot remove yourself' });

        const target = await db.get('SELECT * FROM users WHERE id=? AND company_id=?', [userId, req.user.company_id]);
        if (!target) return res.status(404).json({ error: 'User not found' });

        await db.run(
            `UPDATE users SET company_id=NULL, join_status=NULL, role='member', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [userId]
        );
        await db.run(
            `UPDATE join_requests SET status='declined' WHERE user_id=? AND company_id=?`,
            [userId, req.user.company_id]
        );
        res.json({ message: 'User removed from company' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/team/:userId/role
// ─────────────────────────────────────────────────────────────────

router.patch('/team/:userId/role', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role }   = req.body;
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'Cannot change your own role' });
        const target = await db.get('SELECT * FROM users WHERE id=? AND company_id=?', [userId, req.user.company_id]);
        if (!target) return res.status(404).json({ error: 'User not found' });
        await db.run('UPDATE users SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [role, userId]);
        res.json({ message: 'Role updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/departments
// ─────────────────────────────────────────────────────────────────

router.get('/departments', authenticateToken, async (req, res) => {
    if (!req.user.company_id)
        return res.status(403).json({ error: 'Company membership required' });
    let departments = [];
    try {
        departments = await db.all(
            'SELECT * FROM departments WHERE company_id=? ORDER BY name',
            [req.user.company_id]
        );
    } catch (_) {}
    res.json({ departments });
});

module.exports = router;