from pymongo import MongoClient, ASCENDING, DESCENDING
import uuid
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection settings
MONGO_URI = os.getenv("MONGODB_URI", "mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/")
DATABASE_NAME = os.getenv("MONGODB_NAME", "test")

print(f"Connecting to MongoDB at {MONGO_URI}")
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

def safe_create_index(collection, index_spec, **kwargs):
    """Safely create an index, handling existing indexes"""
    try:
        collection.create_index(index_spec, **kwargs)
        print(f"  Created index on {collection.name}: {index_spec}")
    except Exception as e:
        print(f"  Warning: Could not create index on {collection.name}: {index_spec}")
        print(f"  Error: {str(e)}")
        
        # If you want to force recreate the index, uncomment these lines:
        # try:
        #     index_name = collection.create_index(index_spec, name="temp_index", **kwargs)
        #     collection.drop_index(index_name)
        #     collection.create_index(index_spec, **kwargs)
        #     print(f"  Recreated index on {collection.name}: {index_spec}")
        # except Exception as e2:
        #     print(f"  Failed to recreate index: {str(e2)}")

def create_collections():
    """Create all required collections with their indexes"""
    print("Creating collections and indexes...")
    
    # Create collections if they don't exist
    collections = [
        "users", 
        "patients", 
        "doctors", 
        "appointments", 
        "doctor_exceptions", 
        "clinic_staff",
        "medical_centers",
        "doctor_availability",
        "availability_exceptions"
    ]
    
    existing_collections = db.list_collection_names()
    
    for collection in collections:
        if collection not in existing_collections:
            print(f"Creating collection: {collection}")
            db.create_collection(collection)
        else:
            print(f"Collection already exists: {collection}")
    
    # Create indexes for better performance
    print("Creating indexes...")
    
    # Users collection indexes
    safe_create_index(db.users, [("id", ASCENDING)], unique=True)
    safe_create_index(db.users, [("email", ASCENDING)], unique=True)
    safe_create_index(db.users, [("username", ASCENDING)], unique=True)
    safe_create_index(db.users, [("role", ASCENDING)])
    
    # Patients collection indexes
    safe_create_index(db.patients, [("id", ASCENDING)], unique=True)
    safe_create_index(db.patients, [("user_id", ASCENDING)])
    safe_create_index(db.patients, [("email", ASCENDING)])
    
    # Doctors collection indexes
    safe_create_index(db.doctors, [("id", ASCENDING)], unique=True)
    safe_create_index(db.doctors, [("user_id", ASCENDING)])
    safe_create_index(db.doctors, [("email", ASCENDING)])
    safe_create_index(db.doctors, [("specialization", ASCENDING)])
    safe_create_index(db.doctors, [("is_available", ASCENDING)])
    
    # Appointments collection indexes
    safe_create_index(db.appointments, [("id", ASCENDING)], unique=True)
    safe_create_index(db.appointments, [("doctor", ASCENDING), ("date", ASCENDING)])
    safe_create_index(db.appointments, [("patient", ASCENDING), ("date", ASCENDING)])
    safe_create_index(db.appointments, [("status", ASCENDING)])
    safe_create_index(db.appointments, [("date", ASCENDING)])
    
    # Doctor exceptions collection indexes
    safe_create_index(db.doctor_exceptions, [("id", ASCENDING)], unique=True)
    safe_create_index(db.doctor_exceptions, [("doctor_id", ASCENDING), ("date", ASCENDING)])
    
    # Clinic staff collection indexes
    safe_create_index(db.clinic_staff, [("id", ASCENDING)], unique=True)
    safe_create_index(db.clinic_staff, [("email", ASCENDING)], unique=True)
    
    # Medical centers collection indexes
    safe_create_index(db.medical_centers, [("id", ASCENDING)], unique=True)
    safe_create_index(db.medical_centers, [("name", ASCENDING)])
    
    # Doctor availability collection indexes
    safe_create_index(db.doctor_availability, [("doctor", ASCENDING), ("day_of_week", ASCENDING)])
    
    # Availability exceptions collection indexes
    safe_create_index(db.availability_exceptions, [("doctor", ASCENDING), ("date", ASCENDING)])
    
    print("Indexes created successfully")

def create_sample_data():
    """Create sample data for testing"""
    print("Creating sample data...")
    
    # Check if we already have users
    if db.users.count_documents({}) > 0:
        print("Sample data already exists. Skipping...")
        return
    
    # Create admin user
    admin_id = str(uuid.uuid4())
    admin_user = {
        'id': admin_id,
        'email': 'admin@example.com',
        'username': 'admin',
        'password': '$2b$12$tJrSC7MnpnpHKT9vB.LZ9.X6zZDCmHpX5d.2wQYwJaGmN9SMcHBfS',  # 'password123'
        'first_name': 'Admin',
        'last_name': 'User',
        'role': 'admin',
        'is_active': True,
        'is_staff': True,
        'is_superuser': True,
        'date_joined': datetime.now(),
        'last_login': None,
        'phone': '123-456-7890'
    }
    db.users.insert_one(admin_user)
    
    # Create clinic staff
    staff_id = str(uuid.uuid4())
    staff = {
        'id': staff_id,
        'user_id': admin_id,
        'name': 'Admin User',
        'email': 'admin@example.com',
        'phone': '123-456-7890',
        'position': 'admin',
        'permissions': ['all'],
        'hire_date': datetime.now().date().isoformat(),
        'created_at': datetime.now()
    }
    db.clinic_staff.insert_one(staff)
    
    # Create doctor user
    doctor_user_id = str(uuid.uuid4())
    doctor_user = {
        'id': doctor_user_id,
        'email': 'doctor@example.com',
        'username': 'doctor',
        'password': '$2b$12$tJrSC7MnpnpHKT9vB.LZ9.X6zZDCmHpX5d.2wQYwJaGmN9SMcHBfS',  # 'password123'
        'first_name': 'John',
        'last_name': 'Doe',
        'role': 'doctor',
        'is_active': True,
        'is_staff': True,
        'is_superuser': False,
        'date_joined': datetime.now(),
        'last_login': None,
        'phone': '123-456-7891'
    }
    db.users.insert_one(doctor_user)
    
    # Create doctor profile
    doctor_id = str(uuid.uuid4())
    doctor = {
        'id': doctor_id,
        'user_id': doctor_user_id,
        'name': 'Dr. John Doe',
        'email': 'doctor@example.com',
        'phone': '123-456-7891',
        'specialization': 'Cardiology',
        'qualification': 'MD, PhD',
        'experience_years': 10,
        'consultation_fee': '100.00',
        'available_days': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'bio': 'Experienced cardiologist with 10 years of practice.',
        'medical_center': None,
        'medical_center_name': '',
        'emergency_available': True,
        'daily_patient_limit': 20,
        'is_available': True,
        'created_at': datetime.now()
    }
    db.doctors.insert_one(doctor)
    
    # Create patient user
    patient_user_id = str(uuid.uuid4())
    patient_user = {
        'id': patient_user_id,
        'email': 'patient@example.com',
        'username': 'patient',
        'password': '$2b$12$tJrSC7MnpnpHKT9vB.LZ9.X6zZDCmHpX5d.2wQYwJaGmN9SMcHBfS',  # 'password123'
        'first_name': 'Jane',
        'last_name': 'Smith',
        'role': 'patient',
        'is_active': True,
        'is_staff': False,
        'is_superuser': False,
        'date_joined': datetime.now(),
        'last_login': None,
        'phone': '123-456-7892',
        'birthday': '1990-01-01',
        'gender': 'female',
        'address': '123 Main St, Anytown, USA'
    }
    db.users.insert_one(patient_user)
    
    # Create patient profile
    patient_id = str(uuid.uuid4())
    patient = {
        'id': patient_id,
        'user_id': patient_user_id,
        'name': 'Jane Smith',
        'email': 'patient@example.com',
        'phone': '123-456-7892',
        'date_of_birth': '1990-01-01',
        'gender': 'female',
        'address': '123 Main St, Anytown, USA',
        'medical_info': {
            'blood_type': 'A+',
            'allergies': ['Penicillin'],
            'medications': ['Aspirin'],
            'medical_history': ['Asthma'],
            'chronic_diseases': [],
            'last_updated': datetime.now()
        },
        'created_at': datetime.now()
    }
    db.patients.insert_one(patient)
    
    # Create a medical center
    medical_center_id = str(uuid.uuid4())
    medical_center = {
        'id': medical_center_id,
        'name': 'City Medical Center',
        'address': '456 Hospital Ave, Anytown, USA',
        'phone': '123-456-7000',
        'email': 'info@citymedical.com',
        'website': 'https://citymedical.com',
        'doctors': [doctor_id],
        'created_at': datetime.now(),
        'updated_at': datetime.now()
    }
    db.medical_centers.insert_one(medical_center)
    
    # Update doctor with medical center
    db.doctors.update_one(
        {'id': doctor_id},
        {'$set': {
            'medical_center': medical_center_id,
            'medical_center_name': 'City Medical Center'
        }}
    )
    
    # Create an appointment
    appointment_id = str(uuid.uuid4())
    appointment = {
        'id': appointment_id,
        'patient': patient_user_id,
        'patient_name': 'Jane Smith',
        'doctor': doctor_id,
        'doctor_name': 'Dr. John Doe',
        'date': datetime.now() + timedelta(days=7),
        'notes': 'Regular checkup',
        'status': 'scheduled',
        'patient_info': {
            'name': 'Jane Smith',
            'phone': '123-456-7892',
            'email': 'patient@example.com'
        },
        'doctor_info': {
            'name': 'Dr. John Doe',
            'specialization': 'Cardiology',
            'phone': '123-456-7891'
        },
        'medical_data': {
            'blood_type': 'A+',
            'allergies': ['Penicillin'],
            'medications': ['Aspirin'],
            'reason_for_visit': 'Regular checkup',
            'medical_conditions': ['Asthma']
        },
        'created_at': datetime.now()
    }
    db.appointments.insert_one(appointment)
    
    # Create doctor availability
    for day in range(5):  # Monday to Friday
        availability = {
            'doctor': doctor_id,
            'day_of_week': day,
            'start_time': '09:00',
            'end_time': '17:00',
            'is_available': True
        }
        db.doctor_availability.insert_one(availability)
    
    # Create a doctor exception (day off)
    exception_id = str(uuid.uuid4())
    exception = {
        'id': exception_id,
        'doctor_id': doctor_id,
        'doctor_name': 'Dr. John Doe',
        'date': (datetime.now() + timedelta(days=14)).date().isoformat(),
        'reason': 'Personal leave',
        'created_at': datetime.now(),
        'created_by': admin_id
    }
    db.doctor_exceptions.insert_one(exception)
    
    print("Sample data created successfully")

def validate_collections():
    """Validate that all required collections exist with the correct structure"""
    print("Validating collections...")
    
    # Check if all collections exist
    required_collections = [
        "users", 
        "patients", 
        "doctors", 
        "appointments", 
        "doctor_exceptions", 
        "clinic_staff",
        "medical_centers",
        "doctor_availability",
        "availability_exceptions"
    ]
    
    existing_collections = db.list_collection_names()
    
    for collection in required_collections:
        if collection not in existing_collections:
            print(f"ERROR: Collection {collection} does not exist")
        else:
            print(f"Collection {collection} exists")
    
    # Check if indexes exist
    for collection in required_collections:
        if collection in existing_collections:
            indexes = list(db[collection].list_indexes())
            print(f"Collection {collection} has {len(indexes)} indexes")
            for idx in indexes:
                print(f"  - {idx['name']}: {idx['key']}")
    
    print("Validation complete")

def main():
    """Main function to set up MongoDB"""
    print("Setting up MongoDB...")
    
    # Create collections and indexes
    create_collections()
    
    # Create sample data
    create_sample_data()
    
    # Validate collections
    validate_collections()
    
    print("MongoDB setup complete")

if __name__ == "__main__":
    main()