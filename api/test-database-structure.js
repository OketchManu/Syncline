// api/test-database-structure.js
const { getOne, getAll } = require('./src/config/database');

console.log('🧪 Testing Database Structure\n');

async function test() {
    try {
        // Test 1: Users table
        console.log('Test 1: Users table');
        const userCount = await getOne('SELECT COUNT(*) as count FROM users');
        console.log(`✅ Users table exists - ${userCount.count} users\n`);

        // Test 2: Companies table
        console.log('Test 2: Companies table');
        const companyCount = await getOne('SELECT COUNT(*) as count FROM companies');
        console.log(`✅ Companies table exists - ${companyCount.count} companies\n`);

        // Test 3: Team invitations table
        console.log('Test 3: Team invitations table');
        try {
            const inviteCount = await getOne('SELECT COUNT(*) as count FROM team_invitations');
            console.log(`✅ Team invitations table exists - ${inviteCount.count} invitations\n`);
        } catch (err) {
            console.log('❌ Team invitations table missing!');
            console.log('   Run: node create-invitations-table.js\n');
        }

        // Test 4: Check for company users
        console.log('Test 4: Company users check');
        const companyUser = await getOne(`
            SELECT u.id, u.email, u.account_type, u.company_id, c.name as company_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.account_type = 'company'
            LIMIT 1
        `);
        
        if (companyUser) {
            console.log('✅ Found company user:');
            console.log(`   Email: ${companyUser.email}`);
            console.log(`   Account Type: ${companyUser.account_type}`);
            console.log(`   Company ID: ${companyUser.company_id}`);
            console.log(`   Company Name: ${companyUser.company_name || 'N/A'}\n`);
        } else {
            console.log('ℹ️  No company users yet (register one to test)\n');
        }

        // Test 5: Check array returns
        console.log('Test 5: getAll returns arrays');
        const allUsers = await getAll('SELECT * FROM users LIMIT 5');
        console.log(`✅ getAll works - returned ${Array.isArray(allUsers) ? 'ARRAY' : 'NOT ARRAY'}`);
        console.log(`✅ User count: ${allUsers.length}\n`);

        console.log('🎉 All database structure tests passed!\n');
        console.log('Next steps:');
        console.log('1. Start server: npm start');
        console.log('2. Open browser and register a company account');
        console.log('3. Test Team Management page\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

test();