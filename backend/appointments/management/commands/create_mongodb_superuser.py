# appointments/management/commands/create_mongodb_superuser.py
from django.core.management.base import BaseCommand
from pymongo import MongoClient
from django.conf import settings
import getpass
import bcrypt
import uuid
from datetime import datetime

class Command(BaseCommand):
    help = 'Create a superuser in MongoDB'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True, help='Username for the superuser')
        parser.add_argument('--email', required=True, help='Email for the superuser')
        parser.add_argument('--first-name', help='First name for the superuser')
        parser.add_argument('--last-name', help='Last name for the superuser')
        parser.add_argument('--password', help='Password for the superuser (if not provided, will prompt)')
        parser.add_argument('--non-interactive', action='store_true', help='Run without interactive prompts')

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        first_name = options.get('first_name', '')
        last_name = options.get('last_name', '')
        password = options.get('password')
        non_interactive = options.get('non_interactive', False)

        # Connect to MongoDB
        client = MongoClient(settings.MONGODB_URI)
        db = client[settings.MONGODB_NAME]
        
        # Check if user already exists
        existing_user = db.users.find_one({'$or': [{'username': username}, {'email': email}]})
        if existing_user:
            self.stdout.write(self.style.ERROR(f"User with username '{username}' or email '{email}' already exists."))
            return

        # Get password if not provided
        if not password and not non_interactive:
            password = getpass.getpass('Password: ')
            password_confirm = getpass.getpass('Password (again): ')
            if password != password_confirm:
                self.stdout.write(self.style.ERROR("Passwords don't match."))
                return
        elif not password:
            self.stdout.write(self.style.ERROR("Password is required in non-interactive mode."))
            return

        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user document
        user = {
            'id': str(uuid.uuid4()),  # Generate a unique ID
            'username': username,
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'password': hashed_password,
            'role': 'admin',  # Set role as admin
            'is_active': True,
            'is_staff': True,
            'is_superuser': True,
            'date_joined': datetime.now(),
            'last_login': None
        }
        
        # Insert the user
        db.users.insert_one(user)
        
        self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created successfully."))