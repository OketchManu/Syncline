# worker/src/tasks/__init__.py
"""
Background task modules
Contains job definitions for deadline checking and task flagging
"""

from .deadline_checker import check_deadlines
from .task_flagger import flag_stuck_tasks

__all__ = [
    'check_deadlines',
    'flag_stuck_tasks'
]