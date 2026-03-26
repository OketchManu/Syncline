// api/src/config/backfill.js
const { getAll, runQuery } = require('./database');
const crypto = require('crypto');

function generateInviteCode() {
    return 'SYNC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function backfillInviteCodes() {
    try {
        console.log('🔄 Checking for companies without invite codes...');
        const companies = await getAll('SELECT id FROM companies WHERE invite_code IS NULL');
        
        if (companies.length === 0) {
            console.log('✅ All companies have invite codes');
            return;
        }

        for (const c of companies) {
            const code = generateInviteCode();
            await runQuery('UPDATE companies SET invite_code = ? WHERE id = ?', [code, c.id]);
            console.log(`✅ Back-filled invite code for company ${c.id}: ${code}`);
        }
    } catch (err) {
        console.error('⚠️  Backfill invite codes error (non-critical):', err.message);
    }
}

module.exports = { backfillInviteCodes };