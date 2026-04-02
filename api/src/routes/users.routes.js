// api/src/routes/users.routes.js
// User management endpoints

const express = require('express');
const router  = express.Router();
const path    = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    findById, getAllUsers, updateUser, updateProfile,
    changePassword, getOnlineUsers, verifyPassword
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
            const BASE_URL = process.env.BASE_URL || 'https://syncline-1.onrender.com';
            avatarUrl = `${BASE_URL}/uploads/avatars/${req.file.filename}`;
        } else if (req.body.removeAvatar === true || req.body.removeAvatar === 'true') {
            removeAvatar = true;
        }

        const fullName = req.body.fullName !== undefined
            ? String(req.body.fullName).trim()
            : undefined;

        if (fullName === undefined && avatarUrl === undefined && !removeAvatar) {
            return res.status(400).json({ error: 'Nothing to update — provide fullName or avatar' });
        }

        // updateProfile now also writes to profile_data for persistence across redeployments
        await updateProfile(userId, { fullName, avatarUrl, removeAvatar });

        const updated = await findById(userId);

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
// WHAT THIS DOES:
//   - Nullifies tasks references (UPDATE only — no DELETE on tasks to avoid
//     the ghost FK trigger that references the now-dropped tasks_old table)
//   - Handles company ownership transfer or dissolution
//   - Anonymizes the user row (clears email, firebase_uid, sets is_active=0)
//   - Preserves full_name and avatar_url on the row (they belong to work history)
//   - Removes the profile_data entry so it won't be restored on next signup
//   - Does NOT call User.deleteUser() — this route is self-contained
//
// CALLER RESPONSIBILITY:
//   After this call succeeds, the frontend must call auth.currentUser.delete()
//   to also remove the Firebase Auth account.
//
router.delete('/me', async (req, res) => {
    try {
        const userId = req.user.id;
        const device = req.body?.device || 'Unknown device';

        const { runQuery, getOne } = require('../config/database');

        const user = await findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        console.log(`🗑️  Deleting account for user ${userId} (${user.email})`);

        // ── 1. Nullify task references — UPDATE only, never DELETE ────────────
        // IMPORTANT: Do NOT use DELETE FROM tasks here. The tasks table was
        // rebuilt from tasks_old and SQLite may still have ghost triggers
        // that reference tasks_old. UPDATE is safe; DELETE is not.
        await runQuery('UPDATE tasks SET created_by  = NULL WHERE created_by  = ?', [userId]);
        await runQuery('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [userId]);

        // ── 2. Handle company ownership ───────────────────────────────────────
        if (user.company_id) {
            const company = await getOne('SELECT * FROM companies WHERE id = ?', [user.company_id]);

            if (company && company.owner_id === userId) {
                const nextOwner = await getOne(
                    `SELECT user_id FROM company_members
                     WHERE company_id = ? AND user_id != ? AND status = 'active'
                     ORDER BY joined_at ASC LIMIT 1`,
                    [user.company_id, userId]
                );

                if (nextOwner) {
                    await runQuery('UPDATE companies SET owner_id = ? WHERE id = ?', [nextOwner.user_id, user.company_id]);
                    await runQuery(`UPDATE company_members SET role = 'owner' WHERE company_id = ? AND user_id = ?`, [user.company_id, nextOwner.user_id]);
                    console.log(`  ↳ Company ownership transferred to user ${nextOwner.user_id}`);
                } else {
                    // No other members — dissolve the company
                    await runQuery('UPDATE tasks SET company_id = NULL, org_id = NULL WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM company_members WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM invitations    WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM join_requests  WHERE company_id = ?', [user.company_id]);
                    await runQuery('DELETE FROM companies      WHERE id = ?',         [user.company_id]);
                    console.log(`  ↳ Company ${user.company_id} dissolved`);
                }
            }

            await runQuery('DELETE FROM company_members WHERE user_id = ?', [userId]);
        }

        // ── 3. Remove outstanding invitations / join requests ─────────────────
        await runQuery('DELETE FROM invitations  WHERE invited_by = ?', [userId]).catch(() => {});
        await runQuery('DELETE FROM join_requests WHERE user_id  = ?', [userId]);

        // ── 4. Remove task_reports (personal submissions, not shared history) ──
        await runQuery('DELETE FROM task_reports WHERE submitted_by = ?', [userId]).catch(() => {});

        // ── 5. Remove from profile_data so it won't be restored on re-signup ──
        await runQuery('DELETE FROM profile_data WHERE firebase_uid = ?', [user.firebase_uid]).catch(() => {});

        // ── 6. Anonymize the user row — do NOT hard-delete ────────────────────
        // Keeping the row means all FK references on tasks stay valid.
        // firebase_uid + email cleared → account permanently unlinked.
        // full_name + avatar_url intentionally preserved (work history).
        await runQuery(
            `UPDATE users SET
                firebase_uid  = NULL,
                email         = ?,
                password_hash = NULL,
                is_active     = 0,
                company_id    = NULL,
                org_id        = NULL,
                last_seen     = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [`deleted_user_${userId}@syncline.local`, userId]
        );

        console.log(`  ✅ User ${userId} anonymized successfully`);

        // ── 7. Broadcast (best-effort) ────────────────────────────────────────
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