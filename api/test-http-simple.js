// api/test-http-simple.js
const http = require('http');

const PORT = 3001;

function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function testAPI() {
    console.log('🧪 Testing Syncline API\n');
    console.log('Make sure server is running on port 3001!\n');

    try {
        // Test 1: Health check
        console.log('Test 1: Health check');
        const health = await makeRequest({
            hostname: 'localhost',
            port: PORT,
            path: '/health',
            method: 'GET'
        });
        
        if (health.status === 200) {
            console.log('✅ Server is running');
            console.log(`   Status: ${health.data.status}\n`);
        } else {
            console.log('❌ Server health check failed\n');
            process.exit(1);
        }

        // Test 2: Register company account
        console.log('Test 2: Register company account');
        const registerEmail = `test-${Date.now()}@example.com`;
        
        const register = await makeRequest({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            email: registerEmail,
            password: 'password123',
            fullName: 'Test Company Owner',
            accountType: 'company',
            companyName: 'Test Corporation',
            industry: 'Technology'
        });

        if (register.status === 201 || register.status === 200) {
            console.log('✅ Registration successful');
            console.log(`   Email: ${register.data.user?.email}`);
            console.log(`   Account Type: ${register.data.user?.accountType}`);
            console.log(`   Company ID: ${register.data.user?.companyId}`);
            console.log(`   Company Name: ${register.data.user?.company?.name}\n`);
            
            const token = register.data.accessToken;

            // Test 3: Get /me
            console.log('Test 3: Get current user (/me)');
            const me = await makeRequest({
                hostname: 'localhost',
                port: PORT,
                path: '/api/auth/me',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (me.status === 200) {
                console.log('✅ /me endpoint works');
                console.log(`   Email: ${me.data.user?.email}`);
                console.log(`   Company ID: ${me.data.user?.companyId}\n`);
            } else {
                console.log('❌ /me endpoint failed\n');
            }

            // Test 4: Get team
            console.log('Test 4: Get team members');
            const team = await makeRequest({
                hostname: 'localhost',
                port: PORT,
                path: '/api/company/team',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (team.status === 200) {
                console.log('✅ Team endpoint works');
                console.log(`   Members is array: ${Array.isArray(team.data.members) ? 'YES ✅' : 'NO ❌'}`);
                console.log(`   Member count: ${team.data.members?.length || 0}\n`);
            } else {
                console.log('❌ Team endpoint failed');
                console.log(`   Error: ${team.data.error}\n`);
            }

        } else if (register.status === 409) {
            console.log('⚠️  User already exists - try with different email\n');
        } else {
            console.log('❌ Registration failed');
            console.log(`   Status: ${register.status}`);
            console.log(`   Error: ${register.data.error}\n`);
        }

        console.log('🎉 All tests completed!\n');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.log('\n💡 Make sure the server is running: npm start\n');
    }
}

testAPI();