// api/migrate.js
// Simple migration script to add company account types
// Run with: node api/migrate.js

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        console.log('🔄 Connecting to database...');
        
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'syncline',
            multipleStatements: true
        });

        console.log('✅ Connected to database\n');

        // ========================================
        // STEP 1: Add account_type to users table
        // ========================================
        console.log('📝 Step 1: Adding account_type column...');
        
        try {
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN account_type VARCHAR(20) DEFAULT 'individual'
            `);
            console.log('✅ Added account_type column to users table');
        } catch (error) {
            if (error.message.includes('Duplicate column')) {
                console.log('ℹ️  account_type column already exists - skipping');
            } else {
                throw error;
            }
        }

        // ========================================
        // STEP 2: Update existing users
        // ========================================
        console.log('\n📝 Step 2: Setting existing users to individual...');
        
        const [updateResult] = await connection.execute(`
            UPDATE users 
            SET account_type = 'individual' 
            WHERE account_type IS NULL OR account_type = ''
        `);
        
        console.log(`✅ Updated ${updateResult.affectedRows} users to 'individual' account type`);

        // ========================================
        // STEP 3: Create companies table
        // ========================================
        console.log('\n📝 Step 3: Creating companies table...');
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                owner_id INT NOT NULL,
                invite_code VARCHAR(20) UNIQUE,
                industry VARCHAR(100),
                size VARCHAR(50),
                timezone VARCHAR(100) DEFAULT 'UTC',
                logo_url VARCHAR(500),
                website VARCHAR(500),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_owner (owner_id),
                INDEX idx_invite_code (invite_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        
        console.log('✅ Companies table created/verified');

        // ========================================
        // STEP 4: Add company_id foreign key if needed
        // ========================================
        console.log('\n📝 Step 4: Checking company_id column in users...');
        
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'company_id'
        `);

        if (columns.length === 0) {
            console.log('Adding company_id column to users...');
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN company_id INT NULL,
                ADD INDEX idx_company_id (company_id)
            `);
            console.log('✅ Added company_id column');
        } else {
            console.log('ℹ️  company_id column already exists');
        }

        // ========================================
        // VERIFICATION
        // ========================================
        console.log('\n📊 Verification:');
        console.log('═══════════════════════════════════════');

        // Check users table structure
        const [userColumns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'users'
            AND COLUMN_NAME IN ('account_type', 'company_id')
            ORDER BY ORDINAL_POSITION
        `);

        console.log('\n📋 Users table columns:');
        userColumns.forEach(col => {
            console.log(`  ✓ ${col.COLUMN_NAME}: ${col.DATA_TYPE} (default: ${col.COLUMN_DEFAULT || 'NULL'})`);
        });

        // Check companies table
        const [companiesCheck] = await connection.execute(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'companies'
        `);

        if (companiesCheck[0].count > 0) {
            console.log('\n📋 Companies table: ✅ EXISTS');
            
            const [companyCount] = await connection.execute('SELECT COUNT(*) as count FROM companies');
            console.log(`  Current companies: ${companyCount[0].count}`);
        }

        // Check users
        const [userStats] = await connection.execute(`
            SELECT 
                account_type,
                COUNT(*) as count
            FROM users
            GROUP BY account_type
        `);

        console.log('\n📋 User account types:');
        userStats.forEach(stat => {
            console.log(`  ${stat.account_type}: ${stat.count} users`);
        });

        console.log('\n═══════════════════════════════════════');
        console.log('🎉 Migration completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Replace Register.jsx');
        console.log('2. Replace AuthContext.jsx');
        console.log('3. Replace auth.js');
        console.log('4. Update Dashboard.jsx (4 small changes)');
        console.log('5. Test registration flow\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('👋 Database connection closed');
        }
    }
}

// Run the migration
runMigration();