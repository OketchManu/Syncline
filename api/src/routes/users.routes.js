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

// ── Multer (optional — graceful no-op if not installed) ──────────────────────
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
} catch (_) {
    console.log('ℹ️  multer not installed — avatar upload disabled');
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
router.put('/me', upload.single('avatar'), async (req, res) => {
    try {
        const userId      = req.user.id;
        let avatarUrl     = undefined;
        let removeAvatar  = false;

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
            return res.status(400).json({
                error: 'Nothing to update — provide fullName or avatar',
            });
        }

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

        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        if (newPassword.length < 8)
            return res.status(400).json({ error: 'New password must be at least 8 characters' });

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
// Permanently anonymizes the user's DB row and cleans up all related data.
// Does NOT hard-delete the row so that FK references on tasks remain valid.
// The Firebase Auth account is deleted separately via DELETE /api/auth/delete-firebase-user.
router.delete('/me', async (req, res) => {
    const userId = req.user.id;

    // Guard: req.user.id must be a valid number
    if (!userId || isNaN(Number(userId))) {
        console.error('❌ DELETE /users/me: invalid userId on token:', userId);
        return res.status(400).json({ error: 'Invalid user session. Please log in again.' });
    }

    try {
        const device = req.body?.device || 'Unknown device';

        // Look up directly from DB (not from model) to avoid any caching issues
        const user = await getOne('SELECT * FROM users WHERE id = ?', [userId]);

        if (!user) {
            console.warn(`⚠️  DELETE /users/me: user ${userId} not found — may already be deleted`);
            return res.status(404).json({ error: 'User not found or already deleted.' });
        }

        // Block double-deletion
        if (
            user.email &&
            user.email.startsWith('deleted_user_') &&
            user.email.endsWith('@syncline.local')
        ) {
            console.warn(`⚠️  DELETE /users/me: user ${userId} already anonymized`);
            return res.status(404).json({ error: 'User not found or already deleted.' });
        }

        console.log(`🗑️  Deleting account for user ${userId} (${user.email})`);

        // ── 1. Nullify task references (UPDATE only — never DELETE on tasks) ──
        await runQuery(
            'UPDATE tasks SET created_by  = NULL WHERE created_by  = ?', [userId]
        ).catch(e => console.warn('  ⚠️  tasks created_by nullify:', e.message));

        await runQuery(
            'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [userId]
        ).catch(e => console.warn('  ⚠️  tasks assignee_id nullify:', e.message));

        // ── 2. Handle company ownership ───────────────────────────────────────
        if (user.company_id) {
            const company = await getOne(
                'SELECT * FROM companies WHERE id = ?', [user.company_id]
            ).catch(() => null);

            if (company && company.owner_id === userId) {
                const nextOwner = await getOne(
                    `SELECT user_id FROM company_members
                     WHERE company_id = ? AND user_id != ? AND status = 'active'
                     ORDER BY joined_at ASC LIMIT 1`,
                    [user.company_id, userId]
                ).catch(() => null);

                if (nextOwner) {
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
                    // No other members — dissolve the company entirely
                    await runQuery(
                        'UPDATE tasks SET company_id = NULL, org_id = NULL WHERE company_id = ?',
                        [user.company_id]
                    ).catch(() => {});
                    await runQuery(
                        'DELETE FROM company_members WHERE company_id = ?', [user.company_id]
                    ).catch(() => {});
                    await runQuery(
                        'DELETE FROM invitations   WHERE company_id = ?', [user.company_id]
                    ).catch(() => {});
                    await runQuery(
                        'DELETE FROM join_requests WHERE company_id = ?', [user.company_id]
                    ).catch(() => {});
                    await runQuery(
                        'DELETE FROM companies WHERE id = ?', [user.company_id]
                    ).catch(() => {});
                    console.log(`  ↳ Company ${user.company_id} dissolved`);
                }
            }

            // Remove from company_members regardless
            await runQuery(
                'DELETE FROM company_members WHERE user_id = ?', [userId]
            ).catch(() => {});
        }

        // ── 3. Remove outstanding invitations / join requests ─────────────────
        await runQuery(
            'DELETE FROM invitations   WHERE invited_by = ?', [userId]
        ).catch(() => {});
        await runQuery(
            'DELETE FROM join_requests WHERE user_id = ?', [userId]
        ).catch(() => {});

        // ── 4. Remove personal task_reports ───────────────────────────────────
        await runQuery(
            'DELETE FROM task_reports WHERE submitted_by = ?', [userId]
        ).catch(() => {});

        // ── 5. Remove from profile_data so it won't be restored on re-signup ──
        if (user.firebase_uid) {
            await runQuery(
                'DELETE FROM profile_data WHERE firebase_uid = ?', [user.firebase_uid]
            ).catch(() => {});
        }

        // ── 6. Anonymize the user row ─────────────────────────────────────────
        // Hard-deleting the row breaks FK references in tasks.
        // Anonymizing keeps the row but severs all identity links.
        // The deleted_user_N@syncline.local sentinel blocks re-entry in
        // /me and firebase-sync routes.
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

        // ── 7. Broadcast (best-effort) ────────────────────────────────────────
        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:account_deleted', { userId, device });
            }
        } catch (_) {}

        return res.json({ message: 'Account permanently deleted.' });

    } catch (err) {
        console.error('❌ DELETE /users/me error:', err);
        return res.status(500).json({
            error:   err.message || 'Failed to delete account.',
            details: err.message,
        });
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