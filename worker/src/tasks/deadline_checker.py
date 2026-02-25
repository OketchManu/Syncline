# worker/src/tasks/deadline_checker.py
# Checks for overdue tasks and flags them automatically
# Version 2 - Fixed: skips already-flagged tasks, handles missing assignee

from datetime import datetime
from config.database import query, execute

def check_deadlines():
    """
    Find tasks that have passed their deadline and flag them.
    - Skips tasks already flagged (prevents duplicate notifications)
    - Skips completed tasks
    - Handles missing assignee gracefully
    """
    now = datetime.utcnow()
    flagged_count = 0

    try:
        # Only get tasks that:
        # 1. Have a deadline
        # 2. Deadline is in the past
        # 3. Are NOT already flagged
        # 4. Are not completed
        tasks = query("""
            SELECT id, title, deadline, assignee_id, status
            FROM tasks
            WHERE deadline IS NOT NULL
              AND deadline < ?
              AND flagged = 0
              AND status != 'completed'
            ORDER BY deadline ASC
        """, (now.isoformat(),))

        for task in tasks:
            task_id = task['id']
            title = task['title']
            deadline_str = task['deadline']
            assignee_id = task.get('assignee_id')  # May be None - that's okay

            # Calculate how overdue it is
            try:
                # Handle different date formats from SQLite
                for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S.%f'):
                    try:
                        deadline_dt = datetime.strptime(deadline_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    print(f"  ⚠️  Skipping '{title}' - unrecognized date format: {deadline_str}")
                    continue

                overdue_hours = (now - deadline_dt).total_seconds() / 3600

            except Exception as e:
                print(f"  ⚠️  Skipping '{title}' - date parse error: {e}")
                continue

            # Flag the task in the database
            execute("""
                UPDATE tasks
                SET flagged = 1,
                    flag_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (f"Overdue by {overdue_hours:.1f} hour(s)", task_id))

            print(f"  🚩 Flagged: \"{title}\" - Overdue by {overdue_hours:.1f} hour(s)")

            # Only try to notify if there IS an assignee
            if assignee_id:
                try:
                    send_overdue_notification(task_id, title, assignee_id, overdue_hours)
                except Exception as e:
                    print(f"  ⚠️  Notification failed for '{title}': {e}")
            else:
                print(f"  📝 No assignee on \"{title}\" - skipping notification")

            flagged_count += 1

    except Exception as e:
        print(f"  ❌ Deadline checker error: {e}")

    print(f"  ✅ Completed: Deadline Checker - {flagged_count} overdue task(s) flagged")
    return flagged_count


def send_overdue_notification(task_id, title, assignee_id, overdue_hours):
    """
    Attempt to send a notification via the Java notifier service.
    Fails gracefully if the notifier isn't running.
    """
    try:
        import requests
        from config.settings import load_env

        env = load_env()
        notifier_url = env.get('NOTIFIER_URL', 'http://localhost:8080')

        payload = {
            'type': 'deadline_missed',
            'task_id': task_id,
            'title': title,
            'assignee_id': assignee_id,
            'overdue_hours': round(overdue_hours, 1)
        }

        response = requests.post(
            f"{notifier_url}/notify",
            json=payload,
            timeout=3  # Don't hang if notifier is down
        )

        if response.status_code == 200:
            print(f"  📬 Notification sent for \"{title}\"")
        else:
            print(f"  ⚠️  Notifier returned {response.status_code} for \"{title}\"")

    except Exception as e:
        # Notifier probably isn't running yet - that's fine
        print(f"  📭 Notifier not available - skipping notification for \"{title}\"")