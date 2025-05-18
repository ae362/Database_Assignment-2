# debug_auth.py
import os
import json
import bcrypt
import pymongo
from datetime import datetime, timedelta

def get_mongodb_client():
    """
    Get MongoDB client
    """
    # Get MongoDB URI from environment
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/')
    
    if not mongodb_uri:
        print("MongoDB URI not configured. Please set MONGODB_URI environment variable.")
        return None
    
    # Create MongoDB client with timeout settings
    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=45000
    )
    
    # Test connection
    try:
        client.admin.command('ismaster')
        print("MongoDB connection successful")
        return client
    except Exception as e:
        print(f"MongoDB connection failed: {str(e)}")
        return None

def debug_user_retrieval():
    """Test user retrieval from MongoDB"""
    client = get_mongodb_client()
    if not client:
        return
    
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
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
    client = get_mongodb_client()
    if not client:
        return
    
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
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
    client = get_mongodb_client()
    if not client:
        return
    
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
    print("\n=== Testing Login ===")
    
    email = "test@example.com"
    password = "password123"
    
    # Find user
    user = db.users.find_one({'email': email})
    
    if not user:
        print(f"No user found with email: {email}")
        return
    
    # Check password
    try:
        stored_password = user['password']
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')
        
        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            print(f"Login successful for user: {email}")
        else:
            print(f"Login failed for user: {email}")
    except Exception as e:
        print(f"Password verification error: {str(e)}")

if __name__ == "__main__":
    print("MongoDB Authentication Debugging Tool")
    print("====================================")
    
    # Create test user
    create_test_user()
    
    # Run debug functions
    debug_user_retrieval()
    test_login()