import os
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import pymongo
import bcrypt
import uuid
from datetime import datetime

class Command(BaseCommand):
    help = 'Creates an admin user in MongoDB'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Admin email')
        parser.add_argument('--password', type=str, help='Admin password')
        parser.add_argument('--first-name', type=str, help='Admin first name')
        parser.add_argument('--last-name', type=str, help='Admin last name')
        parser.add_argument('--username', type=str, help='Admin username (optional)')

    def handle(self, *args, **options):
        # ============================================================
        # MODIFY THESE MONGODB CONNECTION DETAILS
        # ============================================================
        MONGODB_URI = "mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/"  # Change this to your MongoDB URI
        DB_NAME = "hcams"  # Change this to your database name
        # ============================================================
        
        # Get command line arguments or use defaults/prompts
        email = options['email'] or input("Enter admin email: ")
        password = options['password'] or input("Enter admin password: ")
        first_name = options['first_name'] or input("Enter admin first name: ")
        last_name = options['last_name'] or input("Enter admin last name: ")
        username = options['username'] or email.split('@')[0]
        
        try:
            # Connect to MongoDB
            self.stdout.write(self.style.WARNING(f"Connecting to MongoDB at {MONGODB_URI}..."))
            client = pymongo.MongoClient(MONGODB_URI)
            db = client[DB_NAME]
            
            # Check if collections exist, create if they don't
            if "users" not in db.list_collection_names():
                self.stdout.write(self.style.WARNING("Creating users collection..."))
                db.create_collection("users")
            
            # Check if user already exists
            existing_user = db.users.find_one({"email": email})
            if existing_user:
                self.stdout.write(self.style.ERROR(f"User with email {email} already exists!"))
                return
            
            # Hash the password
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create user document
            user_id = str(uuid.uuid4())
            user = {
                'id': user_id,
                'email': email,
                'username': username,
                'password': hashed_password,
                'first_name': first_name,
                'last_name': last_name,
                'role': 'admin',
                'is_active': True,
                'is_staff': True,
                'is_superuser': True,
                'date_joined': datetime.now(),
                'last_login': None
            }
            
            # Insert the user
            result = db.users.insert_one(user)
            
            if result.inserted_id:
                self.stdout.write(self.style.SUCCESS(f"Admin user created successfully!"))
                self.stdout.write(self.style.SUCCESS(f"Email: {email}"))
                self.stdout.write(self.style.SUCCESS(f"Username: {username}"))
                self.stdout.write(self.style.SUCCESS(f"Role: admin"))
                
                # Create a sample token for the user (optional)
                token_value = str(uuid.uuid4())
                token = {
                    'user_id': user_id,
                    'token': token_value,
                    'created_at': datetime.now()
                }
                
                # Check if tokens collection exists
                if "tokens" not in db.list_collection_names():
                    self.stdout.write(self.style.WARNING("Creating tokens collection..."))
                    db.create_collection("tokens")
                
                db.tokens.insert_one(token)
                self.stdout.write(self.style.SUCCESS(f"Token created for user"))
                
            else:
                self.stdout.write(self.style.ERROR("Failed to create admin user"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))
            raise CommandError(f"Failed to create admin user: {str(e)}")
