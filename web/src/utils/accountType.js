// web/src/utils/accountType.js
// Single source of truth for company vs personal account resolution on the client.

export function resolveAccountType(user) {
    if (!user) return 'personal';
    const raw = user.accountType || user.account_type;
    if (raw === 'company') return 'company';
    if (user.companyId || user.company_id) return 'company';
    return 'personal';
}

export function isCompanyAccount(user) {
    return resolveAccountType(user) === 'company';
}

export function normaliseAccountFields(user) {
    if (!user) return null;
    const accountType = resolveAccountType(user);
    const company     = user.company || null;
    const companyId   = user.companyId ?? user.company_id ?? company?.id ?? null;
    return {
        ...user,
        accountType,
        account_type: accountType,
        companyId,
        company_id:  companyId,
        companyName: user.companyName ?? user.company_name ?? company?.name ?? null,
        company,
    };
}
