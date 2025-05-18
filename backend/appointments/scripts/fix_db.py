import os
import pymongo
import json
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import uuid
import sys

# MongoDB connection setup
def get_mongodb_client():
    """Get MongoDB client with proper connection settings"""
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/')
    
    if not mongodb_uri:
        print("MongoDB URI not configured")
        return None
    
    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=45000,
        maxPoolSize=100
    )
    
    try:
        client.admin.command('ping')
        print("MongoDB connection successful")
        return client
    except Exception as e:
        print(f"MongoDB connection failed: {str(e)}")
        return None

def create_full_backup(db, backup_dir="mongodb_backup"):
    """Create a full backup of all collections"""
    print(f"Creating full database backup...")
    
    # Create backup directory if it doesn't exist
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup_path = os.path.join(backup_dir, f"backup_{timestamp}")
    os.makedirs(backup_path, exist_ok=True)
    
    # Get all collections
    collections = db.list_collection_names()
    
    for collection_name in collections:
        try:
            # Skip system collections
            if collection_name.startswith('system.'):
                continue
                
            # Get all documents from the collection
            documents = list(db[collection_name].find())
            
            # Convert ObjectId to string for JSON serialization
            for doc in documents:
                if '_id' in doc and isinstance(doc['_id'], ObjectId):
                    doc['_id'] = str(doc['_id'])
            
            # Write to JSON file
            file_path = os.path.join(backup_path, f"{collection_name}.json")
            with open(file_path, 'w') as f:
                json.dump(documents, f, default=str)
            
            print(f"Backed up {len(documents)} documents from {collection_name}")
        except Exception as e:
            print(f"Error backing up {collection_name}: {str(e)}")
    
    print(f"Full backup completed at {backup_path}")
    return backup_path

def identify_duplicate_collections(db):
    """Identify duplicate collections and determine which to keep"""
    print("Identifying duplicate collections...")
    
    # List of collections to check
    collections = db.list_collection_names()
    
    # Check for Django ORM collections (typically have django_ prefix or _django suffix)
    django_collections = [c for c in collections if c.startswith('django_') or c.endswith('_django') or c.startswith('auth_')]
    
    # Check for duplicate appointment collections
    appointment_collections = [c for c in collections if 'appointment' in c.lower()]
    
    # Determine which appointment collection to keep
    main_appointment_collection = 'appointments'
    duplicate_appointment_collections = [c for c in appointment_collections if c != main_appointment_collection]
    
    # Check for duplicate user collections
    user_collections = [c for c in collections if 'user' in c.lower()]
    main_user_collection = 'users'
    duplicate_user_collections = [c for c in user_collections if c != main_user_collection]
    
    # Check for duplicate doctor collections
    doctor_collections = [c for c in collections if 'doctor' in c.lower() and 'exception' not in c.lower() and 'availability' not in c.lower()]
    main_doctor_collection = 'doctors'
    duplicate_doctor_collections = [c for c in doctor_collections if c != main_doctor_collection]
    
    # Specifically check for the mentioned duplicates
    specific_duplicates = []
    if 'appointments_user' in collections:
        specific_duplicates.append('appointments_user')
    if 'appointments_doctor' in collections:
        specific_duplicates.append('appointments_doctor')
    if 'appointments_appointment' in collections:
        specific_duplicates.append('appointments_appointment')
    
    # Combine all duplicates
    all_duplicates = list(set(django_collections + duplicate_appointment_collections + 
                             duplicate_user_collections + duplicate_doctor_collections +
                             specific_duplicates))
    
    print(f"Found {len(all_duplicates)} duplicate or Django ORM collections to remove")
    for coll in all_duplicates:
        print(f"  - {coll}")
    
    return all_duplicates

def remove_duplicate_collections(db, duplicates):
    """Remove duplicate collections after confirming they're not needed"""
    print("Removing duplicate collections...")
    
    for collection_name in duplicates:
        try:
            # Create a backup of the collection first
            backup_name = f"{collection_name}_backup_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            db[collection_name].aggregate([
                {"$match": {}},
                {"$out": backup_name}
            ])
            print(f"Created backup of {collection_name} as {backup_name}")
            
            # Now drop the collection
            db[collection_name].drop()
            print(f"Dropped collection {collection_name}")
        except Exception as e:
            print(f"Error removing collection {collection_name}: {str(e)}")

def drop_all_indexes(db, collection_name):
    """Drop all indexes from a collection except the _id index"""
    print(f"Dropping all indexes from {collection_name}...")
    
    try:
        # Get all indexes
        indexes = list(db[collection_name].list_indexes())
        
        # Drop each index except _id
        for index in indexes:
            index_name = index.get('name')
            if index_name != '_id_':
                try:
                    print(f"  Dropping index {index_name}")
                    db[collection_name].drop_index(index_name)
                except Exception as e:
                    print(f"  Error dropping index {index_name}: {str(e)}")
        
        print(f"All indexes dropped from {collection_name}")
    except Exception as e:
        print(f"Error dropping indexes from {collection_name}: {str(e)}")

def create_index_safely(collection, keys, **kwargs):
    """Create an index safely, handling existing indexes"""
    try:
        # Try to create the index
        result = collection.create_index(keys, **kwargs)
        print(f"  Created index: {result}")
        return True
    except pymongo.errors.OperationFailure as e:
        # Check if error is due to index already existing with different name
        if "Index already exists with a different name" in str(e):
            print(f"  Index conflict detected: {str(e)}")
            
            # Get the conflicting index
            existing_indexes = list(collection.list_indexes())
            
            # Convert keys to a list of tuples for comparison
            if isinstance(keys, list):
                key_list = keys
            else:
                key_list = [(keys, pymongo.ASCENDING)]
                
            # Find the conflicting index
            for index in existing_indexes:
                if index['name'] != '_id_':
                    # Compare key patterns
                    index_keys = list(index['key'].items())
                    if index_keys == key_list:
                        # Found the conflicting index, drop it
                        print(f"  Dropping conflicting index: {index['name']}")
                        try:
                            collection.drop_index(index['name'])
                            # Try to create the index again
                            result = collection.create_index(keys, **kwargs)
                            print(f"  Created index after resolving conflict: {result}")
                            return True
                        except Exception as drop_error:
                            print(f"  Error dropping conflicting index: {str(drop_error)}")
                            return False
            
            print("  Could not find the conflicting index to drop")
            return False
        else:
            print(f"  Error creating index: {str(e)}")
            return False
    except Exception as e:
        print(f"  Unexpected error creating index: {str(e)}")
        return False

def optimize_mongodb_schema(db):
    """
    Optimize MongoDB schema according to assignment brief requirements:
    1. Restructure collections to follow MongoDB document model
    2. Implement proper denormalization
    3. Create appropriate indexes
    4. Add conflict resolution mechanism for appointments
    """
    print("Starting MongoDB schema optimization...")
    
    # 1. Restructure users collection
    print("Restructuring users collection...")
    
    # Get all users
    users = list(db.users.find())
    
    for user in users:
        # Ensure user has an ID
        if 'id' not in user:
            user['id'] = str(uuid.uuid4())
        
        # Add missing fields
        if 'role' not in user:
            user['role'] = 'patient'
        
        if 'date_joined' not in user:
            user['date_joined'] = datetime.now()
        
        # Update user
        db.users.update_one(
            {'_id': user['_id']},
            {'$set': user}
        )
    
    # 2. Restructure doctors collection with embedded availability
    print("Restructuring doctors collection with embedded availability...")
    
    # Get all doctors
    doctors = list(db.doctors.find())
    
    for doctor in doctors:
        # Ensure doctor has an ID
        if 'id' not in doctor:
            doctor['id'] = str(uuid.uuid4())
        
        # Get doctor's availability
        availability = list(db.doctor_availability.find({'doctor_id': doctor.get('id')}))
        
        # Structure availability by day
        regular_availability = {}
        for avail in availability:
            day = avail.get('day_of_week')
            if day is not None:
                day_name = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][day]
                
                if day_name not in regular_availability:
                    regular_availability[day_name] = []
                
                time_slot = {
                    'start_time': avail.get('start_time'),
                    'end_time': avail.get('end_time'),
                    'is_available': avail.get('is_available', True)
                }
                regular_availability[day_name].append(time_slot)
        
        # Get doctor exceptions (days off)
        exceptions = list(db.doctor_exceptions.find({'doctor_id': doctor.get('id')}))
        exception_dates = []
        
        for exception in exceptions:
            exception_dates.append({
                'date': exception.get('date'),
                'reason': exception.get('reason', ''),
                'is_available': exception.get('is_available', False)
            })
        
        # Update doctor with embedded availability
        doctor['regular_availability'] = regular_availability
        doctor['exception_dates'] = exception_dates
        
        # Add missing fields
        if 'qualification' not in doctor:
            doctor['qualification'] = "No qualification"
        
        if 'experience_years' not in doctor:
            doctor['experience_years'] = 0
        
        if 'consultation_fee' not in doctor:
            doctor['consultation_fee'] = 20.00
        
        if 'daily_patient_limit' not in doctor:
            doctor['daily_patient_limit'] = 10
        
        if 'is_available' not in doctor:
            doctor['is_available'] = True
        
        # Update doctor
        db.doctors.update_one(
            {'_id': doctor['_id']},
            {'$set': doctor}
        )
    
    # 3. Restructure patients collection
    print("Restructuring patients collection...")
    
    # Get all patients
    patients = list(db.patients.find())
    
    for patient in patients:
        # Ensure patient has an ID
        if 'id' not in patient:
            patient['id'] = str(uuid.uuid4())
        
        # Add missing fields
        if 'medical_history' not in patient:
            patient['medical_history'] = []
        elif isinstance(patient['medical_history'], str) and patient['medical_history']:
            # Convert string medical history to array of conditions
            patient['medical_history'] = [
                {'condition': condition.strip(), 'diagnosed_date': None, 'notes': None}
                for condition in patient['medical_history'].split(',')
            ]
        
        # Get patient's appointments
        appointments = list(db.appointments.find({'patient': patient.get('id')}))
        
        # Create appointment history
        appointment_history = []
        for appt in appointments:
            if appt.get('status') == 'completed':
                appointment_history.append({
                    'appointment_id': appt.get('id'),
                    'doctor_id': appt.get('doctor'),
                    'doctor_name': appt.get('doctor_name', ''),
                    'date': appt.get('date'),
                    'reason': appt.get('reason_for_visit', ''),
                    'diagnosis': appt.get('diagnosis', ''),
                    'prescription': appt.get('prescription', '')
                })
        
        # Add appointment history to patient
        patient['appointment_history'] = appointment_history
        
        # Update patient
        db.patients.update_one(
            {'_id': patient['_id']},
            {'$set': patient}
        )
    
    # 4. Restructure appointments collection with embedded patient and doctor info
    print("Restructuring appointments collection with embedded info...")
    
    # Get all appointments
    appointments = list(db.appointments.find())
    
    for appointment in appointments:
        # Ensure appointment has an ID
        if 'id' not in appointment:
            appointment['id'] = str(uuid.uuid4())
        
        # Get patient and doctor info
        patient_id = appointment.get('patient')
        doctor_id = appointment.get('doctor')
        
        patient = None
        doctor = None
        
        if patient_id:
            patient = db.patients.find_one({'id': patient_id})
            if not patient and ObjectId.is_valid(patient_id):
                patient = db.patients.find_one({'_id': ObjectId(patient_id)})
        
        if doctor_id:
            doctor = db.doctors.find_one({'id': doctor_id})
            if not doctor and ObjectId.is_valid(doctor_id):
                doctor = db.doctors.find_one({'_id': ObjectId(doctor_id)})
        
        # Embed patient info
        if patient:
            appointment['patientInfo'] = {
                'id': patient.get('id'),
                'name': patient.get('name', f"{patient.get('first_name', '')} {patient.get('last_name', '')}").strip(),
                'email': patient.get('email'),
                'phone': patient.get('phone', ''),
                'medical_history': patient.get('medical_history', []),
                'allergies': patient.get('allergies', '')
            }
        
        # Embed doctor info
        if doctor:
            appointment['doctorInfo'] = {
                'id': doctor.get('id'),
                'name': doctor.get('name', ''),
                'specialization': doctor.get('specialization', ''),
                'consultation_fee': doctor.get('consultation_fee', 20.00)
            }
        
        # Add version field for optimistic concurrency control
        if 'version' not in appointment:
            appointment['version'] = 1
        
        # Add missing fields
        if 'status' not in appointment:
            appointment['status'] = 'scheduled'
        
        if 'created_at' not in appointment:
            appointment['created_at'] = datetime.now()
        
        # Update appointment
        db.appointments.update_one(
            {'_id': appointment['_id']},
            {'$set': appointment}
        )
    
    # 5. Create indexes - first drop existing indexes to avoid conflicts
    print("Creating indexes...")
    
    # Drop existing indexes to avoid conflicts
    drop_all_indexes(db, 'users')
    drop_all_indexes(db, 'patients')
    drop_all_indexes(db, 'doctors')
    drop_all_indexes(db, 'appointments')
    
    # Users collection
    create_index_safely(db.users, "email", unique=True, name="users_email_unique")
    create_index_safely(db.users, "id", unique=True, name="users_id_unique")
    create_index_safely(db.users, "role", name="users_role")
    
    # Patients collection
    create_index_safely(db.patients, "email", name="patients_email")
    create_index_safely(db.patients, "id", unique=True, name="patients_id_unique")
    create_index_safely(db.patients, "user_id", name="patients_user_id")
    create_index_safely(db.patients, "name", name="patients_name")
    
    # Doctors collection
    create_index_safely(db.doctors, "email", name="doctors_email")
    create_index_safely(db.doctors, "id", unique=True, name="doctors_id_unique")
    create_index_safely(db.doctors, "user_id", name="doctors_user_id")
    create_index_safely(db.doctors, "specialization", name="doctors_specialization")
    create_index_safely(db.doctors, "name", name="doctors_name")
    
    # Appointments collection
    create_index_safely(db.appointments, "id", unique=True, name="appointments_id_unique")
    create_index_safely(db.appointments, "patient", name="appointments_patient")
    create_index_safely(db.appointments, "doctor", name="appointments_doctor")
    create_index_safely(db.appointments, "date", name="appointments_date")
    create_index_safely(db.appointments, "status", name="appointments_status")
    
    # Create compound index for appointment conflict resolution
    create_index_safely(
        db.appointments, 
        [("doctor", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
        unique=True,
        partialFilterExpression={"status": "scheduled"},
        name="appointments_doctor_date_conflict"
    )
    
    # 6. Create metadata collection to track schema version
    db.schema_metadata.update_one(
        {"name": "schema_version"},
        {"$set": {
            "name": "schema_version",
            "version": "1.0",
            "setup_completed": True,
            "last_updated": datetime.now(),
            "description": "Optimized schema for Health Clinic Appointment Management System"
        }},
        upsert=True
    )
    
    print("MongoDB schema optimization completed successfully")
    return True

def main():
    """Main function to run the optimization script"""
    print("Starting MongoDB schema optimization script...")
    
    # Get MongoDB client
    client = get_mongodb_client()
    if not client:
        print("Failed to connect to MongoDB. Exiting.")
        return False
    
    # Get database
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
    # Create full backup
    backup_path = create_full_backup(db)
    print(f"Full backup created at {backup_path}")
    
    # Ask for confirmation to proceed
    confirm = input("Backup completed. Do you want to proceed with schema optimization? (y/n): ")
    if confirm.lower() != 'y':
        print("Operation cancelled by user.")
        return False
    
    # Identify duplicate collections
    duplicates = identify_duplicate_collections(db)
    
    # Ask for confirmation to remove duplicates
    if duplicates:
        confirm = input(f"Found {len(duplicates)} duplicate collections. Remove them? (y/n): ")
        if confirm.lower() == 'y':
            remove_duplicate_collections(db, duplicates)
        else:
            print("Skipping removal of duplicate collections.")
    
    # Optimize schema
    try:
        optimize_mongodb_schema(db)
        print("Schema optimization completed successfully!")
        print(f"If you need to restore from backup, use the files in {backup_path}")
        return True
    except Exception as e:
        print(f"Error during schema optimization: {str(e)}")
        print(f"You can restore from the backup at {backup_path}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("Script completed successfully!")
        sys.exit(0)
    else:
        print("Script failed or was cancelled.")
        sys.exit(1)