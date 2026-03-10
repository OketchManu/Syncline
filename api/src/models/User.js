// api/src/models/User.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runQuery, getOne, getAll } = require('../config/database');

const SALT_ROUNDS = 10;

async function createUser(email, password, fullName, role = 'member', accountType = 'individual') {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await runQuery(
        `INSERT INTO users (email, password_hash, full_name, role, account_type) VALUES (?, ?, ?, ?, ?)`,
        [email, passwordHash, fullName, role, accountType]
    );
    return result.id;
}

async function findByEmail(email) {
    return await getOne('SELECT * FROM users WHERE email = ?', [email]);
}

async function findById(id) {
    return await getOne(
        `SELECT id, email, full_name, role, account_type, company_id, is_active, last_seen, created_at, avatar_url
         FROM users WHERE id = ?`,
        [id]
    );
}

async function getAllUsers() {
    return await getAll(
        `SELECT id, email, full_name, role, account_type, company_id, is_active, last_seen, created_at, avatar_url
         FROM users ORDER BY created_at DESC`
    );
}

async function verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
}

async function updateLastSeen(userId) {
    await runQuery('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

async function updateUser(userId, updates) {
    const allowedFields = ['full_name', 'email', 'role', 'is_active', 'avatar_url', 'account_type', 'company_id'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) throw new Error('No valid fields to update');
    values.push(userId);
    await runQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function updateProfile(userId, { fullName, avatarUrl, removeAvatar } = {}) {
    const fields = [];
    const values = [];

    if (fullName !== undefined && fullName !== null) {
        const trimmed = String(fullName).trim();
        if (!trimmed) throw new Error('Name cannot be empty');
        fields.push('full_name = ?');
        values.push(trimmed);
    }

    if (removeAvatar === true) {
        fields.push('avatar_url = ?');
        values.push(null);
    } else if (avatarUrl !== undefined && avatarUrl !== null) {
        fields.push('avatar_url = ?');
        values.push(avatarUrl);
    }

    if (fields.length === 0) throw new Error('Nothing to update');
    values.push(userId);
    await runQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function deleteUser(userId) {
    await runQuery('DELETE FROM users WHERE id = ?', [userId]);
}

async function getOnlineUsers() {
    return await getAll(
        `SELECT id, email, full_name, role, account_type, last_seen, avatar_url
         FROM users
         WHERE last_seen > datetime('now', '-5 minutes') AND is_active = 1
         ORDER BY last_seen DESC`
    );
}

/**
 * Create a company and link the user to it as admin (company owner).
 * Uses 'admin' role to stay within the existing CHECK constraint.
 * ── CHANGED: generates invite_code at creation time, sets account_type='company'
 */
async function createCompanyForUser(userId, companyName) {
    // Generate a unique invite code for this company
    const prefix = (companyName || 'SYNC')
        .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
    const inviteCode = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create the company record with the invite code already set
    const result = await runQuery(
        `INSERT INTO companies (name, owner_id, invite_code, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [companyName, userId, inviteCode]
    );
    const companyId = result.id;

    // Link user to company — admin role, and mark account_type as 'company'
    await runQuery(
        `UPDATE users SET company_id = ?, role = 'admin', account_type = 'company' WHERE id = ?`,
        [companyId, userId]
    );

    return companyId;
}

module.exports = {
    createUser,
    findByEmail,
    findById,
    getAllUsers,
    verifyPassword,
    updateLastSeen,
    updateUser,
    updateProfile,
    changePassword,
    deleteUser,
    getOnlineUsers,
    createCompanyForUser
};