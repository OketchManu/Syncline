// api/src/models/User.js
// User database operations

const bcrypt = require('bcrypt');
const { runQuery, getOne, getAll } = require('../config/database');

const SALT_ROUNDS = 10;

/**
 * Create a new user
 */
async function createUser(email, password, fullName, role = 'member') {
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await runQuery(
        `INSERT INTO users (email, password_hash, full_name, role) 
         VALUES (?, ?, ?, ?)`,
        [email, passwordHash, fullName, role]
    );

    return result.id;
}

/**
 * Find user by email
 */
async function findByEmail(email) {
    return await getOne(
        'SELECT * FROM users WHERE email = ?',
        [email]
    );
}

/**
 * Find user by ID
 */
async function findById(id) {
    return await getOne(
        'SELECT id, email, full_name, role, is_active, last_seen, created_at FROM users WHERE id = ?',
        [id]
    );
}

/**
 * Get all users (excluding password hash)
 */
async function getAllUsers() {
    return await getAll(
        'SELECT id, email, full_name, role, is_active, last_seen, created_at FROM users ORDER BY created_at DESC'
    );
}

/**
 * Verify password
 */
async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Update user's last seen timestamp
 */
async function updateLastSeen(userId) {
    await runQuery(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
    );
}

/**
 * Update user details
 */
async function updateUser(userId, updates) {
    const allowedFields = ['full_name', 'email', 'role', 'is_active'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) {
        throw new Error('No valid fields to update');
    }

    values.push(userId);

    await runQuery(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
}

/**
 * Change user password
 */
async function changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await runQuery(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, userId]
    );
}

/**
 * Delete user
 */
async function deleteUser(userId) {
    await runQuery('DELETE FROM users WHERE id = ?', [userId]);
}

/**
 * Get online users (last seen within 5 minutes)
 */
async function getOnlineUsers() {
    return await getAll(
        `SELECT id, email, full_name, role, last_seen 
         FROM users 
         WHERE last_seen > datetime('now', '-5 minutes')
         AND is_active = 1
         ORDER BY last_seen DESC`
    );
}

module.exports = {
    createUser,
    findByEmail,
    findById,
    getAllUsers,
    verifyPassword,
    updateLastSeen,
    updateUser,
    changePassword,
    deleteUser,
    getOnlineUsers
};