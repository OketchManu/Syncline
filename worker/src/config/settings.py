# worker/src/config/settings.py
# Environment configuration

import os
from pathlib import Path

def load_env():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent.parent / '.env'
    
    env_vars = {}
    
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        env_vars[key] = value
                        # Also set as environment variable
                        os.environ[key] = value
    else:
        print(f"⚠️  Warning: .env file not found at {env_path}")
        print("    Using default configuration...")
        # Set defaults
        env_vars = {
            'DATABASE_PATH': '../../data/syncline.db',
            'NOTIFIER_URL': 'http://localhost:8080',
            'API_URL': 'http://localhost:3001'
        }
    
    return env_vars

def get_database_path():
    """Get the absolute path to the database file"""
    env = load_env()
    db_path = env.get('DATABASE_PATH', '../../data/syncline.db')
    
    # Resolve relative path from this file's location
    config_dir = Path(__file__).parent
    abs_path = (config_dir / db_path).resolve()
    
    return str(abs_path)

def get_notifier_url():
    """Get the notifier service URL"""
    env = load_env()
    return env.get('NOTIFIER_URL', 'http://localhost:8080')

def get_api_url():
    """Get the API service URL"""
    env = load_env()
    return env.get('API_URL', 'http://localhost:3001')