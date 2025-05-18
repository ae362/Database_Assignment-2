from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
import uuid

# MongoDB setup
MONGO_URI = "mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/"
DATABASE_NAME = "Hcams"

client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

# Create indexes for better performance
db.appointments.create_index([("doctor_id", ASCENDING), ("date", ASCENDING)])
db.appointments.create_index([("patient_id", ASCENDING), ("date", ASCENDING)])
db.appointments.create_index([("status", ASCENDING)])
db.doctors.create_index([("specialization", ASCENDING)])
db.doctors.create_index([("is_available", ASCENDING)])
db.patients.create_index([("user_id", ASCENDING)])
db.clinic_staff.create_index([("email", ASCENDING)], unique=True)

# Define model schemas (for documentation purposes)

USER_SCHEMA = {
    "id": "string (UUID)",
    "username": "string",
    "email": "string",
    "password": "string (hashed)",
    "first_name": "string",
    "last_name": "string",
    "role": "string (admin, doctor, patient)",
    "phone": "string",
    "address": "string",
    "date_of_birth": "date",
    "gender": "string",
    "is_active": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime"
}

PATIENT_SCHEMA = {
    "id": "string (UUID)",
    "user_id": "string (reference to user)",
    "name": "string",
    "email": "string",
    "phone": "string",
    "address": "string",
    "date_of_birth": "date",
    "gender": "string",
    "medical_info": {
        "blood_type": "string",
        "allergies": ["string"],
        "medications": ["string"],
        "medical_history": ["string"],
        "chronic_diseases": ["string"],
        "last_updated": "datetime"
    },
    "emergency_contact": {
        "name": "string",
        "relationship": "string",
        "phone": "string"
    },
    "created_at": "datetime",
    "updated_at": "datetime"
}

DOCTOR_SCHEMA = {
    "id": "string (UUID)",
    "user_id": "string (reference to user)",
    "name": "string",
    "specialization": "string",
    "qualification": "string",
    "experience_years": "integer",
    "email": "string",
    "phone": "string",
    "bio": "string",
    "consultation_fee": "decimal",
    "is_available": "boolean",
    "daily_patient_limit": "integer",
    "working_hours": {
        "monday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "tuesday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "wednesday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "thursday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "friday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "saturday": {"start": "string (HH:MM)", "end": "string (HH:MM)"},
        "sunday": {"start": "string (HH:MM)", "end": "string (HH:MM)"}
    },
    "available_days": ["string (day name or number)"],
    "medical_center_id": "string (reference to medical center)",
    "created_at": "datetime",
    "updated_at": "datetime"
}

APPOINTMENT_SCHEMA = {
    "id": "string (UUID)",
    "patient_id": "string (reference to patient)",
    "doctor_id": "string (reference to doctor)",
    "date": "datetime",
    "status": "string (scheduled, completed, cancelled, no_show)",
    "notes": "string",
    "patient_info": {
        "name": "string",
        "phone": "string",
        "email": "string"
    },
    "doctor_info": {
        "name": "string",
        "specialization": "string",
        "phone": "string"
    },
    "medical_data": {
        "blood_type": "string",
        "allergies": ["string"],
        "medications": ["string"],
        "reason_for_visit": "string",
        "medical_conditions": ["string"]
    },
    "created_at": "datetime",
    "updated_at": "datetime"
}

CLINIC_STAFF_SCHEMA = {
    "id": "string (UUID)",
    "user_id": "string (reference to user)",
    "name": "string",
    "email": "string",
    "phone": "string",
    "position": "string (admin only)",
    "permissions": ["string"],
    "hire_date": "date",
    "is_active": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime"
}

MEDICAL_CENTER_SCHEMA = {
    "id": "string (UUID)",
    "name": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "website": "string",
    "doctors": ["string (reference to doctor)"],
    "created_at": "datetime",
    "updated_at": "datetime"
}

# Helper functions for model operations

def create_user(data):
    """
    Create a new user
    
    Args:
        data (dict): User data
        
    Returns:
        str: User ID
    """
    # Generate UUID for new user
    user_id = str(uuid.uuid4())
    data['id'] = user_id
    
    # Add timestamps
    now = datetime.now()
    data['created_at'] = now
    data['updated_at'] = now
    
    # Set default values
    if 'is_active' not in data:
        data['is_active'] = True
    
    # Insert user
    db.users.insert_one(data)
    
    return user_id

def create_patient(data):
    """
    Create a new patient
    
    Args:
        data (dict): Patient data
        
    Returns:
        str: Patient ID
    """
    # Generate UUID for new patient
    patient_id = str(uuid.uuid4())
    data['id'] = patient_id
    
    # Add timestamps
    now = datetime.now()
    data['created_at'] = now
    data['updated_at'] = now
    
    # Initialize medical info if not provided
    if 'medical_info' not in data:
        data['medical_info'] = {
            'blood_type': '',
            'allergies': [],
            'medications': [],
            'medical_history': [],
            'chronic_diseases': [],
            'last_updated': now
        }
    
    # Insert patient
    db.patients.insert_one(data)
    
    return patient_id

def create_doctor(data):
    """
    Create a new doctor
    
    Args:
        data (dict): Doctor data
        
    Returns:
        str: Doctor ID
    """
    # Generate UUID for new doctor
    doctor_id = str(uuid.uuid4())
    data['id'] = doctor_id
    
    # Add timestamps
    now = datetime.now()
    data['created_at'] = now
    data['updated_at'] = now
    
    # Set default values
    if 'is_available' not in data:
        data['is_available'] = True
    
    if 'daily_patient_limit' not in data:
        data['daily_patient_limit'] = 20
    
    # Insert doctor
    db.doctors.insert_one(data)
    
    return doctor_id

def create_appointment(data):
    """
    Create a new appointment
    
    Args:
        data (dict): Appointment data
        
    Returns:
        str: Appointment ID
    """
    # Generate UUID for new appointment
    appointment_id = str(uuid.uuid4())
    data['id'] = appointment_id
    
    # Add timestamps
    now = datetime.now()
    data['created_at'] = now
    data['updated_at'] = now
    
    # Set default status if not provided
    if 'status' not in data:
        data['status'] = 'scheduled'
    
    # Insert appointment
    db.appointments.insert_one(data)
    
    return appointment_id

def create_clinic_staff(data):
    """
    Create a new clinic staff member
    
    Args:
        data (dict): Clinic staff data
        
    Returns:
        str: Clinic staff ID
    """
    # Generate UUID for new clinic staff
    staff_id = str(uuid.uuid4())
    data['id'] = staff_id
    
    # Add timestamps
    now = datetime.now()
    data['created_at'] = now
    data['updated_at'] = now
    
    # Set default values
    if 'is_active' not in data:
        data['is_active'] = True
    
    # Ensure position is 'admin'
    data['position'] = 'admin'
    
    # Insert clinic staff
    db.clinic_staff.insert_one(data)
    
    return staff_id
