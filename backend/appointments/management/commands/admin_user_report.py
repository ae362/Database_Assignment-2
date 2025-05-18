from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
import csv
from datetime import datetime

User = get_user_model()

class Command(BaseCommand):
    help = 'Generate a report of user accounts by role'

    def add_arguments(self, parser):
        parser.add_argument(
            '--format',
            choices=['console', 'csv'],
            default='console',
            help='Output format (default: console)'
        )
        parser.add_argument(
            '--output',
            help='Output file for CSV format'
        )

    def handle(self, *args, **options):
        output_format = options['format']
        output_file = options['output']
        
        # Get all users grouped by role
        roles = {}
        for user in User.objects.all():
            role = getattr(user, 'role', 'unknown')
            if role not in roles:
                roles[role] = []
            
            # Collect user data (excluding password)
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'date_joined': user.date_joined,
                'last_login': user.last_login
            }
            
            # Add any custom fields you need
            if hasattr(user, 'phone'):
                user_data['phone'] = user.phone
                
            roles[role].append(user_data)
        
        # Output the report
        if output_format == 'console':
            self.print_console_report(roles)
        elif output_format == 'csv':
            self.export_csv_report(roles, output_file)

    def print_console_report(self, roles):
        """Print the user report to the console"""
        for role, users in roles.items():
            self.stdout.write(self.style.SUCCESS(f"\n=== {role.upper()} USERS ({len(users)}) ==="))
            self.stdout.write("-" * 80)
            self.stdout.write(f"{'ID':<5} {'Email':<30} {'Name':<30} {'Active':<6} {'Joined':<10}")
            self.stdout.write("-" * 80)
            
            for user in users:
                name = f"{user['first_name']} {user['last_name']}".strip()
                joined = user['date_joined'].strftime('%Y-%m-%d') if user['date_joined'] else 'N/A'
                self.stdout.write(f"{user['id']:<5} {user['email']:<30} {name:<30} {user['is_active']!s:<6} {joined:<10}")

    def export_csv_report(self, roles, output_file=None):
        """Export the user report to CSV files"""
        if not output_file:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f"user_report_{timestamp}.csv"
        
        with open(output_file, 'w', newline='') as csvfile:
            # Determine all possible fields from all users
            all_fields = set()
            for users in roles.values():
                for user in users:
                    all_fields.update(user.keys())
            
            fieldnames = ['role'] + sorted(list(all_fields))
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write all users with their role
            for role, users in roles.items():
                for user in users:
                    row = user.copy()
                    row['role'] = role
                    # Convert datetime objects to strings
                    for key, value in row.items():
                        if isinstance(value, datetime):
                            row[key] = value.strftime('%Y-%m-%d %H:%M:%S')
                    writer.writerow(row)
        
        self.stdout.write(self.style.SUCCESS(f"CSV report exported to {output_file}"))
