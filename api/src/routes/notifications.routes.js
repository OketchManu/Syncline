// api/src/routes/notifications.routes.js
const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAll, runQuery }    = require('../config/database');

router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req, res) => {
    try {
        const rows = await getAll(
            `SELECT id, type, title, message, is_read, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.user.id]
        );
        res.json({
            notifications: (rows || []).map(n => ({
                id:        n.id,
                type:      n.type || 'info',
                title:     n.title,
                message:   n.message,
                read:      n.is_read === 1 || n.is_read === true,
                createdAt: n.created_at,
            })),
        });
    } catch (err) {
        console.error('GET /notifications error:', err);
        res.status(500).json({ error: 'Failed to load notifications.' });
    }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
    try {
        await runQuery(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('PATCH /notifications/read-all error:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read.' });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
    try {
        await runQuery(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('PATCH /notifications/:id/read error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
});

module.exports = router;
