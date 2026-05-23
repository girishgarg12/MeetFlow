import sqlite3

conn = sqlite3.connect("MeetFlow.db")
cursor = conn.cursor()

print("--- MEETINGS ---")
cursor.execute("SELECT id, title, host_name, host_id, meeting_type, scheduled_at, duration, is_active, created_at FROM meetings")
for row in cursor.fetchall():
    print(row)

print("\n--- PARTICIPANTS ---")
cursor.execute("SELECT id, meeting_id, name, user_id, is_host, joined_at, left_at FROM participants")
for row in cursor.fetchall():
    print(row)

print("\n--- USERS ---")
cursor.execute("SELECT id, username, email FROM users")
for row in cursor.fetchall():
    print(row)

conn.close()
