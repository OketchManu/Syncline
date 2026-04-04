// api/src/routes/company.routes.js
const express = require('express');
const router  = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
const { authenticateToken } = require('../middleware/auth');
const { db, runQuery, getOne, getAll } = require('../config/database');
const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');

// ─── Nodemailer ───────────────────────────────────────────────────────────────
let transporter = null;
try {
    const nodemailer = require('nodemailer');
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            host:   process.env.EMAIL_HOST,
            port:   parseInt(process.env.EMAIL_PORT || '587'),
            secure: false,
            auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
        console.log('✅ Email transporter ready (SMTP)');
    } else {
        console.log('ℹ️  No EMAIL_* env vars — invite links will be logged to console');
    }
} catch (e) {
    console.log('ℹ️  nodemailer not available — invite links will be logged to console');
}

async function sendInviteEmail({ toEmail, inviterName, companyName, role, inviteCode }) {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const joinUrl  = `${FRONTEND_URL}/join/${inviteCode}`;
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px;text-align:center;">
                <div style="font-size:36px;font-weight:800;color:#fff;letter-spacing:-1px;">Syncline</div>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Real-Time Operations Platform</p>
            </div>
            <div style="padding:40px;">
                <h2 style="margin:0 0 16px;font-size:22px;color:#fff;">You've been invited!</h2>
                <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
                    <strong style="color:#e2e8f0;">${inviterName}</strong> has invited you to join
                    <strong style="color:#e2e8f0;">${companyName}</strong> on Syncline as a
                    <strong style="color:#a5b4fc;">${roleLabel}</strong>.
                </p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${joinUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
                        Accept Invitation
                    </a>
                </div>
                <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
                    This invite expires in 7 days.<br/>
                    <a href="${joinUrl}" style="color:#6366f1;">${joinUrl}</a>
                </p>
            </div>
        </div>`;

    const text = `You've been invited to join ${companyName} on Syncline as ${roleLabel}.\n\nAccept here: ${joinUrl}\n\nThis invite expires in 7 days.`;

    if (!transporter) {
        console.log(`📧 [EMAIL NOT SENT - no transporter] To: ${toEmail} | Join URL: ${joinUrl}`);
        return { logged: true, joinUrl };
    }

    try {
        const info = await transporter.sendMail({
            from:    process.env.EMAIL_FROM || `"Syncline" <${process.env.EMAIL_USER || 'noreply@syncline.app'}>`,
            to:      toEmail,
            subject: `You're invited to join ${companyName} on Syncline`,
            text,
            html,
        });
        return { messageId: info.messageId };
    } catch (e) {
        console.error('❌ Email send failed:', e.message);
        return { error: e.message };
    }
}

// ─── Multer for logo uploads ──────────────────────────────────────────────────
let uploadLogo = (req, res, next) => next();
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
        limits: { fileSize: 5 * 1024 * 1024 },
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

// ─── Role middleware ──────────────────────────────────────────────────────────
function requireCompanyRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.company_id) {
            return res.status(403).json({
                error:   'You must be a member of a company to do this.',
                members: [], invitations: [],
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error:   `Only ${allowedRoles.join(' or ')} can perform this action. Your role is: ${req.user.role}.`,
                members: [], invitations: [],
            });
        }
        next();
    };
}

function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─── Startup DDL ──────────────────────────────────────────────────────────────
db.run(`CREATE TABLE IF NOT EXISTS join_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id   INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','accepted','declined')),
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at  TEXT,
    resolved_by  INTEGER,
    UNIQUE(company_id, user_id)
)`, [], (err) => { if (err && !err.message.includes('already exists')) console.error('join_requests table:', err.message); });

db.run(`CREATE TABLE IF NOT EXISTS team_invitations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id   INTEGER NOT NULL,
    email        TEXT NOT NULL,
    invite_code  TEXT NOT NULL UNIQUE,
    invited_by   INTEGER NOT NULL,
    role         TEXT NOT NULL DEFAULT 'member',
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','accepted','expired','revoked')),
    expires_at   TEXT NOT NULL,
    used_at      TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`, [], (err) => { if (err && !err.message.includes('already exists')) console.error('team_invitations table:', err.message); });

db.run(`ALTER TABLE users     ADD COLUMN join_status  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN invite_code  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN updated_at   TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN industry     TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN size         TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN website      TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN description  TEXT`,  [], () => {});
db.run(`ALTER TABLE companies ADD COLUMN logo_url     TEXT`,  [], () => {});

// ─── GET /api/company/team ────────────────────────────────────────────────────
router.get('/team', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.company_id) {
            return res.status(403).json({ error: 'You are not a member of any company.', members: [] });
        }

        console.log(`📊 Fetching team for company_id: ${req.user.company_id}`);

        const members = await getAll(
            `SELECT id, email, full_name, role, is_active, avatar_url, last_seen,
                    created_at, company_id, account_type, join_status
             FROM users
             WHERE company_id = ?
               AND (join_status = 'accepted' OR join_status IS NULL)
               AND email NOT LIKE 'deleted_user_%@syncline.local'
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

        const company = await getOne(
            `SELECT id, name, industry, size, website, description, invite_code, logo_url
             FROM companies WHERE id = ?`,
            [req.user.company_id]
        );
        if (company) company.member_count = safeMembers.length;

        console.log(`✅ Found ${safeMembers.length} team members`);

        res.json({ members: safeMembers, company: company || null, count: safeMembers.length });

    } catch (error) {
        console.error('❌ Get team error:', error.message);
        res.status(500).json({ error: 'Failed to load team. Please try again.', members: [] });
    }
});

// ─── GET /api/company/invitations ────────────────────────────────────────────
router.get('/invitations', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
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
        res.json({ invitations: safeInvitations, count: safeInvitations.length });

    } catch (error) {
        console.error('❌ Get invitations error:', error.message);
        res.status(500).json({ error: 'Failed to load invitations. Please try again.', invitations: [] });
    }
});

// ─── POST /api/company/team/invite ───────────────────────────────────────────
router.post('/team/invite', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || !/\S+@\S+\.\S+/.test(email))
            return res.status(400).json({ error: 'A valid email address is required.' });

        const validRoles = ['admin', 'manager', 'member'];
        if (!role || !validRoles.includes(role))
            return res.status(400).json({ error: 'Please select a valid role: admin, manager, or member.' });

        const allowedRoles = req.user.role === 'owner' ? ['admin', 'manager', 'member'] : ['member'];
        if (!allowedRoles.includes(role))
            return res.status(403).json({ error: `You do not have permission to assign the "${role}" role.` });

        const existingUser = await getOne(
            'SELECT id FROM users WHERE email = ? AND company_id = ?',
            [email, req.user.company_id]
        );
        if (existingUser)
            return res.status(400).json({ error: `${email} is already a member of your company.` });

        const pendingInvite = await getOne(
            'SELECT id FROM team_invitations WHERE email = ? AND company_id = ? AND status = ?',
            [email, req.user.company_id, 'pending']
        );
        if (pendingInvite)
            return res.status(400).json({ error: `An invitation has already been sent to ${email}. Check your pending invitations.` });

        const inviteCode = generateInviteCode();
        const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await runQuery(
            `INSERT INTO team_invitations (company_id, email, invite_code, invited_by, role, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
            [req.user.company_id, email, inviteCode, req.user.id, role, expiresAt.toISOString()]
        );

        const inviter = await getOne('SELECT full_name, email FROM users WHERE id = ?', [req.user.id]);
        const company = await getOne('SELECT name FROM companies WHERE id = ?', [req.user.company_id]);

        console.log(`✅ Invitation created for ${email} with code ${inviteCode}`);

        res.json({
            message:    `Invitation sent to ${email} successfully.`,
            invitation: { email, role, invite_code: inviteCode, expires_at: expiresAt },
        });

        sendInviteEmail({
            toEmail:     email,
            inviterName: inviter?.full_name || inviter?.email || 'A team admin',
            companyName: company?.name || 'the company',
            role,
            inviteCode,
        }).then(emailRes => {
            if (emailRes?.logged)  console.log(`📧 Join URL (no email transport): http://localhost:3000/join/${inviteCode}`);
            else if (emailRes?.error) console.error(`📧 Email failed: ${emailRes.error}`);
        }).catch(e => console.error('📧 Email error:', e.message));

    } catch (error) {
        console.error('❌ Invite error:', error.message);
        res.status(500).json({ error: 'Failed to send invitation. Please try again.', details: error.message });
    }
});

// ─── GET /api/company/invite-info/:code (PUBLIC) ─────────────────────────────
router.get('/invite-info/:code', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase().trim();

        const invitation = await getOne(
            `SELECT ti.role, ti.expires_at, ti.status,
                    c.name as company_name,
                    u.full_name as inviter_name, u.email as inviter_email
             FROM team_invitations ti
             JOIN companies c ON ti.company_id = c.id
             LEFT JOIN users u ON ti.invited_by = u.id
             WHERE ti.invite_code = ?`,
            [code]
        );

        if (!invitation)
            return res.status(404).json({ error: 'This invite link is invalid or has already been used.' });

        if (invitation.status !== 'pending')
            return res.status(400).json({ error: `This invite has already been ${invitation.status}.` });

        if (new Date(invitation.expires_at) < new Date())
            return res.status(400).json({ error: 'This invite link has expired. Ask your admin to send a new one.' });

        res.json({
            companyName: invitation.company_name,
            role:        invitation.role,
            inviterName: invitation.inviter_name || invitation.inviter_email || null,
            expiresAt:   invitation.expires_at,
        });
    } catch (error) {
        console.error('❌ Invite info error:', error.message);
        res.status(500).json({ error: 'Failed to load invite information. Please try again.' });
    }
});

// ─── POST /api/company/join/:code ────────────────────────────────────────────
router.post('/join/:code', authenticateToken, async (req, res) => {
    try {
        const code = req.params.code.toUpperCase().trim();

        // Flow 1: company invite_code (requires admin approval)
        const company = await getOne('SELECT * FROM companies WHERE invite_code = ?', [code]);
        if (company) {
            const currentUser = await getOne('SELECT company_id, join_status FROM users WHERE id = ?', [req.user.id]);
            if (currentUser.company_id && currentUser.join_status === 'accepted')
                return res.status(400).json({ error: 'You are already a member of a company. Leave it first before joining another.' });

            const existing = await getOne(
                'SELECT * FROM join_requests WHERE company_id = ? AND user_id = ?',
                [company.id, req.user.id]
            );
            if (existing) {
                if (existing.status === 'pending')
                    return res.status(400).json({ error: 'You already have a pending request for this company. Please wait for an admin to review it.' });
                if (existing.status === 'accepted')
                    return res.status(400).json({ error: 'You are already a member of this company.' });
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
                message: 'Join request sent successfully. An admin will review it shortly.',
                status:  'pending',
                company: { id: company.id, name: company.name },
            });
        }

        // Flow 2: team_invitations email-invite (immediate acceptance)
        if (req.user.company_id)
            return res.status(400).json({ error: 'You already belong to a company. Leave it first before joining another.' });

        const invitation = await getOne(
            `SELECT ti.*, c.name as company_name
             FROM team_invitations ti
             JOIN companies c ON ti.company_id = c.id
             WHERE ti.invite_code = ? AND ti.status = 'pending'`,
            [code]
        );
        if (!invitation)
            return res.status(404).json({ error: 'This invite code is invalid or has already been used.' });

        if (new Date(invitation.expires_at) < new Date()) {
            await runQuery('UPDATE team_invitations SET status = ? WHERE id = ?', ['expired', invitation.id]);
            return res.status(400).json({ error: 'This invite code has expired. Ask your admin to send a new invite.' });
        }

        await runQuery(
            `UPDATE users SET company_id = ?, role = ?, join_status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [invitation.company_id, invitation.role, req.user.id]
        );
        await runQuery(
            `UPDATE team_invitations SET status = 'accepted', used_at = datetime('now') WHERE id = ?`,
            [invitation.id]
        );

        const joinedCompany = await getOne(
            'SELECT id, name, industry, size, logo_url FROM companies WHERE id = ?',
            [invitation.company_id]
        );

        console.log(`✅ User ${req.user.email} joined company ${joinedCompany.name}`);
        return res.json({
            message: `You have successfully joined ${joinedCompany.name}!`,
            status:  'accepted',
            company: joinedCompany,
        });

    } catch (error) {
        console.error('❌ Join company error:', error.message);
        res.status(500).json({ error: 'Failed to join company. Please try again.', details: error.message });
    }
});

// ─── GET /api/company/my-status ──────────────────────────────────────────────
router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        const u = await getOne('SELECT company_id, join_status FROM users WHERE id = ?', [req.user.id]);
        if (!u || !u.company_id) return res.json({ status: null, company: null });
        const company = await getOne('SELECT id, name FROM companies WHERE id = ?', [u.company_id]);
        res.json({ status: u.join_status || null, company });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get your company status. Please try again.' });
    }
});

// ─── GET /api/company/join-requests ──────────────────────────────────────────
router.get('/join-requests', authenticateToken, requireCompanyRole('owner', 'admin', 'manager'), async (req, res) => {
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
        res.status(500).json({ error: 'Failed to load join requests. Please try again.' });
    }
});

// ─── PATCH /api/company/join-requests/:id/accept ─────────────────────────────
router.patch('/join-requests/:id/accept', authenticateToken, requireCompanyRole('owner', 'admin', 'manager'), async (req, res) => {
    try {
        const request = await getOne(
            'SELECT * FROM join_requests WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Join request not found.' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been resolved.' });

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
        res.status(500).json({ error: 'Failed to accept request. Please try again.' });
    }
});

// ─── PATCH /api/company/join-requests/:id/decline ────────────────────────────
router.patch('/join-requests/:id/decline', authenticateToken, requireCompanyRole('owner', 'admin', 'manager'), async (req, res) => {
    try {
        const request = await getOne(
            'SELECT * FROM join_requests WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (!request) return res.status(404).json({ error: 'Join request not found.' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'This request has already been resolved.' });

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
        res.status(500).json({ error: 'Failed to decline request. Please try again.' });
    }
});

// ─── DELETE /api/company/invitations/:id ─────────────────────────────────────
router.delete('/invitations/:id', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
        const result = await runQuery(
            'DELETE FROM team_invitations WHERE id = ? AND company_id = ?',
            [req.params.id, req.user.company_id]
        );
        if (result.changes === 0)
            return res.status(404).json({ error: 'Invitation not found.' });

        res.json({ message: 'Invitation revoked successfully.' });

    } catch (error) {
        console.error('❌ Revoke invitation error:', error.message);
        res.status(500).json({ error: 'Failed to revoke invitation. Please try again.' });
    }
});

// ─── PATCH /api/company/team/:userId/role ────────────────────────────────────
router.patch('/team/:userId/role', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role }   = req.body;

        const validRoles = ['owner', 'admin', 'manager', 'member'];
        if (!role || !validRoles.includes(role))
            return res.status(400).json({ error: 'Please provide a valid role: owner, admin, manager, or member.' });
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'You cannot change your own role.' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'This user is not a member of your company.' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'The company owner\'s role cannot be changed.' });
        if (req.user.role === 'admin' && ['owner', 'admin'].includes(role))
            return res.status(403).json({ error: 'Admins cannot assign owner or admin roles.' });

        await runQuery('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
        console.log(`✅ Changed ${targetUser.full_name || targetUser.email} role to ${role}`);
        res.json({ message: `${targetUser.full_name || targetUser.email}'s role has been updated to ${role}.`, user: { id: targetUser.id, role } });

    } catch (error) {
        console.error('❌ Update role error:', error.message);
        res.status(500).json({ error: 'Failed to update role. Please try again.' });
    }
});

// ─── DELETE /api/company/team/:userId ────────────────────────────────────────
router.delete('/team/:userId', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'You cannot remove yourself from the company.' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'This user is not a member of your company.' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'The company owner cannot be removed.' });

        await runQuery(
            `UPDATE users SET company_id = NULL, role = 'member', join_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [userId]
        );
        try {
            await runQuery(
                `UPDATE join_requests SET status = 'declined' WHERE user_id = ? AND company_id = ?`,
                [userId, req.user.company_id]
            );
        } catch (_) {}

        console.log(`✅ Removed ${targetUser.full_name || targetUser.email} from company`);
        res.json({ message: `${targetUser.full_name || targetUser.email} has been removed from the company.` });

    } catch (error) {
        console.error('❌ Remove user error:', error.message);
        res.status(500).json({ error: 'Failed to remove user. Please try again.' });
    }
});

// ─── PATCH /api/company/team/:userId/status ──────────────────────────────────
router.patch('/team/:userId/status', authenticateToken, requireCompanyRole('owner', 'admin'), async (req, res) => {
    try {
        const { userId }  = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean')
            return res.status(400).json({ error: 'isActive must be true or false.' });
        if (parseInt(userId) === req.user.id)
            return res.status(400).json({ error: 'You cannot change your own active status.' });

        const targetUser = await getOne(
            'SELECT id, role, full_name, email FROM users WHERE id = ? AND company_id = ?',
            [userId, req.user.company_id]
        );
        if (!targetUser) return res.status(404).json({ error: 'This user is not a member of your company.' });
        if (targetUser.role === 'owner') return res.status(403).json({ error: 'The company owner cannot be deactivated.' });

        await runQuery(
            'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [isActive ? 1 : 0, userId]
        );
        res.json({
            message: `${targetUser.full_name || targetUser.email} has been ${isActive ? 'activated' : 'deactivated'}.`,
            user: { id: targetUser.id, is_active: isActive },
        });

    } catch (error) {
        console.error('❌ Update status error:', error.message);
        res.status(500).json({ error: 'Failed to update user status. Please try again.' });
    }
});

// ─── GET /api/company/details ─────────────────────────────────────────────────
router.get('/details', authenticateToken, async (req, res) => {
    try {
        if (!req.user.company_id)
            return res.status(404).json({ error: 'You are not part of any company.' });

        const company = await getOne('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
        if (!company) return res.status(404).json({ error: 'Company not found.' });

        const memberCountResult = await getOne(
            'SELECT COUNT(*) as count FROM users WHERE company_id = ?',
            [req.user.company_id]
        );

        res.json({ company: { ...company, member_count: memberCountResult?.count ?? 0 } });

    } catch (error) {
        console.error('❌ Get company details error:', error.message);
        res.status(500).json({ error: 'Failed to load company details. Please try again.' });
    }
});

// ─── PATCH /api/company/details ───────────────────────────────────────────────
// FIX: authenticateToken MUST come before uploadLogo in middleware chain.
// Previously uploadLogo ran first which could consume the request body before
// auth had a chance to verify the token, causing 404 "user not found" errors
// on JSON requests when the content-type header wasn't multipart.
router.patch('/details', authenticateToken, requireCompanyRole('owner', 'admin'), uploadLogo, async (req, res) => {
    try {
        const { name, industry, size, website, description } = req.body || {};

        let logoUrl = null;
        if (req.file) {
            const BASE_URL = process.env.BASE_URL || 'https://syncline-1.onrender.com';
            logoUrl = `${BASE_URL}/uploads/logos/${req.file.filename}`;
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
                logoUrl,
                req.user.company_id,
            ]
        );

        const updated = await getOne('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
        console.log(`✅ Company ${updated.name} updated`);
        res.json({ message: 'Company details updated successfully.', company: updated });

    } catch (error) {
        console.error('❌ Update company error:', error.message);
        res.status(500).json({ error: 'Failed to update company details. Please try again.' });
    }
});

module.exports = router;