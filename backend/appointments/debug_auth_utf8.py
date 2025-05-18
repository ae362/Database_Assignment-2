# appointments/debug_auth_utf8.py
"""
Debug script for authentication issues
Run this script to test authentication functions directly
"""
import os
import sys
import json
import bcrypt
import jwt
from datetime import datetime, timedelta

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

# Import MongoDB utilities
from appointments.mongo_utils import get_mongodb_database
from appointments.mongo_auth import authenticate_user, generate_token

# Get MongoDB database
db = get_mongodb_database()

def debug_user_retrieval():
    """Test user retrieval from MongoDB"""
    print("\n=== Testing User Retrieval ===")
    
    # List all users
    users = list(db.users.find({}))
    print(f"Found {len(users)} users in the database")
    
    if users:
        # Print first user (without password)
        first_user = users[0]
        if 'password' in first_user:
            first_user['password'] = '***HIDDEN***'
        print(f"Sample user: {json.dumps(first_user, default=str, indent=2)}")
    else:
        print("No users found in the database")

def create_test_user():
    """Create a test user for debugging"""
    print("\n=== Creating Test User ===")
    
    email = "test@example.com"
    password = "password123"
    
    # Check if user already exists
    existing_user = db.users.find_one({'email': email})
    if existing_user:
        print(f"Test user already exists: {email}")
        return
    
    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user document
    user = {
        'id': 'test-user-id',
        'email': email,
        'username': 'testuser',
        'password': hashed_password,
        'first_name': 'Test',
        'last_name': 'User',
        'role': 'patient',
        'is_active': True,
        'date_joined': datetime.now()
    }
    
    # Insert user
    db.users.insert_one(user)
    print(f"Created test user: {email} / {password}")

def test_login():
    """Test login functionality"""
    print("\n=== Testing Login ===")
    
    email = "test@example.com"
    password = "password123"
    
    user = authenticate_user(email, password)
    
    if user:
        print(f"Login successful for user: {email}")
        token = generate_token(user)
        print(f"Generated token: {token[:20]}...")
    else:
        print(f"Login failed for user: {email}")

if __name__ == "__main__":
    print("MongoDB Authentication Debugging Tool")
    print("====================================")
    
    # Create test user
    create_test_user()
    
    # Run debug functions
    debug_user_retrieval()
    test_login()