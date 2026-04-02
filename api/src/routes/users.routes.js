// api/src/routes/users.routes.js
// User management endpoints

const express = require('express');
const router  = express.Router();
const path    = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    findById, getAllUsers, updateUser, updateProfile,
    changePassword, deleteUser, getOnlineUsers, verifyPassword
} = require('../models/User');

// Apply authentication to all user routes
router.use(authenticateToken);

// ── Multer (optional — graceful no-op if not installed) ──────────────────────
let upload = { single: () => (req, res, next) => next() };
try {
    const multer     = require('multer');
    const fs         = require('fs');
    const uploadDir  = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    upload = multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, uploadDir),
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname) || '.jpg';
                cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
            },
        }),
        limits: { fileSize: 3 * 1024 * 1024 },
        fileFilter: (_req, file, cb) =>
            file.mimetype.startsWith('image/')
                ? cb(null, true)
                : cb(new Error('Only image files are allowed')),
    });
} catch (_) {
    console.log('ℹ️  multer not installed — avatar file upload disabled (run: npm install multer)');
}

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json({ users: users.map(sanitizeUser), count: users.length });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to get users', details: err.message });
    }
});

// ── GET /api/users/online ─────────────────────────────────────────────────────
router.get('/online', async (req, res) => {
    try {
        const users = await getOnlineUsers();
        res.json({ users: users.map(sanitizeUser), count: users.length });
    } catch (err) {
        console.error('Get online users error:', err);
        res.status(500).json({ error: 'Failed to get online users', details: err.message });
    }
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
    try {
        const user = await findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Failed to get profile', details: err.message });
    }
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────────
// Update name and/or avatar.
// Accepts multipart/form-data (with multer file) OR plain JSON:
//   JSON:  { fullName, removeAvatar: true, device }
//   Form:  avatar (file field), fullName, device
router.put('/me', upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        let avatarUrl    = undefined;
        let removeAvatar = false;

        if (req.file) {
            // File uploaded via multer
            const BASE_URL = process.env.BASE_URL || 'https://syncline-1.onrender.com';
            avatarUrl = `${BASE_URL}/uploads/avatars/${req.file.filename}`;
        } else if (req.body.removeAvatar === true || req.body.removeAvatar === 'true') {
            removeAvatar = true;
        }

        const fullName = req.body.fullName !== undefined
            ? String(req.body.fullName).trim()
            : undefined;

        // Must have at least one field to change
        if (fullName === undefined && avatarUrl === undefined && !removeAvatar) {
            return res.status(400).json({ error: 'Nothing to update — provide fullName or avatar' });
        }

        await updateProfile(userId, { fullName, avatarUrl, removeAvatar });

        const updated = await findById(userId);

        // Broadcast to other sessions (best-effort)
        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:profile_updated', {
                    userId,
                    device: req.body.device || 'Unknown device',
                });
            }
        } catch (_) {}

        res.json({ message: 'Profile updated successfully', user: sanitizeUser(updated) });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
});

// ── PUT /api/users/me/password ────────────────────────────────────────────────
router.put('/me/password', async (req, res) => {
    try {
        const { currentPassword, newPassword, device } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        // Need password_hash — fetch full row
        const { getOne } = require('../config/database');
        const row = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!row) return res.status(404).json({ error: 'User not found' });

        const valid = await verifyPassword(currentPassword, row.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        await changePassword(req.user.id, newPassword);

        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(req.user.id, 'user:password_changed', {
                    userId: req.user.id,
                    device: device || 'Unknown device',
                });
            }
        } catch (_) {}

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: err.message || 'Failed to change password' });
    }
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────────
//
// BEHAVIOUR:
//   - Full name and avatar are PRESERVED on tasks/records (they belong to work
//     history, not the account). The user row is anonymized, not hard-deleted,
//     so foreign keys on tasks, reports, etc. remain valid.
//   - firebase_uid and email are cleared so the account can never be re-linked.
//   - Company ownership is transferred or the company is dissolved if no other
//     members exist.
//   - The caller is responsible for deleting the Firebase Auth account on the
//     client side (fbUser.delete()) after this call succeeds.
//
router.delete('/me', async (req, res) => {
    try {
        const userId = req.user.id;
        const device = req.body?.device || 'Unknown device';

        const { runQuery, getOne } = require('../config/database');

        const user = await findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        console.log(`🗑️  Deleting account for user ${userId} (${user.email})`);

        // ── 1. Nullify created_by / assignee_id on tasks so tasks survive ────
        // We do NOT delete tasks — they are work history.
        // Tasks keep their content; they just lose the user link.
        await runQuery(
            'UPDATE tasks SET created_by = NULL WHERE created_by = ?',
            [userId]
        );
        await runQuery(
            'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?',
            [userId]
        );

        // ── 2. Handle company membership ──────────────────────────────────────
        if (user.company_id) {
            const company = await getOne(
                'SELECT * FROM companies WHERE id = ?',
                [user.company_id]
            );

            if (company && company.owner_id === userId) {
                // User is the company owner — try to transfer ownership to another active member
                const nextOwner = await getOne(
                    `SELECT user_id FROM company_members
                     WHERE company_id = ? AND user_id != ? AND status = 'active'
                     ORDER BY joined_at ASC LIMIT 1`,
                    [user.company_id, userId]
                );

                if (nextOwner) {
                    // Transfer ownership
                    await runQuery(
                        'UPDATE companies SET owner_id = ? WHERE id = ?',
                        [nextOwner.user_id, user.company_id]
                    );
                    await runQuery(
                        `UPDATE company_members SET role = 'owner'
                         WHERE company_id = ? AND user_id = ?`,
                        [user.company_id, nextOwner.user_id]
                    );
                    console.log(`  ↳ Company ownership transferred to user ${nextOwner.user_id}`);
                } else {
                    // No other members — dissolve the company
                    await runQuery(
                        'UPDATE tasks SET company_id = NULL, org_id = NULL WHERE company_id = ?',
                        [user.company_id]
                    );
                    await runQuery('DELETE FROM company_members WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM invitations WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM join_requests WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM companies WHERE id = ?', [user.company_id]);
                    console.log(`  ↳ Company ${user.company_id} dissolved (no remaining members)`);
                }
            }

            // Remove from company_members regardless
            await runQuery(
                'DELETE FROM company_members WHERE user_id = ?',
                [userId]
            );
        }

        // ── 3. Remove outstanding invitations / join requests ─────────────────
        await runQuery('DELETE FROM invitations WHERE invited_by = ?',  [userId]);
        await runQuery('DELETE FROM join_requests WHERE user_id = ?',   [userId]);

        // ── 4. Remove task_reports authored by this user ──────────────────────
        // (these are personal submissions, not shared work history)
        try {
            await runQuery('DELETE FROM task_reports WHERE user_id = ?', [userId]);
        } catch (_) {
            // task_reports table may not exist on all installs
        }

        // ── 5. Anonymize the user row — do NOT hard-delete ───────────────────
        // Keeping the row means all FK references on tasks/reports stay valid.
        // firebase_uid + email are cleared so the account is permanently unlinked.
        await runQuery(
            `UPDATE users SET
                firebase_uid = NULL,
                email        = ?,
                password_hash = NULL,
                is_active    = 0,
                company_id   = NULL,
                org_id       = NULL,
                last_seen    = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [`deleted_user_${userId}@syncline.local`, userId]
        );

        console.log(`  ✅ User ${userId} anonymized successfully`);

        // ── 6. Broadcast before we finish (best-effort) ───────────────────────
        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:account_deleted', { userId, device });
            }
        } catch (_) {}

        res.json({ message: 'Account permanently deleted' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: err.message || 'Failed to delete account' });
    }
});

// ── GET /api/users/:id (admin/manager only) ───────────────────────────────────
router.get('/:id', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const user = await findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to get user', details: err.message });
    }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
    if (!user) return null;
    return {
        id:        user.id,
        email:     user.email,
        fullName:  user.full_name,
        role:      user.role,
        isActive:  user.is_active,
        avatar:    user.avatar_url || null,
        lastSeen:  user.last_seen,
        createdAt: user.created_at,
    };
}

module.exports = router;