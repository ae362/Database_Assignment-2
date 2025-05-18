from django.core.management.base import BaseCommand
from django.conf import settings
import os
import sys

class Command(BaseCommand):
    help = 'Migrate data from SQLite to MongoDB'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sqlite-path',
            default='db.sqlite3',
            help='Path to SQLite database file'
        )
        parser.add_argument(
            '--skip-migration',
            action='store_true',
            help='Skip data migration and only set up MongoDB'
        )

    def handle(self, *args, **options):
        # Add the parent directory to sys.path
        parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if parent_dir not in sys.path:
            sys.path.append(parent_dir)

        # Import the migration script
        from data_migration import migrate_sqlite_to_mongodb, setup_mongodb_indexes, create_admin_user
        from mongodb_utils import get_mongodb_database

        sqlite_path = options['sqlite_path']
        skip_migration = options['skip_migration']

        # Get MongoDB database
        mongo_db = get_mongodb_database()

        # Create admin user
        create_admin_user(mongo_db)

        # Set up MongoDB indexes
        setup_mongodb_indexes(mongo_db)

        # Run migration if not skipped
        if not skip_migration:
            if os.path.exists(sqlite_path):
                self.stdout.write(self.style.SUCCESS(f'Starting migration from {sqlite_path} to MongoDB...'))
                migrate_sqlite_to_mongodb(sqlite_path)
                self.stdout.write(self.style.SUCCESS('Migration completed successfully'))
            else:
                self.stdout.write(self.style.WARNING(f'SQLite database not found at {sqlite_path}. Skipping migration.'))
                self.stdout.write(self.style.SUCCESS('MongoDB setup completed with default admin user.'))
        else:
            self.stdout.write(self.style.SUCCESS('Migration skipped. MongoDB setup completed with default admin user.'))
