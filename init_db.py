import sqlite3

# Read schema
with open('api/src/config/schema.sql', 'r') as f:
    schema = f.read()

# Create database with schema
conn = sqlite3.connect('database/syncline.db')
conn.executescript(schema)
conn.commit()
conn.close()

print("? Database created with all tables!")
