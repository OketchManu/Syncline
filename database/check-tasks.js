const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./syncline.db');

db.all("SELECT id, title, company_id, created_by FROM tasks", (err, tasks) => {
    console.log('📋 Task Analysis:\n');
    console.log('Total tasks:', tasks.length);
    
    const withCompany = tasks.filter(t => t.company_id !== null);
    const withoutCompany = tasks.filter(t => t.company_id === null);
    
    console.log('Tasks with company_id:', withCompany.length);
    console.log('Tasks without company_id:', withoutCompany.length);
    
    if (withoutCompany.length > 0) {
        console.log('\n⚠️  ISSUE FOUND: Your existing tasks don\'t have company_id set!');
        console.log('This means the new filtering code is hiding them.\n');
    }
    
    db.close();
});
