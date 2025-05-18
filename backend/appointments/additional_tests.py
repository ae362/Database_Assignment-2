# additional_tests.py
import os
import json
import bcrypt
import pymongo
import uuid
import random
from datetime import datetime, timedelta
import jwt
import base64
from io import BytesIO

# Import color codes from the previous script
from comprehensive_debug import (
    Colors, print_header, print_subheader, 
    print_success, print_warning, print_error, print_info,
    get_mongodb_client, generate_token, get_user_from_token
)

def test_medical_centers(db):
    """Test medical center management"""
    print_subheader("Testing Medical Center Management")
    
    # Create a new medical center
    center_id = str(uuid.uuid4())
    medical_center = {
        'id': center_id,
        'name': f'Test Medical Center {random.randint(1000, 9999)}',
        'address': '789 Hospital Ave',
        'phone': '555-HOSPITAL',
        'email': f'center{random.randint(1000, 9999)}@example.com',
        'website': 'https://testcenter.example.com',
        'created_at': datetime.now()
    }
    
    # Insert medical center
    db.medical_centers.insert_one(medical_center)
    print_success(f"Created medical center: {medical_center['name']}")
    
    # Get all medical centers
    centers = list(db.medical_centers.find())
    print_info(f"Found {len(centers)} medical centers in the database")
    
    # Get specific medical center
    center = db.medical_centers.find_one({'id': center_id})
    if center:
        print_success(f"Retrieved medical center: {center['name']}")
        
        # Update medical center
        db.medical_centers.update_one(
            {'id': center_id},
            {'$set': {'phone': '555-NEWPHONE', 'website': 'https://updated.example.com'}}
        )
        
        # Get updated medical center
        updated_center = db.medical_centers.find_one({'id': center_id})
        if updated_center and updated_center['phone'] == '555-NEWPHONE':
            print_success(f"Updated medical center phone to: {updated_center['phone']}")
        else:
            print_error("Failed to update medical center")
        
        # Associate doctors with medical center
        doctors = list(db.doctors.find().limit(2))
        for doctor in doctors:
            db.doctors.update_one(
                {'id': doctor['id']},
                {'$set': {'medical_center': center_id, 'medical_center_name': center['name']}}
            )
            print_success(f"Associated doctor {doctor['name']} with medical center")
        
        # Get doctors for this medical center
        center_doctors = list(db.doctors.find({'medical_center': center_id}))
        print_info(f"Found {len(center_doctors)} doctors associated with this medical center")
        
        # Delete medical center
        db.medical_centers.delete_one({'id': center_id})
        
        # Verify deletion
        deleted_center = db.medical_centers.find_one({'id': center_id})
        if not deleted_center:
            print_success("Medical center deleted successfully")
        else:
            print_error("Failed to delete medical center")
        
        # Clean up - remove medical center association from doctors
        for doctor in doctors:
            db.doctors.update_one(
                {'id': doctor['id']},
                {'$set': {'medical_center': None, 'medical_center_name': ''}}
            )
    else:
        print_error(f"Medical center not found with ID: {center_id}")

def test_appointment_conflicts(db, users):
    """Test appointment conflict detection"""
    print_subheader("Testing Appointment Conflict Detection")
    
    # Find a doctor
    doctor = list(db.doctors.find())[0] if list(db.doctors.find()) else None
    if not doctor:
        print_error("No doctors found in the database")
        return
    
    # Find a patient
    patient = db.users.find_one({'email': users['patient']['email']})
    if not patient:
        print_error(f"Patient not found: {users['patient']['email']}")
        return
    
    # Create an appointment
    appointment_date = datetime.now() + timedelta(days=3)
    appointment_date = appointment_date.replace(hour=14, minute=0, second=0, microsecond=0)  # 2:00 PM
    
    appointment1_id = str(uuid.uuid4())
    appointment1 = {
        'id': appointment1_id,
        'patient': patient['id'],
        'patient_name': f"{patient['first_name']} {patient['last_name']}",
        'doctor': doctor['id'],
        'doctor_name': doctor['name'],
        'date': appointment_date,
        'notes': 'First test appointment',
        'status': 'scheduled',
        'created_at': datetime.now()
    }
    
    # Insert first appointment
    db.appointments.insert_one(appointment1)
    print_success(f"Created first appointment at {appointment_date.strftime('%Y-%m-%d %H:%M')}")
    
    # Try to create a conflicting appointment (same time)
    appointment2_id = str(uuid.uuid4())
    appointment2 = {
        'id': appointment2_id,
        'patient': patient['id'],
        'patient_name': f"{patient['first_name']} {patient['last_name']}",
        'doctor': doctor['id'],
        'doctor_name': doctor['name'],
        'date': appointment_date,
        'notes': 'Conflicting appointment',
        'status': 'scheduled',
        'created_at': datetime.now()
    }
    
    # Check for conflicts
    conflict = db.appointments.find_one({
        'doctor': doctor['id'],
        'date': appointment_date,
        'status': 'scheduled'
    })
    
    if conflict:
        print_success("Conflict detected correctly")
        print_info(f"Conflicting appointment: {conflict['id']} at {conflict['date'].strftime('%Y-%m-%d %H:%M')}")
    else:
        print_error("Failed to detect appointment conflict")
        # Insert the conflicting appointment anyway for testing
        db.appointments.insert_one(appointment2)
    
    # Try a non-conflicting appointment (different time)
    non_conflict_date = appointment_date + timedelta(hours=1)  # 3:00 PM
    appointment3_id = str(uuid.uuid4())
    appointment3 = {
        'id': appointment3_id,
        'patient': patient['id'],
        'patient_name': f"{patient['first_name']} {patient['last_name']}",
        'doctor': doctor['id'],
        'doctor_name': doctor['name'],
        'date': non_conflict_date,
        'notes': 'Non-conflicting appointment',
        'status': 'scheduled',
        'created_at': datetime.now()
    }
    
    # Check for conflicts
    conflict = db.appointments.find_one({
        'doctor': doctor['id'],
        'date': non_conflict_date,
        'status': 'scheduled'
    })
    
    if not conflict:
        print_success("No conflict detected for different time slot")
        db.appointments.insert_one(appointment3)
        print_success(f"Created non-conflicting appointment at {non_conflict_date.strftime('%Y-%m-%d %H:%M')}")
    else:
        print_error("Incorrectly detected conflict for different time slot")
    
    # Clean up
    db.appointments.delete_one({'id': appointment1_id})
    db.appointments.delete_one({'id': appointment2_id})
    db.appointments.delete_one({'id': appointment3_id})
    print_success("Deleted test appointments")

def test_doctor_specialization_filtering(db):
    """Test filtering doctors by specialization"""
    print_subheader("Testing Doctor Specialization Filtering")
    
    # Create doctors with different specializations
    specializations = ['Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'Orthopedics']
    doctor_ids = []
    
    for specialization in specializations:
        doctor_id = str(uuid.uuid4())
        doctor = {
            'id': doctor_id,
            'name': f'Dr. {specialization}',
            'specialization': specialization,
            'email': f'{specialization.lower()}_{random.randint(1000, 9999)}@example.com',
            'phone': f'555-{random.randint(1000, 9999)}',
            'is_available': True,
            'created_at': datetime.now()
        }
        
        db.doctors.insert_one(doctor)
        doctor_ids.append(doctor_id)
        print_success(f"Created doctor with specialization: {specialization}")
    
    # Test filtering by each specialization
    for specialization in specializations:
        doctors = list(db.doctors.find({'specialization': specialization}))
        print_info(f"Found {len(doctors)} doctors with specialization: {specialization}")
        
        if len(doctors) > 0:
            print_success(f"Successfully filtered doctors by specialization: {specialization}")
        else:
            print_error(f"Failed to filter doctors by specialization: {specialization}")
    
    # Test filtering by multiple specializations
    test_specializations = ['Cardiology', 'Neurology']
    doctors = list(db.doctors.find({'specialization': {'$in': test_specializations}}))
    print_info(f"Found {len(doctors)} doctors with specializations in {test_specializations}")
    
    if len(doctors) > 0:
        print_success(f"Successfully filtered doctors by multiple specializations")
    else:
        print_error(f"Failed to filter doctors by multiple specializations")
    
    # Clean up
    for doctor_id in doctor_ids:
        db.doctors.delete_one({'id': doctor_id})
    
    print_success(f"Deleted {len(doctor_ids)} test doctors")

def test_pagination(db):
    """Test pagination for large result sets"""
    print_subheader("Testing Pagination")
    
    # Create multiple test patients
    num_patients = 25
    patient_ids = []
    
    for i in range(num_patients):
        patient_id = str(uuid.uuid4())
        patient = {
            'id': patient_id,
            'name': f'Test Patient {i+1}',
            'email': f'pagination_test_{i+1}@example.com',
            'created_at': datetime.now()
        }
        
        db.patients.insert_one(patient)
        patient_ids.append(patient_id)
    
    print_success(f"Created {num_patients} test patients for pagination")
    
    # Test pagination
    page_size = 10
    total_pages = (num_patients + page_size - 1) // page_size  # Ceiling division
    
    for page in range(1, total_pages + 1):
        skip = (page - 1) * page_size
        limit = page_size
        
        patients = list(db.patients.find({'email': {'$regex': '^pagination_test_'}}).skip(skip).limit(limit))
        
        print_info(f"Page {page}: Retrieved {len(patients)} patients")
        
        if len(patients) > 0:
            print_success(f"Successfully retrieved page {page}")
        else:
            print_error(f"Failed to retrieve page {page}")
    
    # Clean up
    for patient_id in patient_ids:
        db.patients.delete_one({'id': patient_id})
    
    print_success(f"Deleted {len(patient_ids)} test patients")

def test_search_functionality(db):
    """Test search functionality"""
    print_subheader("Testing Search Functionality")
    
    # Create test data with searchable names
    search_terms = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown']
    patient_ids = []
    
    for term in search_terms:
        patient_id = str(uuid.uuid4())
        patient = {
            'id': patient_id,
            'name': f'{term} TestPatient',
            'email': f'{term.lower()}_{random.randint(1000, 9999)}@example.com',
            'created_at': datetime.now()
        }
        
        db.patients.insert_one(patient)
        patient_ids.append(patient_id)
    
    print_success(f"Created {len(search_terms)} test patients for search testing")
    
    # Test exact search
    for term in search_terms:
        patients = list(db.patients.find({'name': {'$regex': term, '$options': 'i'}}))
        
        print_info(f"Search for '{term}': Found {len(patients)} patients")
        
        if len(patients) > 0:
            print_success(f"Successfully searched for '{term}'")
        else:
            print_error(f"Failed to search for '{term}'")
    
    # Test partial search
    partial_term = 'son'  # Should match Johnson
    patients = list(db.patients.find({'name': {'$regex': partial_term, '$options': 'i'}}))
    
    print_info(f"Partial search for '{partial_term}': Found {len(patients)} patients")
    
    if len(patients) > 0:
        print_success(f"Successfully performed partial search for '{partial_term}'")
    else:
        print_error(f"Failed to perform partial search for '{partial_term}'")
    
    # Clean up
    for patient_id in patient_ids:
        db.patients.delete_one({'id': patient_id})
    
    print_success(f"Deleted {len(patient_ids)} test patients")

def test_file_uploads(db, users):
    """Test file uploads for medical records or profile images"""
    print_subheader("Testing File Uploads")
    
    # Find a patient
    patient = db.users.find_one({'email': users['patient']['email']})
    if not patient:
        print_error(f"Patient not found: {users['patient']['email']}")
        return
    
    # Create a mock file (base64 encoded)
    mock_image_data = base64.b64encode(b"This is a mock image file").decode('utf-8')
    
    # Create a medical record
    record_id = str(uuid.uuid4())
    medical_record = {
        'id': record_id,
        'patient_id': patient['id'],
        'file_name': 'test_medical_record.pdf',
        'file_type': 'application/pdf',
        'file_data': mock_image_data,
        'upload_date': datetime.now(),
        'description': 'Test medical record'
    }
    
    # Insert medical record
    db.medical_records.insert_one(medical_record)
    print_success(f"Created medical record: {medical_record['file_name']}")
    
    # Get medical records for patient
    records = list(db.medical_records.find({'patient_id': patient['id']}))
    print_info(f"Found {len(records)} medical records for patient")
    
    if len(records) > 0:
        print_success(f"Successfully retrieved medical records")
    else:
        print_error(f"Failed to retrieve medical records")
    
    # Update profile image for patient
    db.users.update_one(
        {'id': patient['id']},
        {'$set': {'avatar': mock_image_data}}
    )
    
    # Get updated patient
    updated_patient = db.users.find_one({'id': patient['id']})
    if updated_patient and 'avatar' in updated_patient:
        print_success(f"Successfully updated patient profile image")
    else:
        print_error(f"Failed to update patient profile image")
    
    # Clean up
    db.medical_records.delete_one({'id': record_id})
    db.users.update_one(
        {'id': patient['id']},
        {'$unset': {'avatar': ""}}
    )
    
    print_success("Deleted test medical record and profile image")

def test_appointment_statistics(db):
    """Test appointment statistics and analytics"""
    print_subheader("Testing Appointment Statistics")
    
    # Create test appointments with different statuses
    statuses = ['scheduled', 'completed', 'cancelled']
    appointment_ids = []
    
    # Create 5 appointments for each status
    for status in statuses:
        for i in range(5):
            appointment_id = str(uuid.uuid4())
            appointment = {
                'id': appointment_id,
                'patient': f'test_patient_{i}',
                'patient_name': f'Test Patient {i}',
                'doctor': f'test_doctor_{i}',
                'doctor_name': f'Test Doctor {i}',
                'date': datetime.now() + timedelta(days=i),
                'status': status,
                'created_at': datetime.now()
            }
            
            db.appointments.insert_one(appointment)
            appointment_ids.append(appointment_id)
    
    print_success(f"Created {len(appointment_ids)} test appointments for statistics")
    
    # Get appointment counts by status
    pipeline = [
        {
            '$group': {
                '_id': '$status',
                'count': {'$sum': 1}
            }
        }
    ]
    
    status_counts = list(db.appointments.aggregate(pipeline))
    
    for status_count in status_counts:
        status = status_count['_id']
        count = status_count['count']
        print_info(f"Status '{status}': {count} appointments")
    
    # Get appointments by day of week
    pipeline = [
        {
            '$project': {
                'dayOfWeek': {'$dayOfWeek': '$date'},
                'status': 1
            }
        },
        {
            '$group': {
                '_id': {'dayOfWeek': '$dayOfWeek', 'status': '$status'},
                'count': {'$sum': 1}
            }
        },
        {
            '$sort': {'_id.dayOfWeek': 1, '_id.status': 1}
        }
    ]
    
    day_counts = list(db.appointments.aggregate(pipeline))
    
    days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    for day_count in day_counts:
        day_index = day_count['_id']['dayOfWeek'] - 1  # MongoDB dayOfWeek is 1-7 (Sunday-Saturday)
        day = days[day_index]
        status = day_count['_id']['status']
        count = day_count['count']
        print_info(f"{day} - {status}: {count} appointments")
    
    # Clean up
    for appointment_id in appointment_ids:
        db.appointments.delete_one({'id': appointment_id})
    
    print_success(f"Deleted {len(appointment_ids)} test appointments")

def main():
    print_header("Additional MongoDB Healthcare System Tests")
    
    # Get MongoDB client
    client = get_mongodb_client()
    if not client:
        return
    
    # Get database
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
    # Get test users
    users = {
        'patient': {
            'email': 'patient_7008@example.com',  # Use the email from the previous test
            'password': 'password123'
        },
        'doctor': {
            'email': 'doctor_3622@example.com',  # Use the email from the previous test
            'password': 'password123'
        },
        'admin': {
            'email': 'admin_3436@example.com',  # Use the email from the previous test
            'password': 'password123'
        }
    }
    
    # Run additional tests
    test_medical_centers(db)
    test_appointment_conflicts(db, users)
    test_doctor_specialization_filtering(db)
    test_pagination(db)
    test_search_functionality(db)
    test_file_uploads(db, users)
    test_appointment_statistics(db)
    
    print_header("Additional Testing Complete")

if __name__ == "__main__":
    main()