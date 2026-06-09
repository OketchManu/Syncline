// api/src/utils/accountType.js
const { runQuery } = require('../config/database');

function resolveAccountType(user) {
    if (!user) return 'personal';
    const stored = user.account_type || user.accountType;
    if (stored === 'company') return 'company';
    // Active company membership (owner or member) uses the company workspace
    if (user.company_id || user.companyId) return 'company';
    return 'personal';
}

async function repairAccountType(user) {
    if (!user?.id) return user;
    const resolved = resolveAccountType(user);
    if (user.account_type !== resolved) {
        await runQuery(
            `UPDATE users SET account_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [resolved, user.id]
        );
        user.account_type = resolved;
        console.log(`✅ Repaired account_type → ${resolved} for user id ${user.id}`);
    }
    const firebaseUid = user.firebase_uid || user.firebaseUid;
    if (firebaseUid) {
        await runQuery(
            `INSERT INTO profile_data (firebase_uid, full_name, avatar_url, account_type, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(firebase_uid) DO UPDATE SET
                 account_type = excluded.account_type,
                 updated_at = CURRENT_TIMESTAMP`,
            [
                firebaseUid,
                user.full_name || user.fullName || 'User',
                user.avatar_url || user.avatar || null,
                resolved,
            ]
        ).catch(() => {});
    }
    return user;
}

function sanitizeAccountFields(user) {
    if (!user) return null;
    const accountType = resolveAccountType(user);
    return {
        ...user,
        accountType,
        account_type: accountType,
        companyId:  user.company_id ?? user.companyId ?? null,
        company_id: user.company_id ?? user.companyId ?? null,
    };
}

module.exports = { resolveAccountType, repairAccountType, sanitizeAccountFields };
