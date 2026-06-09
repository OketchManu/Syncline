// web/src/utils/accountType.js

export const resolveAccountType = (user) => {
    if (!user) return 'personal';
    const stored = user.accountType || user.account_type;
    if (stored === 'company') return 'company';
    if (user.companyId || user.company_id) return 'company';
    return 'personal';
};

export const isCompanyAccount = (user) => resolveAccountType(user) === 'company';

export const normaliseAccountFields = (user) => {
    if (!user) return null;
    const accountType = resolveAccountType(user);
    const companyId   = user.companyId ?? user.company_id ?? user.company?.id ?? null;
    return {
        ...user,
        accountType,
        account_type: accountType,
        companyId,
        company_id: companyId,
        companyName: user.companyName ?? user.company_name ?? user.company?.name ?? null,
    };
};
