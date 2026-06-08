// api/src/routes/users.routes.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { runQuery, getOne, getAll }       = require('../config/database');
const {
    findById, getAllUsers, updateProfile,
    changePassword, getOnlineUsers, verifyPassword,
} = require('../models/User');

router.use(authenticateToken);

// ── Multer (graceful no-op if not installed) ──────────────────────────────────
let upload = { single: () => (_req, _res, next) => next() };
try {
    const multer    = require('multer');
    const fs        = require('fs');
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    upload = multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, uploadDir),
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname) || '.jpg';
                cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
            },
        }),
        limits:     { fileSize: 3 * 1024 * 1024 },
        fileFilter: (_req, file, cb) =>
            file.mimetype.startsWith('image/')
                ? cb(null, true)
                : cb(new Error('Only image files are allowed')),
    });
    console.log('✅ Avatar uploads enabled');
} catch (_) {
    console.log('ℹ️  multer not installed — avatar upload disabled');
}

const { sanitizeUser } = require('../utils/accountType');

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json({ users: users.map(sanitizeUser), count: users.length });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Failed to get users.' });
    }
});

// ── GET /api/users/online ─────────────────────────────────────────────────────
router.get('/online', async (req, res) => {
    try {
        const users = await getOnlineUsers();
        res.json({ users: users.map(sanitizeUser), count: users.length });
    } catch (err) {
        console.error('Get online users error:', err);
        res.status(500).json({ error: 'Failed to get online users.' });
    }
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
    try {
        const user = await findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Failed to get profile.' });
    }
});

// ── Profile update handler (shared between PUT and PATCH) ─────────────────────
async function handleProfileUpdate(req, res) {
    try {
        const userId     = req.user.id;
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
            return res.status(400).json({ error: 'Nothing to update — provide fullName or avatar.' });
        }

        await updateProfile(userId, { fullName, avatarUrl, removeAvatar });

        // Also persist to profile_data so name/avatar survive DB wipes on Render
        if (fullName !== undefined || avatarUrl !== undefined || removeAvatar) {
            const nameToSave   = fullName   !== undefined ? fullName   : undefined;
            const avatarToSave = removeAvatar ? null : (avatarUrl !== undefined ? avatarUrl : undefined);
            const updates = [];
            const vals    = [];
            if (nameToSave   !== undefined) { updates.push('full_name = ?');   vals.push(nameToSave); }
            if (avatarToSave !== undefined) { updates.push('avatar_url = ?');  vals.push(avatarToSave); }
            if (updates.length > 0 && req.user.firebaseUid) {
                updates.push('updated_at = CURRENT_TIMESTAMP');
                vals.push(req.user.firebaseUid);
                await runQuery(
                    `UPDATE profile_data SET ${updates.join(', ')} WHERE firebase_uid = ?`, vals
                ).catch(() => {});
            }
        }

        const updated = await findById(userId);

        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:profile_updated', {
                    userId, device: req.body.device || 'Unknown device',
                });
            }
        } catch (_) {}

        res.json({ message: 'Profile updated successfully.', user: sanitizeUser(updated) });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: err.message || 'Failed to update profile.' });
    }
}

// ── PUT /api/users/me  (original) ────────────────────────────────────────────
router.put('/me', upload.single('avatar'), handleProfileUpdate);

// ── PATCH /api/users/me  (alias — frontend may call either) ──────────────────
router.patch('/me', upload.single('avatar'), handleProfileUpdate);

// ── PUT /api/users/me/password ────────────────────────────────────────────────
router.put('/me/password', async (req, res) => {
    try {
        const { currentPassword, newPassword, device } = req.body;

        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
        if (newPassword.length < 8)
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });

        const row = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!row) return res.status(404).json({ error: 'User not found.' });

        if (row.password_hash) {
            const valid = await verifyPassword(currentPassword, row.password_hash);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        await changePassword(req.user.id, newPassword);

        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(req.user.id, 'user:password_changed', {
                    userId: req.user.id, device: device || 'Unknown device',
                });
            }
        } catch (_) {}

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: err.message || 'Failed to change password.' });
    }
});

// ── PATCH /api/users/me/password (alias) ─────────────────────────────────────
router.patch('/me/password', async (req, res) => {
    try {
        const { currentPassword, newPassword, device } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
        if (newPassword.length < 8)
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });

        const row = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (!row) return res.status(404).json({ error: 'User not found.' });

        if (row.password_hash) {
            const valid = await verifyPassword(currentPassword, row.password_hash);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        await changePassword(req.user.id, newPassword);

        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(req.user.id, 'user:password_changed', { userId: req.user.id, device: device || 'Unknown' });
            }
        } catch (_) {}

        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: err.message || 'Failed to change password.' });
    }
});

// ── DELETE /api/users/me ──────────────────────────────────────────────────────
// Anonymizes the DB row (does NOT hard-delete to preserve FK refs on tasks).
// The Firebase Auth account is deleted via DELETE /api/auth/delete-firebase-user.
router.delete('/me', async (req, res) => {
    const userId = req.user.id;
    if (!userId || isNaN(Number(userId))) {
        return res.status(400).json({ error: 'Invalid user session. Please log in again.' });
    }

    try {
        const device = req.body?.device || 'Unknown device';
        const user   = await getOne('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found or already deleted.' });
        }
        if (user.email?.startsWith('deleted_user_') && user.email?.endsWith('@syncline.local')) {
            return res.status(404).json({ error: 'User not found or already deleted.' });
        }

        console.log(`🗑️  Deleting account for user ${userId} (${user.email})`);

        // Nullify task references (do NOT delete tasks — preserve work history)
        await runQuery('UPDATE tasks SET created_by  = NULL WHERE created_by  = ?', [userId]).catch(() => {});
        await runQuery('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [userId]).catch(() => {});

        // Handle company ownership transfer
        if (user.company_id) {
            const company = await getOne('SELECT * FROM companies WHERE id = ?', [user.company_id]).catch(() => null);
            if (company && company.owner_id === userId) {
                const next = await getOne(
                    `SELECT user_id FROM company_members
                     WHERE company_id = ? AND user_id != ? AND status = 'active'
                     ORDER BY joined_at ASC LIMIT 1`,
                    [user.company_id, userId]
                ).catch(() => null);

                if (next) {
                    await runQuery('UPDATE companies SET owner_id = ? WHERE id = ?', [next.user_id, user.company_id]);
                    await runQuery(`UPDATE company_members SET role = 'owner' WHERE company_id = ? AND user_id = ?`, [user.company_id, next.user_id]);
                    console.log(`  ↳ Company ownership transferred to user ${next.user_id}`);
                } else {
                    // No other members — dissolve company
                    await runQuery('UPDATE tasks SET company_id = NULL, org_id = NULL WHERE company_id = ?', [user.company_id]).catch(() => {});
                    await runQuery('DELETE FROM company_members WHERE company_id = ?', [user.company_id]).catch(() => {});
                    await runQuery('DELETE FROM join_requests   WHERE company_id = ?', [user.company_id]).catch(() => {});
                    await runQuery('DELETE FROM team_invitations WHERE company_id = ?', [user.company_id]).catch(() => {});
                    await runQuery('DELETE FROM companies        WHERE id = ?',         [user.company_id]).catch(() => {});
                    console.log(`  ↳ Company ${user.company_id} dissolved`);
                }
            }
            await runQuery('DELETE FROM company_members WHERE user_id = ?', [userId]).catch(() => {});
        }

        await runQuery('DELETE FROM join_requests   WHERE user_id   = ?', [userId]).catch(() => {});
        await runQuery('DELETE FROM team_invitations WHERE invited_by = ?', [userId]).catch(() => {});
        await runQuery('DELETE FROM task_reports    WHERE submitted_by = ?', [userId]).catch(() => {});

        if (user.firebase_uid) {
            await runQuery('DELETE FROM profile_data WHERE firebase_uid = ?', [user.firebase_uid]).catch(() => {});
        }

        // Anonymize — preserves the row for FK integrity on tasks
        await runQuery(
            `UPDATE users SET
                firebase_uid  = NULL,
                email         = ?,
                password_hash = NULL,
                is_active     = 0,
                company_id    = NULL,
                org_id        = NULL,
                last_seen     = CURRENT_TIMESTAMP,
                updated_at    = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [`deleted_user_${userId}@syncline.local`, userId]
        );

        console.log(`  ✅ User ${userId} anonymized successfully`);

        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:account_deleted', { userId, device });
            }
        } catch (_) {}

        return res.json({ message: 'Account permanently deleted.' });

    } catch (err) {
        console.error('❌ DELETE /users/me error:', err);
        return res.status(500).json({ error: err.message || 'Failed to delete account.' });
    }
});

// ── GET /api/users/:id (admin/manager only) ───────────────────────────────────
router.get('/:id', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const user = await findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to get user.' });
    }
});

module.exports = router;