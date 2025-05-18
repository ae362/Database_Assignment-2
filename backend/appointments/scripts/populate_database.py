#!/usr/bin/env python3
"""
Comprehensive Database Population Script for Medical Appointment System

This script populates the MongoDB database with realistic test data including:
- Users (patients, doctors, admins)
- Doctor profiles with specializations and qualifications
- Patient profiles with medical histories
- Appointments (past, present, future)
- Availability settings and exceptions

Usage:
python populate_database.py --uri mongodb://localhost:27017 --db medical_app [--clear] [--count 50]
"""

import argparse
import random
import uuid
import bcrypt
from datetime import datetime, timedelta
from pymongo import MongoClient
import json
import sys

# Real-life data for generating realistic entries
FIRST_NAMES = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
    "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen",
    "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth",
    "Emily", "Emma", "Madison", "Olivia", "Hannah", "Abigail", "Isabella", "Samantha", "Elizabeth", "Ashley",
    "Mohammed", "Ali", "Omar", "Fatima", "Aisha", "Hassan", "Ibrahim", "Zainab", "Yusuf", "Layla",
    "Wei", "Jing", "Li", "Yan", "Ming", "Hui", "Xiu", "Feng", "Hong", "Jun",
    "Raj", "Priya", "Amit", "Neha", "Rahul", "Ananya", "Vikram", "Meera", "Arjun", "Divya"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor",
    "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson",
    "Clark", "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "Hernandez", "King",
    "Wright", "Lopez", "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter",
    "Khan", "Ahmed", "Ali", "Hassan", "Ibrahim", "Rahman", "Sheikh", "Malik", "Qureshi", "Mahmood",
    "Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou",
    "Patel", "Singh", "Sharma", "Kumar", "Shah", "Verma", "Mehta", "Joshi", "Gupta", "Desai"
]

SPECIALIZATIONS = [
    "General Medicine", "Pediatrics", "Cardiology", "Dermatology", "Orthopedics", 
    "Neurology", "Psychiatry", "Gynecology", "Ophthalmology", "ENT",
    "Urology", "Gastroenterology", "Endocrinology", "Oncology", "Pulmonology",
    "Rheumatology", "Nephrology", "Hematology", "Infectious Disease", "Allergy and Immunology"
]

QUALIFICATIONS = [
    "MD", "MBBS", "DO", "PhD", "MD-PhD", 
    "FRCS", "MRCP", "MRCGP", "DCH", "DRCOG",
    "FCPS", "MRCS", "DM", "DNB", "MS"
]

MEDICAL_CONDITIONS = [
    "Hypertension", "Diabetes Type 2", "Asthma", "Arthritis", "Migraine",
    "Hypothyroidism", "Anxiety Disorder", "Depression", "GERD", "Allergic Rhinitis",
    "Eczema", "Osteoporosis", "Hyperlipidemia", "Chronic Sinusitis", "IBS"
]

MEDICATIONS = [
    "Lisinopril", "Metformin", "Albuterol", "Ibuprofen", "Levothyroxine",
    "Atorvastatin", "Amlodipine", "Omeprazole", "Sertraline", "Loratadine",
    "Acetaminophen", "Amoxicillin", "Prednisone", "Fluticasone", "Montelukast"
]

ALLERGIES = [
    "Penicillin", "Peanuts", "Shellfish", "Latex", "Pollen",
    "Dust Mites", "Mold", "Eggs", "Milk", "Soy",
    "Tree Nuts", "Wheat", "Sulfa Drugs", "NSAIDs", "Bee Stings"
]

BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

APPOINTMENT_REASONS = [
    "Annual physical examination", "Follow-up consultation", "Chronic disease management",
    "Acute illness", "Prescription refill", "Vaccination", "Lab results review",
    "Pre-operative assessment", "Post-operative follow-up", "Specialist referral",
    "Mental health consultation", "Skin condition assessment", "Joint pain evaluation",
    "Digestive issues", "Respiratory problems", "Cardiovascular check-up",
    "Neurological assessment", "Endocrine disorder management", "Preventive care consultation",
    "Wellness check"
]

MEDICAL_CENTERS = [
    "Central Hospital", "City Medical Center", "Wellness Clinic", "Health First", 
    "Medical Associates", "Community Health Center", "University Hospital",
    "Memorial Medical Center", "Regional Hospital", "Specialty Care Clinic"
]

# Helper functions
def generate_password_hash(password):
    """Generate a bcrypt hash for the password"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_email(first_name, last_name):
    """Generate a realistic email address"""
    domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"]
    return f"{first_name.lower()}.{last_name.lower()}@{random.choice(domains)}"

def generate_phone():
    """Generate a realistic phone number"""
    return f"+1-{random.randint(200, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}"

def generate_address():
    """Generate a realistic address"""
    street_numbers = list(range(1, 9999))
    street_names = ["Main", "Oak", "Maple", "Cedar", "Pine", "Elm", "Washington", "Park", "Lake", "Hill"]
    street_types = ["St", "Ave", "Blvd", "Dr", "Ln", "Rd", "Way", "Pl", "Ct", "Terrace"]
    cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"]
    states = ["NY", "CA", "IL", "TX", "AZ", "PA", "TX", "CA", "TX", "CA"]
    zip_codes = [f"{random.randint(10000, 99999)}" for _ in range(10)]
    
    idx = random.randint(0, 9)
    return f"{random.choice(street_numbers)} {random.choice(street_names)} {random.choice(street_types)}, {cities[idx]}, {states[idx]} {zip_codes[idx]}"

def create_users(db, count=20):
    """Create users with different roles"""
    users = []
    
    # Create admin user
    admin_id = str(uuid.uuid4())
    admin = {
        'id': admin_id,
        'email': 'admin@medical-system.com',
        'username': 'admin',
        'password': generate_password_hash('Admin123!'),
        'first_name': 'System',
        'last_name': 'Administrator',
        'role': 'admin',
        'is_active': True,
        'is_staff': True,
        'is_superuser': True,
        'date_joined': datetime.now(),
        'last_login': datetime.now() - timedelta(days=random.randint(0, 30)),
        'phone': generate_phone(),
        'birthday': (datetime.now() - timedelta(days=365*random.randint(30, 60))).strftime('%Y-%m-%d'),
        'gender': random.choice(['male', 'female']),
        'address': generate_address()
    }
    users.append(admin)
    
    # Create doctor users
    doctor_users = []
    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        doctor_id = str(uuid.uuid4())
        doctor_user = {
            'id': doctor_id,
            'email': generate_email(first_name, last_name),
            'username': f"dr.{first_name.lower()}{random.randint(1, 999)}",
            'password': generate_password_hash('Doctor123!'),
            'first_name': first_name,
            'last_name': last_name,
            'role': 'doctor',
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'date_joined': datetime.now() - timedelta(days=random.randint(1, 365)),
            'last_login': datetime.now() - timedelta(days=random.randint(0, 30)),
            'phone': generate_phone(),
            'birthday': (datetime.now() - timedelta(days=365*random.randint(30, 70))).strftime('%Y-%m-%d'),
            'gender': random.choice(['male', 'female']),
            'address': generate_address()
        }
        users.append(doctor_user)
        doctor_users.append(doctor_user)
    
    # Create patient users
    patient_users = []
    for i in range(count):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        patient_id = str(uuid.uuid4())
        patient_user = {
            'id': patient_id,
            'email': generate_email(first_name, last_name),
            'username': f"{first_name.lower()}{random.randint(1, 999)}",
            'password': generate_password_hash('Patient123!'),
            'first_name': first_name,
            'last_name': last_name,
            'role': 'patient',
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'date_joined': datetime.now() - timedelta(days=random.randint(1, 365)),
            'last_login': datetime.now() - timedelta(days=random.randint(0, 30)),
            'phone': generate_phone(),
            'birthday': (datetime.now() - timedelta(days=365*random.randint(18, 80))).strftime('%Y-%m-%d'),
            'gender': random.choice(['male', 'female', 'other']),
            'address': generate_address(),
            'medical_history': random.choice(MEDICAL_CONDITIONS) if random.random() > 0.3 else '',
            'chronic_diseases': random.choice(MEDICAL_CONDITIONS) if random.random() > 0.5 else ''
        }
        users.append(patient_user)
        patient_users.append(patient_user)
    
    # Create a test doctor and patient with known credentials
    test_doctor = {
        'id': str(uuid.uuid4()),
        'email': 'doctor@example.com',
        'username': 'testdoctor',
        'password': generate_password_hash('Doctor123!'),
        'first_name': 'Test',
        'last_name': 'Doctor',
        'role': 'doctor',
        'is_active': True,
        'is_staff': False,
        'is_superuser': False,
        'date_joined': datetime.now() - timedelta(days=30),
        'last_login': datetime.now() - timedelta(days=1),
        'phone': generate_phone(),
        'birthday': (datetime.now() - timedelta(days=365*40)).strftime('%Y-%m-%d'),
        'gender': 'male',
        'address': generate_address()
    }
    users.append(test_doctor)
    doctor_users.append(test_doctor)
    
    test_patient = {
        'id': str(uuid.uuid4()),
        'email': 'patient@example.com',
        'username': 'testpatient',
        'password': generate_password_hash('Patient123!'),
        'first_name': 'Test',
        'last_name': 'Patient',
        'role': 'patient',
        'is_active': True,
        'is_staff': False,
        'is_superuser': False,
        'date_joined': datetime.now() - timedelta(days=30),
        'last_login': datetime.now() - timedelta(days=1),
        'phone': generate_phone(),
        'birthday': (datetime.now() - timedelta(days=365*30)).strftime('%Y-%m-%d'),
        'gender': 'female',
        'address': generate_address(),
        'medical_history': 'Asthma',
        'chronic_diseases': 'Allergic Rhinitis'
    }
    users.append(test_patient)
    patient_users.append(test_patient)
    
    # Insert all users
    if users:
        db.users.insert_many(users)
        print(f"Created {len(users)} users ({len(doctor_users)} doctors, {len(patient_users)} patients, 1 admin)")
    
    return doctor_users, patient_users

def create_doctors(db, doctor_users):
    """Create doctor profiles for doctor users"""
    doctors = []
    
    for user in doctor_users:
        doctor_id = str(uuid.uuid4())
        specialization = random.choice(SPECIALIZATIONS)
        qualification = random.choice(QUALIFICATIONS)
        experience_years = random.randint(1, 30)
        consultation_fee = round(random.uniform(50, 300), 2)
        medical_center = random.choice(MEDICAL_CENTERS)
        
        # Generate available days
        days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
        available_days = random.sample(days, random.randint(2, 5))
        available_days_str = ",".join(available_days)
        
        doctor = {
            'id': doctor_id,
            'user_id': user['id'],
            'name': f"Dr. {user['first_name']} {user['last_name']}",
            'email': user['email'],
            'phone': user['phone'],
            'specialization': specialization,
            'qualification': qualification,
            'experience_years': experience_years,
            'consultation_fee': str(consultation_fee),
            'available_days': available_days_str,
            'bio': f"Dr. {user['last_name']} is a {specialization} specialist with {experience_years} years of experience. "
                  f"Graduated with {qualification} and specializes in treating various conditions.",
            'medical_center': medical_center,
            'medical_center_name': medical_center,
            'emergency_available': random.choice([True, False]),
            'daily_patient_limit': random.randint(8, 20),
            'is_available': True,
            'created_at': datetime.now()
        }
        doctors.append(doctor)
        
        # Create day-specific data for availability
        day_specific_data = {}
        for day in available_days:
            start_hour = random.randint(8, 10)
            end_hour = random.randint(16, 19)
            day_specific_data[day] = {
                'start_time': f"{start_hour:02d}:00",
                'end_time': f"{end_hour:02d}:00"
            }
        
        # Create availability record
        availability = {
            'doctor_id': doctor_id,
            'doctor_name': f"Dr. {user['first_name']} {user['last_name']}",
            'available_days': available_days_str,
            'day_specific_data': day_specific_data
        }
        db.doctor_availability.insert_one(availability)
        
        # Create some exceptions
        exceptions_count = random.randint(0, 3)
        for _ in range(exceptions_count):
            future_date = datetime.now() + timedelta(days=random.randint(1, 60))
            exception = {
                'id': str(uuid.uuid4()),
                'doctor_id': doctor_id,
                'date': future_date.strftime('%Y-%m-%d'),
                'is_available': False,
                'reason': random.choice(["Out of office", "Conference", "Personal leave", "Holiday"])
            }
            db.doctor_exceptions.insert_one(exception)
    
    if doctors:
        db.doctors.insert_many(doctors)
        print(f"Created {len(doctors)} doctor profiles with availability and exceptions")
    
    return doctors

def create_patients(db, patient_users):
    """Create patient profiles for patient users"""
    patients = []
    
    for user in patient_users:
        patient = {
            'id': str(uuid.uuid4()),
            'user_id': user['id'],
            'name': f"{user['first_name']} {user['last_name']}",
            'email': user['email'],
            'phone': user['phone'],
            'date_of_birth': user['birthday'],
            'gender': user['gender'],
            'address': user['address'],
            'medical_history': user.get('medical_history', ''),
            'allergies': random.choice(ALLERGIES) if random.random() > 0.7 else '',
            'medications': random.choice(MEDICATIONS) if random.random() > 0.7 else '',
            'blood_type': random.choice(BLOOD_TYPES) if random.random() > 0.5 else '',
            'chronic_diseases': user.get('chronic_diseases', ''),
            'created_at': datetime.now()
        }
        patients.append(patient)
    
    if patients:
        db.patients.insert_many(patients)
        print(f"Created {len(patients)} patient profiles")
    
    return patients

def create_appointments(db, doctors, patient_users, count=50):
    """Create appointments between doctors and patients"""
    appointments = []
    
    # Get all available days for each doctor
    doctor_availability = {}
    for doctor in doctors:
        doctor_id = doctor['id']
        avail = db.doctor_availability.find_one({'doctor_id': doctor_id})
        if avail:
            doctor_availability[doctor_id] = {
                'days': avail['available_days'].split(','),
                'day_specific_data': avail.get('day_specific_data', {})
            }
    
    # Get all exceptions
    exceptions = list(db.doctor_exceptions.find({}))
    exception_dates = {(ex['doctor_id'], ex['date']) for ex in exceptions}
    
    # Create appointments with different statuses and dates
    for i in range(count):
        # Select random doctor and patient
        doctor = random.choice(doctors)
        patient = random.choice(patient_users)
        
        # Get doctor's available days
        avail = doctor_availability.get(doctor['id'], {'days': ['monday', 'wednesday', 'friday'], 'day_specific_data': {}})
        available_days = avail['days']
        day_specific_data = avail['day_specific_data']
        
        # Generate appointment date
        days_ahead = random.randint(-30, 60)  # Some past, some future
        appointment_date = datetime.now() + timedelta(days=days_ahead)
        
        # Adjust to an available day of the week
        day_name = appointment_date.strftime('%A').lower()
        attempts = 0
        while day_name not in available_days and attempts < 7:
            appointment_date += timedelta(days=1)
            day_name = appointment_date.strftime('%A').lower()
            attempts += 1
        
        # Skip if we couldn't find an available day
        if attempts >= 7:
            continue
        
        # Check for exceptions
        date_str = appointment_date.strftime('%Y-%m-%d')
        if (doctor['id'], date_str) in exception_dates:
            continue
        
        # Generate appointment time
        day_data = day_specific_data.get(day_name, {'start_time': '09:00', 'end_time': '17:00'})
        start_hour = int(day_data['start_time'].split(':')[0])
        end_hour = int(day_data['end_time'].split(':')[0])
        
        hour = random.randint(start_hour, end_hour-1)
        minute = random.choice([0, 30])
        appointment_date = appointment_date.replace(hour=hour, minute=minute)
        
        # Determine status based on date
        if appointment_date < datetime.now():
            status = random.choice(["completed", "cancelled"]) if random.random() > 0.2 else "completed"
        else:
            status = "scheduled"
        
        # Create appointment
        appointment = {
            'id': str(uuid.uuid4()),
            'patient': patient['id'],
            'patient_name': f"{patient['first_name']} {patient['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
            'date': appointment_date.strftime('%Y-%m-%dT%H:%M:%S'),
            'status': status,
            'notes': random.choice(APPOINTMENT_REASONS),
            'reason_for_visit': random.choice(APPOINTMENT_REASONS),
            'blood_type': random.choice(BLOOD_TYPES) if random.random() > 0.5 else '',
            'medications': random.choice(MEDICATIONS) if random.random() > 0.7 else '',
            'allergies': random.choice(ALLERGIES) if random.random() > 0.7 else '',
            'medical_conditions': random.choice(MEDICAL_CONDITIONS) if random.random() > 0.5 else '',
            'patient_phone': patient.get('phone', ''),
            'gender': patient.get('gender', ''),
            'address': patient.get('address', ''),
            'chronic_diseases': patient.get('chronic_diseases', '')
        }
        appointments.append(appointment)
    
    # Create some appointments for today to test concurrent booking
    today = datetime.now()
    for hour in [10, 14]:
        for doctor in doctors[:3]:  # Use first 3 doctors
            for patient in patient_users[:2]:  # Use first 2 patients
                appointment_date = today.replace(hour=hour, minute=0)
                
                # Create appointment
                appointment = {
                    'id': str(uuid.uuid4()),
                    'patient': patient['id'],
                    'patient_name': f"{patient['first_name']} {patient['last_name']}",
                    'doctor': doctor['id'],
                    'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
                    'date': appointment_date.strftime('%Y-%m-%dT%H:%M:%S'),
                    'status': "scheduled",
                    'notes': "Same-day appointment",
                    'reason_for_visit': "Urgent consultation",
                    'blood_type': random.choice(BLOOD_TYPES),
                    'medications': random.choice(MEDICATIONS),
                    'allergies': random.choice(ALLERGIES),
                    'medical_conditions': random.choice(MEDICAL_CONDITIONS),
                    'patient_phone': patient.get('phone', ''),
                    'gender': patient.get('gender', ''),
                    'address': patient.get('address', ''),
                    'chronic_diseases': patient.get('chronic_diseases', '')
                }
                appointments.append(appointment)
    
    if appointments:
        db.appointments.insert_many(appointments)
        print(f"Created {len(appointments)} appointments")
        
        # Print statistics
        scheduled = sum(1 for a in appointments if a['status'] == 'scheduled')
        completed = sum(1 for a in appointments if a['status'] == 'completed')
        cancelled = sum(1 for a in appointments if a['status'] == 'cancelled')
        print(f"  - {scheduled} scheduled, {completed} completed, {cancelled} cancelled")
        
        # Print some upcoming appointments for testing
        upcoming = [a for a in appointments if a['status'] == 'scheduled' and a['date'] > datetime.now().strftime('%Y-%m-%dT%H:%M:%S')]
        if upcoming:
            print("\nSome upcoming appointments for testing:")
            for i, appt in enumerate(upcoming[:5]):
                print(f"  {i+1}. {appt['date']} - {appt['patient_name']} with {appt['doctor_name']}")

def create_edge_cases(db, doctors, patient_users):
    """Create edge cases for testing"""
    print("\nCreating edge cases for testing...")
    
    # 1. Concurrent appointments (same doctor, same time)
    if doctors and patient_users and len(patient_users) >= 2:
        doctor = doctors[0]
        patient1 = patient_users[0]
        patient2 = patient_users[1]
        
        # Set appointment time to tomorrow at 10:00 AM
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=10, minute=0)
        
        # Create two appointments for the same time
        appointment1 = {
            'id': str(uuid.uuid4()),
            'patient': patient1['id'],
            'patient_name': f"{patient1['first_name']} {patient1['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
            'date': appointment_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'status': "scheduled",
            'notes': "EDGE CASE: Concurrent appointment 1",
            'reason_for_visit': "Testing concurrent booking",
            'patient_phone': patient1.get('phone', '')
        }
        
        appointment2 = {
            'id': str(uuid.uuid4()),
            'patient': patient2['id'],
            'patient_name': f"{patient2['first_name']} {patient2['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
            'date': appointment_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'status': "scheduled",
            'notes': "EDGE CASE: Concurrent appointment 2",
            'reason_for_visit': "Testing concurrent booking",
            'patient_phone': patient2.get('phone', '')
        }
        
        db.appointments.insert_many([appointment1, appointment2])
        print(f"Created edge case: Concurrent appointments for {doctor['name']} at {appointment_time.strftime('%Y-%m-%d %H:%M')}")
    
    # 2. Appointment outside doctor's available hours
    if doctors and patient_users:
        doctor = doctors[0]
        patient = patient_users[0]
        
        # Set appointment time to tomorrow at 3:00 AM (likely outside hours)
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=3, minute=0)
        
        appointment = {
            'id': str(uuid.uuid4()),
            'patient': patient['id'],
            'patient_name': f"{patient['first_name']} {patient['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
            'date': appointment_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'status': "scheduled",
            'notes': "EDGE CASE: Appointment outside hours",
            'reason_for_visit': "Testing outside hours booking",
            'patient_phone': patient.get('phone', '')
        }
        
        db.appointments.insert_one(appointment)
        print(f"Created edge case: Appointment outside hours for {doctor['name']} at {appointment_time.strftime('%Y-%m-%d %H:%M')}")
    
    # 3. Appointment on doctor's exception day
    if doctors and patient_users:
        doctor = doctors[0]
        patient = patient_users[0]
        
        # Create an exception for the doctor
        exception_date = datetime.now() + timedelta(days=2)
        exception = {
            'id': str(uuid.uuid4()),
            'doctor_id': doctor['id'],
            'date': exception_date.strftime('%Y-%m-%d'),
            'is_available': False,
            'reason': "EDGE CASE: Testing exception"
        }
        db.doctor_exceptions.insert_one(exception)
        
        # Create appointment on the exception day
        appointment_time = exception_date.replace(hour=10, minute=0)
        appointment = {
            'id': str(uuid.uuid4()),
            'patient': patient['id'],
            'patient_name': f"{patient['first_name']} {patient['last_name']}",
            'doctor': doctor['id'],
            'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
            'date': appointment_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'status': "scheduled",
            'notes': "EDGE CASE: Appointment on exception day",
            'reason_for_visit': "Testing exception day booking",
            'patient_phone': patient.get('phone', '')
        }
        
        db.appointments.insert_one(appointment)
        print(f"Created edge case: Appointment on exception day for {doctor['name']} at {appointment_time.strftime('%Y-%m-%d %H:%M')}")
    
    # 4. Appointment exceeding doctor's daily limit
    if doctors and patient_users and len(patient_users) >= 5:
        doctor = doctors[0]
        
        # Set a low daily limit for the doctor
        db.doctors.update_one(
            {'id': doctor['id']},
            {'$set': {'daily_limit': 3}}
        )
        
        # Create appointments for the same day exceeding the limit
        day_after_tomorrow = datetime.now() + timedelta(days=3)
        base_time = day_after_tomorrow.replace(hour=9, minute=0)
        
        appointments = []
        for i in range(5):  # Create 5 appointments (exceeding the limit of 3)
            patient = patient_users[i]
            appointment_time = base_time + timedelta(hours=i)
            
            appointment = {
                'id': str(uuid.uuid4()),
                'patient': patient['id'],
                'patient_name': f"{patient['first_name']} {patient['last_name']}",
                'doctor': doctor['id'],
                'doctor_name': f"Dr. {doctor['first_name']} {doctor['last_name']}",
                'date': appointment_time.strftime('%Y-%m-%dT%H:%M:%S'),
                'status': "scheduled",
                'notes': f"EDGE CASE: Exceeding daily limit - Appointment {i+1}",
                'reason_for_visit': "Testing daily limit",
                'patient_phone': patient.get('phone', '')
            }
            appointments.append(appointment)
        
        db.appointments.insert_many(appointments)
        print(f"Created edge case: {len(appointments)} appointments exceeding daily limit for {doctor['name']}")

def main():
    parser = argparse.ArgumentParser(description='Populate MongoDB with test data for Medical Appointment System')
    parser.add_argument('--uri', default='mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/', help='MongoDB connection URI')
    parser.add_argument('--db', default='hcams', help='Database name')
    parser.add_argument('--count', type=int, default=20, help='Number of users of each type to create')
    parser.add_argument('--appointments', type=int, default=50, help='Number of appointments to create')
    parser.add_argument('--clear', action='store_true', help='Clear existing data before populating')
    
    args = parser.parse_args()
    
    try:
        # Connect to MongoDB
        client = MongoClient(args.uri)
        db = client[args.db]
        
        print(f"Connected to MongoDB at {args.uri}, database: {args.db}")
        
        # Clear existing data if requested
        if args.clear:
            db.users.delete_many({})
            db.doctors.delete_many({})
            db.patients.delete_many({})
            db.appointments.delete_many({})
            db.doctor_availability.delete_many({})
            db.doctor_exceptions.delete_many({})
            print("Cleared existing data")
        
        # Create users
        doctor_users, patient_users = create_users(db, args.count)
        
        # Create doctor profiles
        doctors = create_doctors(db, doctor_users)
        
        # Create patient profiles
        patients = create_patients(db, patient_users)
        
        # Create appointments
        create_appointments(db, doctors, patient_users, args.appointments)
        
        # Create edge cases for testing
        create_edge_cases(db, doctors, patient_users)
        
        print("\nDatabase population completed successfully!")
        print("\nLogin credentials:")
        print("  Admin: admin@medical-system.com / Admin123!")
        print("  Doctor: doctor@example.com / Doctor123!")
        print("  Patient: patient@example.com / Patient123!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
