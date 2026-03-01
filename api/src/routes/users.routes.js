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
            avatarUrl = `/uploads/avatars/${req.file.filename}`;
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
router.delete('/me', async (req, res) => {
    try {
        const userId = req.user.id;
        const device = req.body?.device || 'Unknown device';

        const user = await findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Delete user's tasks first (foreign-key safety)
        const { runQuery } = require('../config/database');
        await runQuery(
            'DELETE FROM tasks WHERE created_by = ? OR assignee_id = ?',
            [userId, userId]
        );

        // Notify other sessions before deletion
        try {
            const { broadcastToUser } = require('../config/websocket');
            if (typeof broadcastToUser === 'function') {
                broadcastToUser(userId, 'user:account_deleted', { userId, device });
            }
        } catch (_) {}

        await deleteUser(userId);

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