# worker/src/tasks/task_flagger.py
# Flags tasks that have been stuck (no updates) for too long
# Version 2 - Fixed: skips already-flagged tasks, handles missing assignee

from datetime import datetime, timedelta
from config.database import query, execute

def flag_stuck_tasks():
    """
    Find tasks that haven't been updated in a while and flag them.
    A task is considered "stuck" if:
    - It's in 'pending' or 'in_progress' status
    - It hasn't been updated in STUCK_HOURS hours
    - It is NOT already flagged
    """
    STUCK_HOURS = 48  # Flag tasks with no updates for 48 hours

    now = datetime.utcnow()
    flagged_count = 0
    cutoff_time = (now - timedelta(hours=STUCK_HOURS)).isoformat()

    try:
        # Only get tasks that:
        # 1. Are pending or in_progress (not completed/blocked)
        # 2. Haven't been updated since cutoff
        # 3. Are NOT already flagged
        tasks = query("""
            SELECT id, title, status, updated_at, assignee_id, created_at
            FROM tasks
            WHERE status IN ('pending', 'in_progress')
              AND updated_at < ?
              AND flagged = 0
            ORDER BY updated_at ASC
        """, (cutoff_time,))

        for task in tasks:
            task_id = task['id']
            title = task['title']
            status = task['status']
            updated_at_str = task['updated_at']
            assignee_id = task.get('assignee_id')  # May be None

            # Calculate how long it's been stuck
            try:
                for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S.%f'):
                    try:
                        updated_dt = datetime.strptime(updated_at_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    print(f"  ⚠️  Skipping '{title}' - unrecognized date format: {updated_at_str}")
                    continue

                stuck_hours = (now - updated_dt).total_seconds() / 3600

            except Exception as e:
                print(f"  ⚠️  Skipping '{title}' - date parse error: {e}")
                continue

            # Flag the task
            reason = f"Stuck in '{status}' for {stuck_hours:.1f} hour(s) with no updates"

            execute("""
                UPDATE tasks
                SET flagged = 1,
                    flag_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (reason, task_id))

            print(f"  🚩 Flagged: \"{title}\" - {reason}")

            # Only notify if there's an assignee
            if assignee_id:
                try:
                    send_stuck_notification(task_id, title, assignee_id, status, stuck_hours)
                except Exception as e:
                    print(f"  ⚠️  Notification failed for '{title}': {e}")
            else:
                print(f"  📝 No assignee on \"{title}\" - skipping notification")

            flagged_count += 1

    except Exception as e:
        print(f"  ❌ Task flagger error: {e}")

    print(f"  ✅ Completed: Stuck Task Flagger - {flagged_count} stuck task(s) flagged")
    return flagged_count


def send_stuck_notification(task_id, title, assignee_id, status, stuck_hours):
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
            'type': 'task_stuck',
            'task_id': task_id,
            'title': title,
            'assignee_id': assignee_id,
            'status': status,
            'stuck_hours': round(stuck_hours, 1)
        }

        response = requests.post(
            f"{notifier_url}/notify",
            json=payload,
            timeout=3
        )

        if response.status_code == 200:
            print(f"  📬 Notification sent for \"{title}\"")
        else:
            print(f"  ⚠️  Notifier returned {response.status_code} for \"{title}\"")

    except Exception as e:
        print(f"  📭 Notifier not available - skipping notification for \"{title}\"")