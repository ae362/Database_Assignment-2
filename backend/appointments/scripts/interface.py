import pymongo
import uuid
import bcrypt
from datetime import datetime
import getpass
import re

# MongoDB connection details
MONGO_URI = "mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/"
DB_NAME = "test"

def validate_email(email):
    """Validate email format"""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validate phone number format"""
    if not phone:
        return True
    pattern = r"^[0-9\-\+$$$$ ]{7,20}$"
    return re.match(pattern, phone) is not None

def create_admin_account(email, password, first_name, last_name, phone=None, position="admin"):
    """
    Create an admin account in MongoDB
    
    Args:
        email (str): Admin email
        password (str): Admin password
        first_name (str): Admin first name
        last_name (str): Admin last name
        phone (str, optional): Admin phone number
        position (str, optional): Admin position, defaults to "admin"
    
    Returns:
        dict: Created admin user data
    """
    try:
        # Connect to MongoDB
        print(f"Connecting to MongoDB database...")
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        # Check if user with this email already exists
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            print(f"User with email {email} already exists!")
            return None
        
        # Generate UUIDs
        user_id = str(uuid.uuid4())
        staff_id = str(uuid.uuid4())
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user document - use position as role
        user = {
            'id': user_id,
            'email': email,
            'username': email.split('@')[0],
            'password': hashed_password,
            'first_name': first_name,
            'last_name': last_name,
            'role': position,  # Set role to match position
            'is_active': True,
            'is_staff': True,
            'is_superuser': True,
            'date_joined': datetime.now(),
            'last_login': None,
            'phone': phone or ""
        }
        
        # Create clinic staff document
        staff = {
            'id': staff_id,
            'user_id': user_id,
            'name': f"{first_name} {last_name}",
            'email': email,
            'phone': phone or "",
            'position': position,
            'permissions': ['all'],
            'hire_date': datetime.now().strftime('%Y-%m-%d'),
            'created_at': datetime.now()
        }
        
        # Insert documents
        print("Creating user account...")
        db.users.insert_one(user)
        
        print("Creating staff record...")
        db.clinic_staff.insert_one(staff)
        
        print("\n✅ Admin account created successfully!")
        print(f"User ID: {user_id}")
        print(f"Staff ID: {staff_id}")
        print(f"Role/Position: {position}")
        
        # Return created user data (without password)
        user_data = user.copy()
        user_data.pop('password', None)
        return user_data
        
    except Exception as e:
        print(f"❌ Error creating admin account: {str(e)}")
        return None

def interactive_console():
    """Interactive console interface for creating admin accounts"""
    print("=" * 50)
    print("       HEALTHCARE ADMIN ACCOUNT CREATOR")
    print("=" * 50)
    print("\nThis tool will help you create admin accounts in the database.")
    print(f"Connected to database: {DB_NAME}")
    
    while True:
        print("\n" + "-" * 50)
        
        # Get email
        while True:
            email = input("Email address: ").strip()
            if validate_email(email):
                break
            print("❌ Invalid email format. Please try again.")
        
        # Get password
        while True:
            password = getpass.getpass("Password: ")
            if len(password) >= 6:
                confirm_password = getpass.getpass("Confirm password: ")
                if password == confirm_password:
                    break
                print("❌ Passwords don't match. Please try again.")
            else:
                print("❌ Password must be at least 6 characters long.")
        
        # Get name
        first_name = input("First name: ").strip()
        last_name = input("Last name: ").strip()
        
        # Get phone (optional)
        while True:
            phone = input("Phone number (optional): ").strip()
            if validate_phone(phone):
                break
            print("❌ Invalid phone format. Please use digits, spaces, and these characters: + - ( )")
        
        # Get position
        position = input("Position/Role [admin]: ").strip()
        if not position:
            position = "admin"
        
        # Confirm details
        print("\nPlease confirm the following details:")
        print(f"Email: {email}")
        print(f"First name: {first_name}")
        print(f"Last name: {last_name}")
        print(f"Phone: {phone or 'Not provided'}")
        print(f"Position/Role: {position}")
        
        confirm = input("\nCreate this admin account? (y/n): ").strip().lower()
        if confirm == 'y':
            create_admin_account(email, password, first_name, last_name, phone, position)
        else:
            print("Account creation cancelled.")
        
        # Ask to create another account
        another = input("\nCreate another admin account? (y/n): ").strip().lower()
        if another != 'y':
            break
    
    print("\nThank you for using the Healthcare Admin Account Creator.")
    print("=" * 50)

if __name__ == "__main__":
    try:
        interactive_console()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user. Exiting...")
    except Exception as e:
        print(f"\n\nAn unexpected error occurred: {str(e)}")