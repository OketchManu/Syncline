// api/test-server-running.js
const http = require('http');

console.log('🔍 Checking if Syncline API server is running...\n');

const req = http.get('http://localhost:3001/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Server is RUNNING on http://localhost:3001');
            console.log(`   Response: ${data}\n`);
            console.log('You can now run other tests or use the app!\n');
        } else {
            console.log(`⚠️  Server responded with status: ${res.statusCode}\n`);
        }
        process.exit(0);
    });
});

req.on('error', (error) => {
    console.log('❌ Server is NOT RUNNING');
    console.log(`   Error: ${error.message}\n`);
    console.log('Start the server with: npm start\n');
    process.exit(1);
});

req.end();