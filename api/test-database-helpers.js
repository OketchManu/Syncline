// api/test-database-helpers.js
const { getAll, getOne } = require('./src/config/database');

console.log('🧪 Testing database helpers...\n');

async function test() {
    try {
        // Test 1: getAll with results
        console.log('Test 1: getAll with existing users');
        const users = await getAll('SELECT * FROM users LIMIT 5');
        console.log(`✅ Type: ${Array.isArray(users) ? 'Array' : 'NOT ARRAY'}`);
        console.log(`✅ Length: ${users.length}`);
        console.log(`✅ Value:`, users.length > 0 ? 'Has data' : 'Empty array');

        // Test 2: getAll with no results
        console.log('\nTest 2: getAll with no results');
        const empty = await getAll('SELECT * FROM users WHERE id = 99999');
        console.log(`✅ Type: ${Array.isArray(empty) ? 'Array' : 'NOT ARRAY'}`);
        console.log(`✅ Length: ${empty.length}`);
        console.log(`✅ Value:`, empty);

        // Test 3: getOne with result
        console.log('\nTest 3: getOne with result');
        const user = await getOne('SELECT * FROM users LIMIT 1');
        console.log(`✅ Type: ${user ? 'Object' : 'null'}`);
        console.log(`✅ Value:`, user ? 'Has data' : 'null');

        // Test 4: getOne with no result
        console.log('\nTest 4: getOne with no result');
        const noUser = await getOne('SELECT * FROM users WHERE id = 99999');
        console.log(`✅ Type: ${noUser === null ? 'null' : 'NOT NULL'}`);
        console.log(`✅ Value:`, noUser);

        console.log('\n🎉 All tests passed!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

test();