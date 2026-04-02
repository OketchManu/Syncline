// api/src/models/User.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { runQuery, getOne, getAll } = require('../config/database');

const SALT_ROUNDS = 10;

async function createUser(email, password, fullName, role = 'member', accountType = 'personal') {
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
        `SELECT id, email, full_name, role, account_type, company_id, org_id,
                is_active, last_seen, created_at, avatar_url, firebase_uid
         FROM users WHERE id = ?`,
        [id]
    );
}

async function getAllUsers() {
    return await getAll(
        `SELECT id, email, full_name, role, account_type, company_id, org_id,
                is_active, last_seen, created_at, avatar_url, firebase_uid
         FROM users ORDER BY created_at DESC`
    );
}

async function verifyPassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
}

async function updateLastSeen(userId) {
    await runQuery('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

async function updateUser(userId, updates) {
    const allowedFields = [
        'full_name', 'email', 'role', 'is_active',
        'avatar_url', 'account_type', 'company_id', 'org_id',
    ];
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

// ── updateProfile ─────────────────────────────────────────────────────────────
// Updates name and/or avatar on the users row AND mirrors the change into
// the profile_data table (keyed by firebase_uid).
//
// profile_data survives database wipes on Render because firebase-sync reads
// from it when recreating a user row — so the user's custom name and avatar
// are automatically restored after every redeploy without any extra action.
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

    // 1. Update the main users row
    await runQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    // 2. Mirror into profile_data so it survives a DB wipe on Render
    //    Fetch firebase_uid for this user then upsert profile_data
    try {
        const user = await getOne('SELECT firebase_uid, full_name, avatar_url FROM users WHERE id = ?', [userId]);
        if (user && user.firebase_uid) {
            // Build what we want to store — merge with current values
            const storedName   = (fullName !== undefined && fullName !== null)
                ? String(fullName).trim()
                : user.full_name;
            const storedAvatar = removeAvatar === true
                ? null
                : (avatarUrl !== undefined && avatarUrl !== null ? avatarUrl : user.avatar_url);

            await runQuery(
                `INSERT INTO profile_data (firebase_uid, full_name, avatar_url, updated_at)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(firebase_uid) DO UPDATE SET
                     full_name  = excluded.full_name,
                     avatar_url = excluded.avatar_url,
                     updated_at = CURRENT_TIMESTAMP`,
                [user.firebase_uid, storedName, storedAvatar]
            );
        }
    } catch (profileErr) {
        // Non-fatal — profile_data is a best-effort persistence layer
        console.warn('⚠️  Could not update profile_data:', profileErr.message);
    }
}

async function changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

// ── deleteUser ────────────────────────────────────────────────────────────────
// NOTE: users.routes.js DELETE /me no longer calls this function.
// The route handles its own anonymization inline so it never touches tasks
// with a DELETE (which would trigger the ghost FK trigger on tasks_old).
// This function is kept for any admin tooling that may call it, but it now
// uses safe UPDATE-based nullification that doesn't trigger FK ghosts.
async function deleteUser(userId) {
    // 1. Remove from company_members
    await runQuery('DELETE FROM company_members WHERE user_id = ?', [userId]).catch(() => {});
    // 2. Remove join requests
    await runQuery('DELETE FROM join_requests WHERE user_id = ?', [userId]).catch(() => {});
    // 3. Nullify task references (UPDATE, not DELETE — avoids FK ghost triggers)
    await runQuery('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [userId]).catch(() => {});
    await runQuery('UPDATE tasks SET created_by  = NULL WHERE created_by  = ?', [userId]).catch(() => {});
    // 4. Delete task reports
    await runQuery('DELETE FROM task_reports WHERE submitted_by = ?', [userId]).catch(() => {});
    // 5. Clear company ownership
    await runQuery('UPDATE companies SET owner_id = NULL WHERE owner_id = ?', [userId]).catch(() => {});
    // 6. Remove from profile_data
    await runQuery('DELETE FROM profile_data WHERE firebase_uid = (SELECT firebase_uid FROM users WHERE id = ?)', [userId]).catch(() => {});
    // 7. Delete the user row
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

async function createCompanyForUser(userId, companyName) {
    const prefix = (companyName || 'SYNC')
        .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
    const inviteCode = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const result = await runQuery(
        `INSERT INTO companies (name, owner_id, invite_code, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [companyName, userId, inviteCode]
    );
    const companyId = result.id;

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
    createCompanyForUser,
};