from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
import getpass
import secrets
import string

User = get_user_model()

class Command(BaseCommand):
    help = 'Reset a user\'s password by email'

    def add_arguments(self, parser):
        parser.add_argument('email', help='Email address of the user')
        parser.add_argument(
            '--generate',
            action='store_true',
            help='Generate a random secure password'
        )
        parser.add_argument(
            '--length',
            type=int,
            default=12,
            help='Length of generated password (default: 12)'
        )

    def handle(self, *args, **options):
        email = options['email']
        generate = options['generate']
        password_length = options['length']
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user found with email {email}")
        
        if generate:
            # Generate a random password
            new_password = self.generate_secure_password(password_length)
        else:
            # Prompt for new password
            new_password = getpass.getpass("Enter new password: ")
            confirm_password = getpass.getpass("Confirm new password: ")
            
            if new_password != confirm_password:
                raise CommandError("Passwords do not match")
        
        # Set the new password
        user.set_password(new_password)
        user.save()
        
        self.stdout.write(self.style.SUCCESS(f"Password reset successfully for {email}"))
        self.stdout.write(f"New password: {new_password}")

    def generate_secure_password(self, length=12):
        """Generate a secure random password"""
        alphabet = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password
