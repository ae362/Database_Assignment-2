# comprehensive_debug.py
import os
import json
import bcrypt
import pymongo
import uuid
import random
from datetime import datetime, timedelta
import jwt

# ANSI color codes for better readability
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")

def print_subheader(text):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.BLUE}{'-' * len(text)}{Colors.ENDC}")

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")

def print_warning(text):
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")

def print_error(text):
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")

def print_info(text):
    print(f"{Colors.CYAN}ℹ {text}{Colors.ENDC}")

def get_mongodb_client():
    """
    Get MongoDB client
    """
    # Get MongoDB URI from environment
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/')
    
    if not mongodb_uri:
        print_error("MongoDB URI not configured. Please set MONGODB_URI environment variable.")
        return None
    
    # Create MongoDB client with timeout settings
    client = pymongo.MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=45000
    )
    
    # Test connection
    try:
        client.admin.command('ismaster')
        print_success("MongoDB connection successful")
        return client
    except Exception as e:
        print_error(f"MongoDB connection failed: {str(e)}")
        return None

def generate_token(user, secret_key="your-secret-key"):
    """Generate JWT token for user"""
    payload = {
        'user_id': str(user['id']),
        'email': user['email'],
        'role': user.get('role', 'patient'),
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, secret_key, algorithm='HS256')

def get_user_from_token(token, secret_key="your-secret-key", db=None):
    """Get user from JWT token"""
    try:
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        user = db.users.find_one({'id': payload['user_id']})
        return user
    except Exception as e:
        print_error(f"Token decode error: {str(e)}")
        return None

def create_test_users(db):
    """Create test users for debugging"""
    print_subheader("Creating Test Users")
    
    # Create a patient
    patient_email = f"patient_{random.randint(1000, 9999)}@example.com"
    patient_password = "password123"
    
    # Check if patient already exists
    existing_patient = db.users.find_one({'email': patient_email})
    if existing_patient:
        print_warning(f"Patient already exists: {patient_email}")
        patient_id = existing_patient['id']
    else:
        # Hash password
        hashed_password = bcrypt.hashpw(patient_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create patient user
        patient_id = str(uuid.uuid4())
        patient = {
            'id': patient_id,
            'email': patient_email,
            'username': f"patient_{random.randint(1000, 9999)}",
            'password': hashed_password,
            'first_name': 'Test',
            'last_name': 'Patient',
            'role': 'patient',
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'date_joined': datetime.now(),
            'last_login': None,
            'phone': '555-123-4567',
            'birthday': '1990-01-01',
            'gender': 'male',
            'address': '123 Test St'
        }
        
        db.users.insert_one(patient)
        
        # Create patient profile
        patient_profile = {
            'id': str(uuid.uuid4()),
            'user_id': patient_id,
            'name': f"{patient['first_name']} {patient['last_name']}",
            'email': patient_email,
            'phone': patient['phone'],
            'date_of_birth': patient['birthday'],
            'gender': patient['gender'],
            'address': patient['address'],
            'medical_history': 'None',
            'allergies': 'None',
            'medications': 'None',
            'created_at': datetime.now()
        }
        
        db.patients.insert_one(patient_profile)
        print_success(f"Created patient: {patient_email} / {patient_password}")
    
    # Create a doctor
    doctor_email = f"doctor_{random.randint(1000, 9999)}@example.com"
    doctor_password = "password123"
    
    # Check if doctor already exists
    existing_doctor = db.users.find_one({'email': doctor_email})
    if existing_doctor:
        print_warning(f"Doctor already exists: {doctor_email}")
        doctor_id = existing_doctor['id']
    else:
        # Hash password
        hashed_password = bcrypt.hashpw(doctor_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create doctor user
        doctor_id = str(uuid.uuid4())
        doctor_user = {
            'id': doctor_id,
            'email': doctor_email,
            'username': f"doctor_{random.randint(1000, 9999)}",
            'password': hashed_password,
            'first_name': 'Test',
            'last_name': 'Doctor',
            'role': 'doctor',
            'is_active': True,
            'is_staff': True,
            'is_superuser': False,
            'date_joined': datetime.now(),
            'last_login': None,
            'phone': '555-987-6543'
        }
        
        db.users.insert_one(doctor_user)
        
        # Create doctor profile
        doctor_profile_id = str(uuid.uuid4())
        doctor_profile = {
            'id': doctor_profile_id,
            'user_id': doctor_id,
            'name': f"{doctor_user['first_name']} {doctor_user['last_name']}",
            'specialization': 'Cardiology',
            'email': doctor_email,
            'phone': doctor_user['phone'],
            'qualification': 'MD',
            'experience_years': 10,
            'consultation_fee': '100',
            'available_days': 'Monday,Wednesday,Friday',
            'bio': 'Experienced cardiologist',
            'medical_center': None,
            'medical_center_name': 'City Hospital',
            'emergency_available': True,
            'daily_patient_limit': 10,
            'is_available': True,
            'created_at': datetime.now()
        }
        
        db.doctors.insert_one(doctor_profile)
        print_success(f"Created doctor: {doctor_email} / {doctor_password}")
    
    # Create an admin
    admin_email = f"admin_{random.randint(1000, 9999)}@example.com"
    admin_password = "password123"
    
    # Check if admin already exists
    existing_admin = db.users.find_one({'email': admin_email})
    if existing_admin:
        print_warning(f"Admin already exists: {admin_email}")
        admin_id = existing_admin['id']
    else:
        # Hash password
        hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create admin user
        admin_id = str(uuid.uuid4())
        admin = {
            'id': admin_id,
            'email': admin_email,
            'username': f"admin_{random.randint(1000, 9999)}",
            'password': hashed_password,
            'first_name': 'Test',
            'last_name': 'Admin',
            'role': 'admin',
            'is_active': True,
            'is_staff': True,
            'is_superuser': True,
            'date_joined': datetime.now(),
            'last_login': None
        }
        
        db.users.insert_one(admin)
        print_success(f"Created admin: {admin_email} / {admin_password}")
    
    return {
        'patient': {
            'id': patient_id,
            'email': patient_email,
            'password': patient_password
        },
        'doctor': {
            'id': doctor_id,
            'email': doctor_email,
            'password': doctor_password
        },
        'admin': {
            'id': admin_id,
            'email': admin_email,
            'password': admin_password
        }
    }

def test_authentication(db, users):
    """Test authentication functionality"""
    print_subheader("Testing Authentication")
    
    tokens = {}
    
    # Test patient login
    patient = db.users.find_one({'email': users['patient']['email']})
    if patient:
        try:
            # Check password
            stored_password = patient['password']
            if isinstance(stored_password, str):
                stored_password = stored_password.encode('utf-8')
            
            if bcrypt.checkpw(users['patient']['password'].encode('utf-8'), stored_password):
                print_success(f"Patient login successful: {users['patient']['email']}")
                tokens['patient'] = generate_token(patient)
                print_info(f"Patient token: {tokens['patient'][:20]}...")
            else:
                print_error(f"Patient login failed: {users['patient']['email']}")
        except Exception as e:
            print_error(f"Patient password verification error: {str(e)}")
    else:
        print_error(f"Patient not found: {users['patient']['email']}")
    
    # Test doctor login
    doctor = db.users.find_one({'email': users['doctor']['email']})
    if doctor:
        try:
            # Check password
            stored_password = doctor['password']
            if isinstance(stored_password, str):
                stored_password = stored_password.encode('utf-8')
            
            if bcrypt.checkpw(users['doctor']['password'].encode('utf-8'), stored_password):
                print_success(f"Doctor login successful: {users['doctor']['email']}")
                tokens['doctor'] = generate_token(doctor)
                print_info(f"Doctor token: {tokens['doctor'][:20]}...")
            else:
                print_error(f"Doctor login failed: {users['doctor']['email']}")
        except Exception as e:
            print_error(f"Doctor password verification error: {str(e)}")
    else:
        print_error(f"Doctor not found: {users['doctor']['email']}")
    
    # Test admin login
    admin = db.users.find_one({'email': users['admin']['email']})
    if admin:
        try:
            # Check password
            stored_password = admin['password']
            if isinstance(stored_password, str):
                stored_password = stored_password.encode('utf-8')
            
            if bcrypt.checkpw(users['admin']['password'].encode('utf-8'), stored_password):
                print_success(f"Admin login successful: {users['admin']['email']}")
                tokens['admin'] = generate_token(admin)
                print_info(f"Admin token: {tokens['admin'][:20]}...")
            else:
                print_error(f"Admin login failed: {users['admin']['email']}")
        except Exception as e:
            print_error(f"Admin password verification error: {str(e)}")
    else:
        print_error(f"Admin not found: {users['admin']['email']}")
    
    # Test token validation
    for role, token in tokens.items():
        user = get_user_from_token(token, db=db)
        if user:
            print_success(f"Token validation successful for {role}")
        else:
            print_error(f"Token validation failed for {role}")
    
    return tokens

def test_doctor_management(db, tokens):
    """Test doctor management functionality"""
    print_subheader("Testing Doctor Management")
    
    # Get admin user from token
    admin = get_user_from_token(tokens['admin'], db=db)
    if not admin:
        print_error("Admin token validation failed")
        return
    
    # Create a new doctor
    new_doctor_email = f"new_doctor_{random.randint(1000, 9999)}@example.com"
    new_doctor_id = str(uuid.uuid4())
    
    new_doctor = {
        'id': new_doctor_id,
        'name': 'New Test Doctor',
        'specialization': 'Neurology',
        'email': new_doctor_email,
        'phone': '555-111-2222',
        'qualification': 'MD, PhD',
        'experience_years': 15,
        'consultation_fee': '150',
        'available_days': 'Tuesday,Thursday',
        'bio': 'Experienced neurologist',
        'medical_center_name': 'Metro Hospital',
        'emergency_available': False,
        'daily_patient_limit': 8,
        'is_available': True,
        'created_at': datetime.now()
    }
    
    # Insert new doctor
    db.doctors.insert_one(new_doctor)
    print_success(f"Created new doctor: {new_doctor_email}")
    
    # Get all doctors
    doctors = list(db.doctors.find())
    print_info(f"Found {len(doctors)} doctors in the database")
    
    # Get specific doctor
    doctor = db.doctors.find_one({'id': new_doctor_id})
    if doctor:
        print_success(f"Retrieved doctor: {doctor['name']}")
        
        # Update doctor
        db.doctors.update_one(
            {'id': new_doctor_id},
            {'$set': {'specialization': 'Neurosurgery', 'experience_years': 16}}
        )
        
        # Get updated doctor
        updated_doctor = db.doctors.find_one({'id': new_doctor_id})
        if updated_doctor and updated_doctor['specialization'] == 'Neurosurgery':
            print_success(f"Updated doctor specialization to: {updated_doctor['specialization']}")
        else:
            print_error("Failed to update doctor")
        
        # Delete doctor
        db.doctors.delete_one({'id': new_doctor_id})
        
        # Verify deletion
        deleted_doctor = db.doctors.find_one({'id': new_doctor_id})
        if not deleted_doctor:
            print_success("Doctor deleted successfully")
        else:
            print_error("Failed to delete doctor")
    else:
        print_error(f"Doctor not found with ID: {new_doctor_id}")
    
    return new_doctor_id

def test_appointment_management(db, users, tokens):
    """Test appointment management functionality"""
    print_subheader("Testing Appointment Management")
    
    # Get patient and doctor
    patient = db.users.find_one({'email': users['patient']['email']})
    if not patient:
        print_error(f"Patient not found: {users['patient']['email']}")
        return
    
    # Find a doctor
    doctor = list(db.doctors.find())[0] if list(db.doctors.find()) else None
    if not doctor:
        print_error("No doctors found in the database")
        return
    
    # Create a new appointment
    appointment_id = str(uuid.uuid4())
    appointment_date = datetime.now() + timedelta(days=7)
    
    appointment = {
        'id': appointment_id,
        'patient': patient['id'],
        'patient_name': f"{patient['first_name']} {patient['last_name']}",
        'doctor': doctor['id'],
        'doctor_name': doctor['name'],
        'date': appointment_date,
        'notes': 'Test appointment',
        'status': 'scheduled',
        'blood_type': 'A+',
        'medications': 'None',
        'allergies': 'None',
        'medical_conditions': 'None',
        'reason_for_visit': 'Regular checkup',
        'created_at': datetime.now()
    }
    
    # Insert appointment
    db.appointments.insert_one(appointment)
    print_success(f"Created appointment for {appointment_date.strftime('%Y-%m-%d %H:%M')}")
    
    # Get all appointments for patient
    patient_appointments = list(db.appointments.find({'patient': patient['id']}))
    print_info(f"Found {len(patient_appointments)} appointments for patient")
    
    # Get all appointments for doctor
    doctor_appointments = list(db.appointments.find({'doctor': doctor['id']}))
    print_info(f"Found {len(doctor_appointments)} appointments for doctor")
    
    # Get specific appointment
    specific_appointment = db.appointments.find_one({'id': appointment_id})
    if specific_appointment:
        print_success(f"Retrieved appointment: {specific_appointment['id']}")
        
        # Update appointment
        db.appointments.update_one(
            {'id': appointment_id},
            {'$set': {'notes': 'Updated test appointment', 'status': 'completed'}}
        )
        
        # Get updated appointment
        updated_appointment = db.appointments.find_one({'id': appointment_id})
        if updated_appointment and updated_appointment['status'] == 'completed':
            print_success(f"Updated appointment status to: {updated_appointment['status']}")
        else:
            print_error("Failed to update appointment")
        
        # Delete appointment
        db.appointments.delete_one({'id': appointment_id})
        
        # Verify deletion
        deleted_appointment = db.appointments.find_one({'id': appointment_id})
        if not deleted_appointment:
            print_success("Appointment deleted successfully")
        else:
            print_error("Failed to delete appointment")
    else:
        print_error(f"Appointment not found with ID: {appointment_id}")

def test_doctor_availability(db, users, tokens):
    """Test doctor availability management"""
    print_subheader("Testing Doctor Availability")
    
    # Find a doctor
    doctor = list(db.doctors.find())[0] if list(db.doctors.find()) else None
    if not doctor:
        print_error("No doctors found in the database")
        return
    
    # Update doctor availability
    db.doctors.update_one(
        {'id': doctor['id']},
        {'$set': {'available_days': 'Monday,Tuesday,Wednesday,Thursday,Friday'}}
    )
    
    # Get updated doctor
    updated_doctor = db.doctors.find_one({'id': doctor['id']})
    if updated_doctor:
        print_success(f"Updated doctor available days to: {updated_doctor['available_days']}")
    else:
        print_error("Failed to update doctor availability")
    
    # Create appointments for the doctor on different days
    patient = db.users.find_one({'role': 'patient'})
    if not patient:
        print_error("No patients found in the database")
        return
    
    # Create appointments for Monday, Wednesday, and Friday
    days = [0, 2, 4]  # Monday, Wednesday, Friday (0-indexed)
    appointment_ids = []
    
    for day_offset in days:
        # Calculate next occurrence of the day
        today = datetime.now().date()
        days_ahead = day_offset - today.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        next_day = today + timedelta(days=days_ahead)
        
        # Create appointment at 10:00 AM
        appointment_date = datetime.combine(next_day, datetime.min.time().replace(hour=10))
        appointment_id = str(uuid.uuid4())
        
        appointment = {
            'id': appointment_id,
            'patient': patient['id'],
            'patient_name': f"{patient['first_name']} {patient['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': doctor['name'],
            'date': appointment_date,
            'notes': f'Appointment for {next_day.strftime("%A")}',
            'status': 'scheduled',
            'created_at': datetime.now()
        }
        
        db.appointments.insert_one(appointment)
        appointment_ids.append(appointment_id)
        print_success(f"Created appointment for {next_day.strftime('%A, %Y-%m-%d')} at 10:00 AM")
    
    # Check doctor's schedule
    for day_offset in range(7):  # Check all days of the week
        today = datetime.now().date()
        days_ahead = day_offset - today.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        next_day = today + timedelta(days=days_ahead)
        
        # Check appointments for this day
        start_of_day = datetime.combine(next_day, datetime.min.time())
        end_of_day = datetime.combine(next_day, datetime.max.time())
        
        appointments = list(db.appointments.find({
            'doctor': doctor['id'],
            'date': {'$gte': start_of_day, '$lte': end_of_day},
            'status': 'scheduled'
        }))
        
        day_name = next_day.strftime('%A')
        print_info(f"{day_name}: {len(appointments)} appointments scheduled")
    
    # Clean up test appointments
    for appointment_id in appointment_ids:
        db.appointments.delete_one({'id': appointment_id})
    
    print_success(f"Deleted {len(appointment_ids)} test appointments")

def test_patient_management(db, users, tokens):
    """Test patient management functionality"""
    print_subheader("Testing Patient Management")
    
    # Get admin user from token
    admin = get_user_from_token(tokens['admin'], db=db)
    if not admin:
        print_error("Admin token validation failed")
        return
    
    # Create a new patient
    new_patient_email = f"new_patient_{random.randint(1000, 9999)}@example.com"
    new_patient_id = str(uuid.uuid4())
    
    # Hash password
    hashed_password = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    new_patient_user = {
        'id': new_patient_id,
        'email': new_patient_email,
        'username': f"new_patient_{random.randint(1000, 9999)}",
        'password': hashed_password,
        'first_name': 'New',
        'last_name': 'Patient',
        'role': 'patient',
        'is_active': True,
        'is_staff': False,
        'is_superuser': False,
        'date_joined': datetime.now(),
        'last_login': None,
        'phone': '555-333-4444',
        'birthday': '1985-05-15',
        'gender': 'female',
        'address': '456 New St'
    }
    
    db.users.insert_one(new_patient_user)
    
    # Create patient profile
    new_patient_profile = {
        'id': str(uuid.uuid4()),
        'user_id': new_patient_id,
        'name': f"{new_patient_user['first_name']} {new_patient_user['last_name']}",
        'email': new_patient_email,
        'phone': new_patient_user['phone'],
        'date_of_birth': new_patient_user['birthday'],
        'gender': new_patient_user['gender'],
        'address': new_patient_user['address'],
        'medical_history': 'Asthma',
        'allergies': 'Peanuts',
        'medications': 'Albuterol',
        'created_at': datetime.now()
    }
    
    db.patients.insert_one(new_patient_profile)
    print_success(f"Created new patient: {new_patient_email}")
    
    # Get all patients
    patients = list(db.patients.find())
    print_info(f"Found {len(patients)} patients in the database")
    
    # Get specific patient
    patient = db.patients.find_one({'email': new_patient_email})
    if patient:
        print_success(f"Retrieved patient: {patient['name']}")
        
        # Update patient
        db.patients.update_one(
            {'email': new_patient_email},
            {'$set': {'medical_history': 'Asthma, Hypertension'}}
        )
        
        # Get updated patient
        updated_patient = db.patients.find_one({'email': new_patient_email})
        if updated_patient and 'Hypertension' in updated_patient['medical_history']:
            print_success(f"Updated patient medical history to: {updated_patient['medical_history']}")
        else:
            print_error("Failed to update patient")
        
        # Delete patient
        db.patients.delete_one({'email': new_patient_email})
        db.users.delete_one({'email': new_patient_email})
        
        # Verify deletion
        deleted_patient = db.patients.find_one({'email': new_patient_email})
        if not deleted_patient:
            print_success("Patient deleted successfully")
        else:
            print_error("Failed to delete patient")
    else:
        print_error(f"Patient not found with email: {new_patient_email}")

def test_api_endpoints():
    """Test API endpoints"""
    print_subheader("Testing API Endpoints")
    
    # This is a placeholder for testing actual API endpoints
    # In a real scenario, you would use requests library to make HTTP requests
    
    print_info("API endpoint testing would be implemented here")
    print_info("This would involve making HTTP requests to your API endpoints")
    print_info("and verifying the responses")

def main():
    print_header("MongoDB Healthcare System Debug Tool")
    
    # Get MongoDB client
    client = get_mongodb_client()
    if not client:
        return
    
    # Get database
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
    # Create test users
    users = create_test_users(db)
    
    # Test authentication
    tokens = test_authentication(db, users)
    
    # Test doctor management
    test_doctor_management(db, tokens)
    
    # Test appointment management
    test_appointment_management(db, users, tokens)
    
    # Test doctor availability
    test_doctor_availability(db, users, tokens)
    
    # Test patient management
    test_patient_management(db, users, tokens)
    
    # Test API endpoints
    # test_api_endpoints()
    
    print_header("Debug Testing Complete")

if __name__ == "__main__":
    main()