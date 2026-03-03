import sqlite3

print("📊 Starting database migration...")

conn = sqlite3.connect('syncline.db')
cursor = conn.cursor()

with open('schema-company.sql', 'r', encoding='utf-8') as f:
    schema = f.read()

try:
    cursor.executescript(schema)
    conn.commit()
    print("✅ Database migrated successfully!")
    print("✅ Company features are now available!")
except Exception as e:
    print(f"❌ Migration failed: {e}")

conn.close()
