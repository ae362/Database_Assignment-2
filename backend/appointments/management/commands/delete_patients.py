from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from datetime import datetime
import logging
import sys

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('account_deletion.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)
User = get_user_model()

class Command(BaseCommand):
    help = 'Delete all registered accounts except superusers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompt'
        )
        parser.add_argument(
            '--preserve-admins',
            action='store_true',
            help='Preserve accounts with admin role'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        preserve_admins = options['preserve_admins']

        # Query for accounts to delete
        accounts_query = User.objects.exclude(is_superuser=True)
        
        if preserve_admins:
            accounts_query = accounts_query.exclude(role='admin')

        accounts_to_delete = accounts_query.all()
        account_count = accounts_to_delete.count()

        if account_count == 0:
            self.stdout.write(
                self.style.WARNING(
                    'No accounts found to delete.'
                )
            )
            return

        # Show summary
        self.stdout.write(
            self.style.WARNING(
                f'\nFound {account_count} accounts to delete'
            )
        )

        if dry_run:
            self.stdout.write('\nDRY RUN - No records will be deleted')
            self.show_account_list(accounts_to_delete)
            return

        if not force:
            confirm = input(
                f'\nWARNING: You are about to delete {account_count} accounts and all their related data. '
                'This action cannot be undone!\n'
                'Type "DELETE ALL" to confirm: '
            )
            if confirm != 'DELETE ALL':
                self.stdout.write(
                    self.style.WARNING('\nOperation cancelled.')
                )
                return

        try:
            with transaction.atomic():
                # Log deletion statistics
                role_counts = {
                    'patient': 0,
                    'doctor': 0,
                    'admin': 0,
                    'undefined': 0
                }

                # Delete accounts and related data
                for account in accounts_to_delete:
                    # Count roles
                    role = account.role if hasattr(account, 'role') else 'undefined'
                    role_counts[role] = role_counts.get(role, 0) + 1

                    # Log account details
                    logger.info(
                        f'Deleting account: {account.email} '
                        f'(Role: {role}, Last login: {account.last_login})'
                    )
                    
                    # Delete related appointments
                    if hasattr(account, 'appointments'):
                        appointment_count = account.appointments.count()
                        account.appointments.all().delete()
                        logger.info(f'Deleted {appointment_count} appointments for {account.email}')
                    
                    # Delete the account
                    account.delete()
                    
                    logger.info(f'Successfully deleted account: {account.email}')

                # Log summary
                logger.info('\nDeletion Summary:')
                logger.info('-' * 40)
                for role, count in role_counts.items():
                    if count > 0:
                        logger.info(f'{role.title()} accounts deleted: {count}')
                logger.info('-' * 40)

                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nSuccessfully deleted {account_count} accounts '
                        'and their related records.'
                    )
                )

        except Exception as e:
            logger.error(f'Error during deletion: {str(e)}')
            self.stdout.write(
                self.style.ERROR(
                    f'\nAn error occurred: {str(e)}'
                )
            )
            return

    def show_account_list(self, accounts):
        self.stdout.write('\nAccounts that would be deleted:')
        self.stdout.write('-' * 100)
        self.stdout.write(
            f'{"Email":<30} | {"Name":<30} | {"Role":<10} | {"Last Login"}'
        )
        self.stdout.write('-' * 100)
        
        for account in accounts:
            role = account.role if hasattr(account, 'role') else 'undefined'
            self.stdout.write(
                f'{account.email:<30} | '
                f'{account.get_full_name():<30} | '
                f'{role:<10} | '
                f'{account.last_login}'
            )
        self.stdout.write('-' * 100)