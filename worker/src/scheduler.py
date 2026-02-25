# worker/src/scheduler.py
# Main scheduler - runs background jobs automatically

import sys
import os
import time
from datetime import datetime

# Add parent directory to path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import load_env
from config.database import test_connection
from tasks.deadline_checker import check_deadlines
from tasks.task_flagger import flag_stuck_tasks

# Load environment variables
load_env()

def run_deadline_checker():
    """Wrapper for deadline checker with error handling"""
    print("\n🔄 Running: Deadline Checker...")
    try:
        check_deadlines()
    except Exception as e:
        print(f"❌ Deadline checker failed: {e}")

def run_task_flagger():
    """Wrapper for task flagger with error handling"""
    print("\n🔄 Running: Stuck Task Flagger...")
    try:
        flag_stuck_tasks()
    except Exception as e:
        print(f"❌ Task flagger failed: {e}")

def main():
    """Main entry point - runs jobs in a loop"""
    print("\n╔════════════════════════════════════════════╗")
    print("║     Syncline Background Worker Started     ║")
    print("╚════════════════════════════════════════════╝")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test database connection
    if not test_connection():
        print("\n❌ Failed to connect to database. Exiting.")
        sys.exit(1)
    
    print("\nJobs scheduled:")
    print("  - Deadline checker    → every 30 seconds")
    print("  - Stuck task flagger  → every 60 seconds")
    print("\nPress Ctrl+C to stop the worker\n")
    
    iteration = 0
    
    try:
        while True:
            iteration += 1
            current_time = datetime.now().strftime('%H:%M:%S')
            
            print(f"\n{'='*50}")
            print(f"--- Iteration #{iteration} | {current_time} ---")
            print('='*50)
            
            # Run deadline checker every iteration (30 seconds)
            run_deadline_checker()
            
            # Run task flagger every 2nd iteration (60 seconds)
            if iteration % 2 == 0:
                run_task_flagger()
            
            # Wait 30 seconds before next iteration
            time.sleep(30)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down worker gracefully...")
        print("👋 Goodbye!\n")
        sys.exit(0)

if __name__ == '__main__':
    main()