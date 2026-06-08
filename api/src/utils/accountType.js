// api/src/utils/accountType.js
// Single source of truth for company vs personal account resolution.

const { runQuery } = require('../config/database');

function resolveAccountType(user) {
    if (!user) return 'personal';
    const raw = user.account_type || user.accountType;
    if (raw === 'company') return 'company';
    // Any user linked to a company workspace uses company features
    if (user.company_id || user.companyId) return 'company';
    return 'personal';
}

async function repairAccountType(user) {
    if (!user) return user;
    const resolved = resolveAccountType(user);
    if (user.account_type === resolved) return user;

    await runQuery(
        `UPDATE users SET account_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [resolved, user.id]
    );
    user.account_type = resolved;

    if (user.firebase_uid) {
        await runQuery(
            `UPDATE profile_data SET account_type = ?, updated_at = CURRENT_TIMESTAMP WHERE firebase_uid = ?`,
            [resolved, user.firebase_uid]
        ).catch(() => {});
    }

    console.log(`✅ Repaired account_type → ${resolved} for user ${user.id}`);
    return user;
}

function sanitizeUser(user) {
    if (!user) return null;
    const accountType = resolveAccountType(user);
    return {
        id:           user.id,
        email:        user.email,
        fullName:     user.full_name || user.fullName,
        full_name:    user.full_name || user.fullName,
        role:         user.role || 'member',
        accountType,
        account_type: accountType,
        companyId:    user.company_id || null,
        company_id:   user.company_id || null,
        orgId:        user.org_id || null,
        org_id:       user.org_id || null,
        avatar:       user.avatar_url || null,
        avatar_url:   user.avatar_url || null,
        firebaseUid:  user.firebase_uid || null,
        isActive:     user.is_active !== 0,
        createdAt:    user.created_at,
        lastSeen:     user.last_seen,
    };
}

module.exports = { resolveAccountType, repairAccountType, sanitizeUser };
