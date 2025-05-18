# appointments/management/commands/setup_mongodb_indexes.py
from django.core.management.base import BaseCommand
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from django.conf import settings
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Set up MongoDB indexes for healthcare appointment system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Drop existing indexes before creating new ones',
        )

    def handle(self, *args, **options):
        try:
            # Connect to MongoDB
            client = MongoClient(settings.MONGODB_URI)
            db = client[settings.MONGODB_NAME]
            
            # Check if we should force recreate indexes
            force = options['force']
            
            # Check if indexes have already been set up
            if db.index_metadata.find_one({'setup_completed': True}) and not force:
                self.stdout.write(self.style.SUCCESS('MongoDB indexes already exist. Use --force to recreate them.'))
                return
                
            self.stdout.write('Creating indexes for MongoDB collections...')
            
            # If force is True, drop existing indexes
            if force:
                self.stdout.write('Force flag detected. Dropping existing indexes...')
                collections_to_index = [
                    'users', 'doctors', 'medical_centers', 'appointments', 
                    'medical_examinations', 'doctor_availability', 
                    'availability_exceptions', 'doctor_booking_history'
                ]
                
                for collection_name in collections_to_index:
                    if collection_name in db.list_collection_names():
                        self.stdout.write(f'Dropping indexes for {collection_name}...')
                        # Keep _id index, drop all others
                        indexes = db[collection_name].index_information()
                        for index_name in indexes:
                            if index_name != '_id_':
                                db[collection_name].drop_index(index_name)
            
            # User/Patient collection indexes
            self.stdout.write('Creating indexes for users collection...')
            self._create_index(db.users, [('id', ASCENDING)], unique=True)
            self._create_index(db.users, [('email', ASCENDING)], unique=True)
            self._create_index(db.users, [('username', ASCENDING)], unique=True)
            self._create_index(db.users, [('role', ASCENDING)])
            self._create_index(db.users, [('first_name', ASCENDING), ('last_name', ASCENDING)])
            self._create_index(db.users, [('phone', ASCENDING)])
            self._create_index(db.users, [('birthday', ASCENDING)])
            self._create_index(db.users, [('gender', ASCENDING)])
            self._create_index(db.users, [('recent_doctor_id', ASCENDING)])
            
            # Text indexes for search functionality
            self._create_index(db.users, [
                ('first_name', TEXT), 
                ('last_name', TEXT), 
                ('email', TEXT),
                ('address', TEXT),
                ('medical_history', TEXT),
                ('chronic_diseases', TEXT)
            ], name='user_text_search')
            
            # Doctor collection indexes
            self.stdout.write('Creating indexes for doctors collection...')
            self._create_index(db.doctors, [('id', ASCENDING)], unique=True)
            self._create_index(db.doctors, [('email', ASCENDING)], unique=True)
            self._create_index(db.doctors, [('name', ASCENDING)])
            self._create_index(db.doctors, [('user_id', ASCENDING)], unique=True, sparse=True)
            self._create_index(db.doctors, [('specialization', ASCENDING)])
            self._create_index(db.doctors, [('qualification', ASCENDING)])
            self._create_index(db.doctors, [('experience_years', ASCENDING)])
            self._create_index(db.doctors, [('consultation_fee', ASCENDING)])
            self._create_index(db.doctors, [('medical_center_id', ASCENDING)])
            self._create_index(db.doctors, [('is_available', ASCENDING)])
            self._create_index(db.doctors, [('emergency_available', ASCENDING)])
            self._create_index(db.doctors, [('daily_patient_limit', ASCENDING)])
            
            # Compound indexes
            self._create_index(db.doctors, [('specialization', ASCENDING), ('is_available', ASCENDING)])
            self._create_index(db.doctors, [('specialization', ASCENDING), ('experience_years', DESCENDING)])
            self._create_index(db.doctors, [('specialization', ASCENDING), ('consultation_fee', ASCENDING)])
            
            # Text index
            self._create_index(db.doctors, [
                ('name', TEXT), 
                ('specialization', TEXT), 
                ('bio', TEXT),
                ('qualification', TEXT)
            ], name='doctor_text_search')
            
            # Medical Center collection indexes
            self.stdout.write('Creating indexes for medical_centers collection...')
            self._create_index(db.medical_centers, [('id', ASCENDING)], unique=True)
            self._create_index(db.medical_centers, [('name', ASCENDING)])
            self._create_index(db.medical_centers, [('email', ASCENDING)], sparse=True)
            self._create_index(db.medical_centers, [('phone', ASCENDING)])
            
            # Text index
            self._create_index(db.medical_centers, [
                ('name', TEXT), 
                ('address', TEXT),
                ('website', TEXT)
            ], name='medical_center_text_search')
            
            # Appointment collection indexes
            self.stdout.write('Creating indexes for appointments collection...')
            self._create_index(db.appointments, [('id', ASCENDING)], unique=True)
            self._create_index(db.appointments, [('date', DESCENDING)])
            self._create_index(db.appointments, [('status', ASCENDING)])
            self._create_index(db.appointments, [('patient_id', ASCENDING)])
            self._create_index(db.appointments, [('doctor_id', ASCENDING)])
            self._create_index(db.appointments, [('patient_name', ASCENDING)])
            self._create_index(db.appointments, [('doctor_name', ASCENDING)])
            self._create_index(db.appointments, [('patient_phone', ASCENDING)])
            self._create_index(db.appointments, [('blood_type', ASCENDING)])
            self._create_index(db.appointments, [('reason_for_visit', ASCENDING)])
            
            # Compound indexes
            self._create_index(db.appointments, [('doctor_id', ASCENDING), ('date', ASCENDING)])
            self._create_index(db.appointments, [('patient_id', ASCENDING), ('status', ASCENDING)])
            self._create_index(db.appointments, [('doctor_id', ASCENDING), ('status', ASCENDING)])
            self._create_index(db.appointments, [('doctor_id', ASCENDING), ('date', ASCENDING), ('status', ASCENDING)])
            
            # Unique index with partial filter - use a custom name to avoid conflicts
            self._create_index(
                db.appointments, 
                [('doctor_id', ASCENDING), ('date', ASCENDING)],
                unique=True,
                partialFilterExpression={'status': 'scheduled'},
                name='doctor_id_date_scheduled_unique'  # Custom name to avoid conflict
            )
            
            # Text index
            self._create_index(db.appointments, [
                ('notes', TEXT),
                ('medical_conditions', TEXT),
                ('reason_for_visit', TEXT),
                ('medications', TEXT),
                ('allergies', TEXT)
            ], name='appointment_text_search')
            
            # Medical Examination collection indexes
            self.stdout.write('Creating indexes for medical_examinations collection...')
            self._create_index(db.medical_examinations, [('id', ASCENDING)], unique=True)
            self._create_index(db.medical_examinations, [('patient_id', ASCENDING)])
            self._create_index(db.medical_examinations, [('doctor_id', ASCENDING)])
            self._create_index(db.medical_examinations, [('date', DESCENDING)])
            self._create_index(db.medical_examinations, [('examination_type', ASCENDING)])
            self._create_index(db.medical_examinations, [('patient_name', ASCENDING)])
            self._create_index(db.medical_examinations, [('doctor_name', ASCENDING)])
            
            # Compound indexes
            self._create_index(db.medical_examinations, [('patient_id', ASCENDING), ('date', DESCENDING)])
            self._create_index(db.medical_examinations, [('doctor_id', ASCENDING), ('date', DESCENDING)])
            self._create_index(db.medical_examinations, [('patient_id', ASCENDING), ('examination_type', ASCENDING)])
            
            # Text index
            self._create_index(db.medical_examinations, [
                ('examination_type', TEXT), 
                ('results', TEXT), 
                ('recommendations', TEXT),
                ('patient_name', TEXT),
                ('doctor_name', TEXT)
            ], name='examination_text_search')
            
            # Mark that indexes have been set up
            if db.index_metadata.find_one({'setup_completed': True}):
                db.index_metadata.update_one(
                    {'setup_completed': True},
                    {'$set': {'setup_date': datetime.now(), 'setup_version': '1.1'}}
                )
            else:
                db.index_metadata.insert_one({
                    'setup_completed': True,
                    'setup_date': datetime.now(),
                    'setup_version': '1.0'
                })
            
            self.stdout.write(self.style.SUCCESS('Successfully created all MongoDB indexes'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to create MongoDB indexes: {str(e)}'))
            raise
    
    def _create_index(self, collection, keys, **kwargs):
        """Helper method to create an index with error handling"""
        try:
            collection.create_index(keys, **kwargs)
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'Error creating index {keys} on {collection.name}: {str(e)}'))
            # If the error is about duplicate index names, try with a custom name
            if 'same name as the requested index' in str(e) and 'name' not in kwargs:
                # Generate a custom name
                index_name = '_'.join([f"{k[0]}_{k[1]}" for k in keys if isinstance(k[1], int)])
                index_name += '_custom_' + datetime.now().strftime('%H%M%S')
                self.stdout.write(self.style.WARNING(f'Retrying with custom name: {index_name}'))
                kwargs['name'] = index_name
                collection.create_index(keys, **kwargs)