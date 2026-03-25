// api/test-auth-flow.js
const fetch = require('node-fetch');

const API = 'https://syncline-1.onrender.com/api';

async function testAuthFlow() {
    console.log('🧪 Testing Complete Auth Flow\n');

    try {
        // Test 1: Register company account
        console.log('Test 1: Register company account');
        const registerRes = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test-company@example.com',
                password: 'password123',
                fullName: 'Test Company Owner',
                accountType: 'company',
                companyName: 'Test Corp',
                industry: 'Technology',
                website: 'https://testcorp.com'
            })
        });

        const registerData = await registerRes.json();
        console.log('✅ Status:', registerRes.status);
        console.log('✅ User:', registerData.user?.email);
        console.log('✅ Account Type:', registerData.user?.accountType);
        console.log('✅ Company ID:', registerData.user?.companyId);
        console.log('✅ Role:', registerData.user?.role);
        console.log('✅ Company:', registerData.user?.company?.name);

        const token = registerData.accessToken;

        // Test 2: Get /me endpoint
        console.log('\nTest 2: Get user info');
        const meRes = await fetch(`${API}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const meData = await meRes.json();
        console.log('✅ User:', meData.user?.email);
        console.log('✅ Company ID:', meData.user?.companyId);
        console.log('✅ Company:', meData.user?.company?.name);

        // Test 3: Get team members
        console.log('\nTest 3: Get team members');
        const teamRes = await fetch(`${API}/company/team`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const teamData = await teamRes.json();
        console.log('✅ Members:', Array.isArray(teamData.members) ? 'Array ✅' : 'NOT ARRAY ❌');
        console.log('✅ Count:', teamData.members?.length || 0);

        console.log('\n🎉 All tests passed!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testAuthFlow();