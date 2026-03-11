const express = require('express');
const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
const { authenticateToken } = require('../middleware/auth');
const { db, runQuery, getOne, getAll } = require('../config/database');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────
// MULTER — logo uploads
// ─────────────────────────────────────────────────────────────────
let uploadLogo = (req, res, next) => next(); // no-op fallback
try {
    const multer  = require('multer');
    const logoDir = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

    const storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, logoDir),
        filename:    (_req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `logo-${Date.now()}${ext}`);
        },
    });
    const upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
        fileFilter: (_req, file, cb) => {
            if (file.mimetype.startsWith('image/')) cb(null, true);
            else cb(new Error('Only image files are allowed'));
        },
    });
    uploadLogo = upload.single('logo');
    console.log('✅ Logo uploads enabled');
} catch (_) {
    console.log('ℹ️  Multer not found — logo uploads disabled');
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Role-based access control middleware
// ─────────────────────────────────────────────────────────────────
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.company_id) {
            return res.status(403).json({
                error: 'Company membership required',
                members: [],
                invitations: []
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                members: [],
                invitations: []
            });
        }
        next();
    };
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Generate invite code
// ─────────────────────────────────────────────────────────────────
function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─────────────────────────────────────────────────────────────────
// STARTUP DDL
// Ensures all columns and tables exist on server boot.
// Uses raw db.run with callbacks — correct for one-time DDL.
// ─────────────────────────────────────────────────────────────────
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
`, [], (err) => { if (err && !err.message.includes('already exists')) console.error('join_requests table:', err.message); });

// Add columns that may not exist yet (ALTER TABLE fails silently if column exists)
db.run(`ALTER TABLE users     ADD COLUMN join_status  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN invite_code  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN updated_at   TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN industry     TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN size         TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN website      TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN description  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN logo_url     TEXT`,  [], () => {});

// Back-fill invite codes for companies that don't have one yet
(async () => {
    try {
        const companies = await getAll('SELECT id FROM companies WHERE invite_code IS NULL');
        for (const c of companies) {
            const code = generateInviteCode();
            await runQuery('UPDATE companies SET invite_code = ? WHERE id = ?', [code, c.id]);
            console.log(`✅ Back-filled invite code for company ${c.id}: ${code}`);
        }
    } catch (_) {}
})();

// ─────────────────────────────────────────────────────────────────
// GET /api/company/team
// ── FIXED: now returns { members, company, count }
// CompanyOnboarding.jsx needs data.company for registration fields
// ─────────────────────────────────────────────────────────────────
router.get('/team', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.company_id) {
            return res.status(403).json({ error: 'Company membership required', members: [] });
        }

        console.log(`📊 Fetching team for company_id: ${req.user.company_id}`);

        const members = await getAll(
            `SELECT id, email, full_name, role, is_active, avatar_url, last_seen,
                    created_at, company_id, account_type, join_status
             FROM users
             WHERE company_id = ?
               AND (join_status = 'accepted' OR join_status IS NULL)
             ORDER BY
                 CASE role
                     WHEN 'owner'   THEN 1
                     WHEN 'admin'   THEN 2
                     WHEN 'manager' THEN 3
                     WHEN 'member'  THEN 4
                     ELSE 5
                 END, full_name ASC`,
            [req.user.company_id]
        );

        const safeMembers = Array.isArray(members) ? members : [];

        // ── ADDED: fetch company so CompanyOnboarding can display registration fields ──
        const company = await getOne(
            `SELECT id, name, industry, size, website, description, invite_code, logo_url
             FROM companies WHERE id = ?`,
            [req.user.company_id]
        );
        if (company) company.member_count = safeMembers.length;
        // ────────────────────────────────────────────────────────────────────────────────

        console.log(`✅ Found ${safeMembers.length} team members`);

        res.json({
            members: safeMembers,
            company: company || null,   // ← CompanyOnboarding needs this
            count:   safeMembers.length
        });

    } catch (error) {
        console.error('❌ Get team error:', error.message);
        res.status(500).json({ error: 'Failed to get team members', members: [] });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/invitations
// ─────────────────────────────────────────────────────────────────
router.get('/invitations', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        console.log(`📨 Fetching invitations for company_id: ${req.user.company_id}`);

        const invitations = await getAll(
            `SELECT ti.id, ti.email, ti.role, ti.invite_code, ti.status,
                    ti.expires_at, ti.created_at,
                    u.full_name as invited_by_name, u.email as invited_by_email
             FROM team_invitations ti
             LEFT JOIN users u ON ti.invited_by = u.id
             WHERE ti.company_id = ? AND ti.status = 'pending'
             ORDER BY ti.created_at DESC`,
            [req.user.company_id]
        );

        const safeInvitations = Array.isArray(invitations) ? invitations : [];
        console.log(`✅ Found ${safeInvitations.length} pending invitations`);

        res.json({ invitations: safeInvitations, count: safeInvitations.length });

    } catch (error) {
        console.error('❌ Get invitations error:', error.message);
        res.status(500).json({ error: 'Failed to get invitations', invitations: [] });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/company/team/invite
// ─────────────────────────────────────────────────────────────────
router.post('/team/invite', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || !/\S+@\S+\.\S+/.test(email))
            return res.status(400).json({ error: 'Valid email is required' });

        const validRoles = ['admin', 'manager', 'member'];
        if (!role || !validRoles.includes(role))
            return res.status(400).json({ error: 'Valid role is required (admin, manager, member)' });

        const allowedRoles = req.user.role === 'owner' ? ['admin', 'manager', 'member'] : ['member'];
        if (!allowedRoles.includes(role))
            return res.status(403).json({ error: 'You cannot assign that role' });

        const existingUser = await getOne(
            'SELECT id FROM users WHERE email = ? AND company_id = ?',
            [email, req.user.company_id]
        );
        if (existingUser)
            return res.status(400).json({ error: 'User is already a member of this company' });

        const pendingInvite = await getOne(
            'SELECT id FROM team_invitations WHERE email = ? AND company_id = ? AND status = ?',
            [email, req.user.company_id, 'pending']
        );
        if (pendingInvite)
            return res.status(400).json({ error: 'Invitation already sent to this email' });

        const inviteCode = generateInviteCode();
        const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await runQuery(
            `INSERT INTO team_invitations (company_id, email, invite_code, invited_by, role, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
            [req.user.company_id, email, inviteCode, req.user.id, role, 'pending', expiresAt.toISOString()]
        );

        console.log(`✅ Invitation sent to ${email} with code ${inviteCode}`);

        res.json({
            message: 'Invitation sent successfully',
            invitation: { email, role, invite_code: inviteCode, expires_at: expiresAt }
        });

    } catch (error) {
        console.error('❌ Invite error:', error.message);
        res.status(500).json({ error: 'Failed to send invitation', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/company/join/:code
// ── FIXED: supports BOTH invite flows:
//   1. companies.invite_code  → join_requests (pending approval)
//   2. team_invitations code  → immediate acceptance (your original flow)
// ─────────────────────────────────────────────────────────────────
router.post('/join/:code', authenticateToken, async (req, res) => {
    try {
        const code = req.params.code.toUpperCase().trim();

        // ── Flow 1: company invite_code (requires admin approval) ──────────────
        const company = await getOne('SELECT * FROM companies WHERE invite_code = ?', [code]);
        if (company) {
            const currentUser = await getOne('SELECT company_id, join_status FROM users WHERE id = ?', [req.user.id]);
            if (currentUser.company_id && currentUser.join_status === 'accepted')
                return res.status(400).json({ error: 'You are already a member of a company.' });

            const existing = await getOne(
                'SELECT * FROM join_requests WHERE company_id = ? AND user_id = ?',
                [company.id, req.user.id]
            );
            if (existing) {
                if (existing.status === 'pending')
                    return res.status(400).json({ error: 'You already have a pending request for this company.' });
                if (existing.status === 'accepted')
                    return res.status(400).json({ error: 'You are already a member of this company.' });
                // Declined — allow re-apply
                await runQuery(
                    `UPDATE join_requests SET status='pending', requested_at=datetime('now'), resolved_at=NULL, resolved_by=NULL WHERE id=?`,
                    [existing.id]
                );
            } else {
                await runQuery(
                    `INSERT INTO join_requests (company_id, user_id, status) VALUES (?, ?, 'pending')`,
                    [company.id, req.user.id]
                );
            }
            await runQuery(
                `UPDATE users SET company_id=?, join_status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [company.id, req.user.id]
            );
            return res.json({
                message: 'Join request sent. An admin will review it.',
                status: 'pending',
                company: { id: company.id, name: company.name }
            });
        }

        // ── Flow 2: team_invitations email-invite (immediate acceptance) ───────
        if (req.user.company_id)
            return res.status(400).json({ error: 'You already belong to a company' });

        const invitation = await getOne(
            `SELECT ti.*, c.name as company_name
             FROM team_invitations ti
             JOIN companies c ON ti.company_id = c.id
             WHERE ti.invite_code = ? AND ti.status = 'pending'`,
            [code]
        );
        if (!invitation)
            return res.status(404).json({ error: 'Invalid or expired invite code' });

        if (new Date(invitation.expires_at) < new Date()) {
            await runQuery('UPDATE team_invitations SET status = ? WHERE id = ?', ['expired', invitation.id]);
            return res.status(400).json({ error: 'Invite code has expired' });
        }

        await runQuery(
            'UPDATE users SET company_id = ?, role = ?, join_status = \'accepted\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [invitation.company_id, invitation.role, req.user.id]
        );
        await runQuery(
            'UPDATE team_invitations SET status = ?, used_at = datetime(\'now\') WHERE id = ?',
            ['accepted', invitation.id]
        );

        const joinedCompany = await getOne(
            'SELECT id, name, industry, size, logo_url FROM companies WHERE id = ?',
            [invitation.company_id]
        );

        console.log(`✅ User ${req.user.email} joined company ${joinedCompany.name}`);
        return res.json({ message: 'Successfully joined company', status: 'accepted', company: joinedCompany });

    } catch (error) {
        console.error('❌ Join company error:', error.message);
        res.status(500).json({ error: 'Failed to join company', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/my-status  ← ADDED (CompanyOnboarding JoinView polls this)
// ─────────────────────────────────────────────────────────────────
router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        const u = await getOne('SELECT company_id, join_status FROM users WHERE id = ?', [req.user.id]);
        if (!u || !u.company_id) return res.json({ status: null, company: null });
        const company = await getOne('SELECT id, name FROM companies WHERE id = ?', [u.company_id]);
        res.json({ status: u.join_status || null, company });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/join-requests  ← ADDED (CompanyOnboarding JoinRequestsPanel)
// ─────────────────────────────────────────────────────────────────
router.get('/join-requests', authenticateToken, requireRole('owner', 'admin', 'manager'), async (req, res) => {
    try {
        const requests = await getAll(
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
        console.error('❌ Get join requests error:', error.message);
        res.status(500).json({ error: 'Failed to get join requests' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/join-requests/:id/accept  ← ADDED
// ─────────────────────────────────────────────────────────────────
router.patch('/join-requests/:id/accept', authenticateToken, requireRole('owner', 'admin', 'manager'), async (req, res) => {
    try {
        const request = await getOne(
            'SELECT * FROM join_requests WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

        await runQuery(
            `UPDATE join_requests SET status='accepted', resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
            [req.user.id, request.id]
        );
        await runQuery(
            `UPDATE users SET role='member', join_status='accepted', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [request.user_id]
        );

        const u = await getOne('SELECT full_name FROM users WHERE id = ?', [request.user_id]);
        res.json({ message: `${u?.full_name || 'User'} has been accepted into the company.` });
    } catch (error) {
        console.error('❌ Accept error:', error.message);
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/join-requests/:id/decline  ← ADDED
// ─────────────────────────────────────────────────────────────────
router.patch('/join-requests/:id/decline', authenticateToken, requireRole('owner', 'admin', 'manager'), async (req, res) => {
    try {
        const request = await getOne(
            'SELECT * FROM join_requests WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

        await runQuery(
            `UPDATE join_requests SET status='declined', resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
            [req.user.id, request.id]
        );
        await runQuery(
            `UPDATE users SET company_id=NULL, join_status=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [request.user_id]
        );

        const u = await getOne('SELECT full_name FROM users WHERE id = ?', [request.user_id]);
        res.json({ message: `${u?.full_name || 'User'}'s request has been declined.` });
    } catch (error) {
        console.error('❌ Decline error:', error.message);
        res.status(500).json({ error: 'Failed to decline request' });
    }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/company/invitations/:id
// ─────────────────────────────────────────────────────────────────
router.delete('/invitations/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const result = await runQuery(
            'DELETE FROM team_invitations WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (result.changes === 0)
            return res.status(404).json({ error: 'Invitation not found' });

        console.log(`✅ Invitation ${req.params.id} revoked`);
        res.json({ message: 'Invitation revoked successfully' });

    } catch (error) {
        console.error('❌ Revoke invitation error:', error.message);
        res.status(500).json({ error: 'Failed to revoke invitation', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/team/:userId/role
// ─────────────────────────────────────────────────────────────────
router.patch('/team/:userId/role', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role }   = req.body;

        const validRoles = ['owner', 'admin', 'manager', 'member'];
        if (!role || !validRoles.includes(role))
            return res.status(400).json({ error: 'Valid role is required' });
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'Cannot change your own role' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'User not found in your company' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });
        if (req.user.role === 'admin' && ['owner', 'admin'].includes(role))
            return res.status(403).json({ error: 'Admins cannot assign admin or owner roles' });

        await runQuery('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
        console.log(`✅ Changed ${targetUser.full_name || targetUser.email} role to ${role}`);
        res.json({ message: 'Role updated successfully', user: { id: targetUser.id, role } });

    } catch (error) {
        console.error('❌ Update role error:', error.message);
        res.status(500).json({ error: 'Failed to update role', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/company/team/:userId
// ─────────────────────────────────────────────────────────────────
router.delete('/team/:userId', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'Cannot remove yourself from the company' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'User not found in your company' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'Cannot remove company owner' });

        await runQuery(
            'UPDATE users SET company_id = NULL, role = \'member\', join_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId]
        );
        // Also clean up any join_requests for this user
        try {
            await runQuery(
                `UPDATE join_requests SET status = 'declined' WHERE user_id = ? AND company_id = ?`,
                [userId, req.user.company_id]
            );
        } catch (_) {}

        console.log(`✅ Removed ${targetUser.full_name || targetUser.email} from company`);
        res.json({ message: 'User removed from company successfully', user: { id: targetUser.id, name: targetUser.full_name || targetUser.email } });

    } catch (error) {
        console.error('❌ Remove user error:', error.message);
        res.status(500).json({ error: 'Failed to remove user', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/team/:userId/status
// ─────────────────────────────────────────────────────────────────
router.patch('/team/:userId/status', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId }  = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean')
            return res.status(400).json({ error: 'isActive must be true or false' });
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'Cannot change your own status' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'User not found in your company' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'Cannot deactivate company owner' });

        await runQuery(
            'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [isActive ? 1 : 0, userId]
        );
        console.log(`✅ ${isActive ? 'Activated' : 'Deactivated'} ${targetUser.full_name || targetUser.email}`);
        res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully`, user: { id: targetUser.id, is_active: isActive } });

    } catch (error) {
        console.error('❌ Update status error:', error.message);
        res.status(500).json({ error: 'Failed to update user status', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/company/details
// ─────────────────────────────────────────────────────────────────
router.get('/details', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id)
            return res.status(404).json({ error: 'Not part of any company' });

        const company = await getOne('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const memberCountResult = await getOne(
            'SELECT COUNT(*) as count FROM users WHERE company_id = ?',
            [req.user.company_id]
        );

        res.json({ company: { ...company, member_count: memberCountResult?.count ?? 0 } });

    } catch (error) {
        console.error('❌ Get company details error:', error.message);
        res.status(500).json({ error: 'Failed to get company details', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/company/details
// Handles both:
//   • JSON body (no logo)          → Content-Type: application/json
//   • multipart/form-data (+ logo) → Content-Type: multipart/form-data
// ─────────────────────────────────────────────────────────────────
router.patch('/details', uploadLogo, authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const { name, industry, size, website, description } = req.body || {};

        // If a logo file was uploaded, build its public URL
        let logoUrl = null;
        if (req.file) {
            logoUrl = `http://localhost:3001/uploads/logos/${req.file.filename}`;
        }

        await runQuery(
            `UPDATE companies
             SET name        = COALESCE(?, name),
                 industry    = COALESCE(?, industry),
                 size        = COALESCE(?, size),
                 website     = COALESCE(?, website),
                 description = COALESCE(?, description),
                 logo_url    = COALESCE(?, logo_url),
                 updated_at  = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                name        || null,
                industry    || null,
                size        || null,
                website     || null,
                description || null,
                logoUrl,                   // null = keep existing logo
                req.user.company_id,
            ]
        );

        const updated = await getOne('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
        console.log(`✅ Company ${updated.name} updated`);
        res.json({ message: 'Company updated successfully', company: updated });

    } catch (error) {
        console.error('❌ Update company error:', error.message);
        res.status(500).json({ error: 'Failed to update company', details: error.message });
    }
});

module.exports = router;