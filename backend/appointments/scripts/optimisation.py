import os
import pymongo
from bson.objectid import ObjectId
from datetime import datetime
import uuid
import sys
import json

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

def backup_collection(db, collection_name):
    """Create a backup of a collection"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup_name = f"{collection_name}_backup_{timestamp}"
    
    try:
        # Check if collection exists
        if collection_name not in db.list_collection_names():
            print(f"Collection {collection_name} does not exist, skipping backup")
            return None
        
        # Create backup collection
        db[collection_name].aggregate([
            {"$match": {}},
            {"$out": backup_name}
        ])
        
        print(f"Created backup of {collection_name} as {backup_name}")
        return backup_name
    except Exception as e:
        print(f"Error backing up collection {collection_name}: {str(e)}")
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

def analyze_schema(db):
    """Analyze the current database schema and identify issues"""
    print("Analyzing database schema...")
    
    issues = []
    
    # Check appointments collection for medical data
    if "appointments" in db.list_collection_names():
        sample_appointment = db.appointments.find_one({
            "$or": [
                {"blood_type": {"$exists": True}},
                {"allergies": {"$exists": True}},
                {"medications": {"$exists": True}},
                {"medical_conditions": {"$exists": True}}
            ]
        })
        
        if sample_appointment:
            issues.append({
                "collection": "appointments",
                "issue": "Medical data found in appointments collection",
                "fields": [field for field in ["blood_type", "allergies", "medications", "medical_conditions"] 
                          if field in sample_appointment],
                "fix": "Move medical data to patients collection"
            })
    
    # Check for missing indexes
    collections_to_check = {
        "users": ["id", "email", "role"],
        "patients": ["id", "user_id", "email", "name", "blood_type"],
        "doctors": ["id", "user_id", "specialization", "name"],
        "appointments": ["id", "patient", "doctor", "date", "status"]
    }
    
    for collection_name, expected_indexes in collections_to_check.items():
        if collection_name in db.list_collection_names():
            # Get existing indexes
            existing_indexes = list(db[collection_name].list_indexes())
            existing_index_keys = {}
            
            # Map index keys to index names
            for idx in existing_indexes:
                key_tuple = tuple(sorted([(k, v) for k, v in idx["key"].items()]))
                existing_index_keys[key_tuple] = idx["name"]
            
            missing_indexes = []
            for field in expected_indexes:
                # Check if there's an index on this field
                key_tuple = tuple(sorted([(field, 1)]))
                if key_tuple not in existing_index_keys and field != "_id":
                    missing_indexes.append(field)
            
            if missing_indexes:
                issues.append({
                    "collection": collection_name,
                    "issue": "Missing indexes",
                    "fields": missing_indexes,
                    "fix": f"Create indexes for {', '.join(missing_indexes)}"
                })
    
    # Check for appointment conflict resolution mechanism
    if "appointments" in db.list_collection_names():
        has_conflict_index = False
        for idx in db.appointments.list_indexes():
            # Check if there's a compound index on doctor and date
            if "key" in idx and "doctor" in idx["key"] and "date" in idx["key"]:
                has_conflict_index = True
                break
        
        if not has_conflict_index:
            issues.append({
                "collection": "appointments",
                "issue": "Missing appointment conflict resolution mechanism",
                "fix": "Create compound index on doctor and date fields with unique constraint"
            })
    
    # Check for denormalization in appointments
    if "appointments" in db.list_collection_names():
        sample_appointment = db.appointments.find_one({})
        if sample_appointment and (
            "patientInfo" not in sample_appointment or 
            "doctorInfo" not in sample_appointment
        ):
            issues.append({
                "collection": "appointments",
                "issue": "Missing denormalized patient and doctor info",
                "fix": "Embed patient and doctor info in appointments"
            })
    
    # Print issues
    if issues:
        print(f"Found {len(issues)} issues with the database schema:")
        for i, issue in enumerate(issues, 1):
            print(f"{i}. {issue['collection']}: {issue['issue']}")
            if "fields" in issue:
                print(f"   Fields: {', '.join(issue['fields'])}")
            print(f"   Fix: {issue['fix']}")
    else:
        print("No issues found with the database schema.")
    
    return issues

def fix_medical_data_location(db):
    """Move medical data from appointments to patients"""
    print("Moving medical data from appointments to patients...")
    
    # Backup collections
    backup_collection(db, "appointments")
    backup_collection(db, "patients")
    
    # Get all appointments with medical data
    appointments = list(db.appointments.find({
        "$or": [
            {"blood_type": {"$exists": True}},
            {"allergies": {"$exists": True}},
            {"medications": {"$exists": True}},
            {"medical_conditions": {"$exists": True}}
        ]
    }))
    
    print(f"Found {len(appointments)} appointments with medical data")
    
    # Track patients that have been updated
    updated_patients = set()
    
    # Process each appointment
    for appointment in appointments:
        patient_id = appointment.get("patient")
        if not patient_id:
            continue
            
        # Find the patient
        patient = db.patients.find_one({"id": patient_id})
        if not patient:
            # Try to find by user_id if id doesn't match
            patient = db.patients.find_one({"user_id": patient_id})
            if not patient:
                print(f"Could not find patient with id or user_id: {patient_id}")
                continue
        
        patient_id_for_update = patient.get("id")
        
        # Update patient medical data
        updates = {}
        
        # Blood type
        if appointment.get("blood_type") and (not patient.get("blood_type") or patient.get("blood_type") == ""):
            updates["blood_type"] = appointment.get("blood_type")
        
        # Allergies
        if appointment.get("allergies") and (not patient.get("allergies") or patient.get("allergies") == ""):
            # If allergies is a string, convert to structured format
            allergies_value = appointment.get("allergies")
            if isinstance(allergies_value, str) and allergies_value.strip():
                allergies_list = [allergy.strip() for allergy in allergies_value.split(',') if allergy.strip()]
                structured_allergies = []
                for allergy in allergies_list:
                    structured_allergies.append({
                        "name": allergy,
                        "severity": "Unknown",
                        "reaction": "",
                        "diagnosed_date": None
                    })
                updates["allergies"] = structured_allergies
            elif isinstance(allergies_value, list):
                updates["allergies"] = allergies_value
            else:
                updates["allergies"] = allergies_value
        
        # Medications
        if appointment.get("medications") and (not patient.get("medications") or patient.get("medications") == ""):
            # If medications is a string, convert to structured format
            medications_value = appointment.get("medications")
            if isinstance(medications_value, str) and medications_value.strip():
                medications_list = [med.strip() for med in medications_value.split(',') if med.strip()]
                structured_medications = []
                for med in medications_list:
                    structured_medications.append({
                        "name": med,
                        "dosage": "",
                        "frequency": "",
                        "start_date": None,
                        "end_date": None
                    })
                updates["medications"] = structured_medications
            elif isinstance(medications_value, list):
                updates["medications"] = medications_value
            else:
                updates["medications"] = medications_value
        
        # Medical conditions/history
        if appointment.get("medical_conditions") and (not patient.get("medical_history") or patient.get("medical_history") == ""):
            # If medical_conditions is a string, convert to structured format
            conditions_value = appointment.get("medical_conditions")
            if isinstance(conditions_value, str) and conditions_value.strip():
                conditions_list = [condition.strip() for condition in conditions_value.split(',') if condition.strip()]
                structured_conditions = []
                for condition in conditions_list:
                    structured_conditions.append({
                        "condition": condition,
                        "diagnosed_date": None,
                        "notes": ""
                    })
                updates["medical_history"] = structured_conditions
            elif isinstance(conditions_value, list):
                updates["medical_history"] = conditions_value
            else:
                updates["medical_history"] = conditions_value
        
        # Update patient if we have new data
        if updates:
            db.patients.update_one(
                {"id": patient_id_for_update},
                {"$set": updates}
            )
            print(f"Updated patient {patient_id_for_update} with medical data from appointment {appointment.get('id')}")
            updated_patients.add(patient_id_for_update)
    
    print(f"Updated {len(updated_patients)} patients with medical data from appointments")
    
    # Remove medical data from appointments
    result = db.appointments.update_many(
        {},
        {
            "$unset": {
                "blood_type": "",
                "allergies": "",
                "medications": "",
                "medical_conditions": ""
            }
        }
    )
    
    print(f"Removed medical data from {result.modified_count} appointments")
    
    # Add patientMedicalInfo reference to appointments
    print("Adding patientMedicalInfo reference to appointments...")
    
    appointments = list(db.appointments.find({}))
    updated_appointments = 0
    
    for appointment in appointments:
        patient_id = appointment.get("patient")
        if not patient_id:
            continue
            
        # Find the patient
        patient = db.patients.find_one({"id": patient_id})
        if not patient:
            # Try to find by user_id if id doesn't match
            patient = db.patients.find_one({"user_id": patient_id})
            if not patient:
                continue
        
        # Create a patientMedicalInfo field with critical information
        patient_medical_info = {
            "blood_type": patient.get("blood_type", ""),
            "allergies": patient.get("allergies", []),
            "critical_conditions": patient.get("medical_history", [])
        }
        
        # Update the appointment
        db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"patientMedicalInfo": patient_medical_info}}
        )
        updated_appointments += 1
    
    print(f"Added patientMedicalInfo reference to {updated_appointments} appointments")
    return True

def check_index_exists(collection, field_name):
    """Check if an index exists for a specific field"""
    for index in collection.list_indexes():
        if field_name in index["key"]:
            return index["name"]
    return None

def create_index_safely(collection, field_name, **kwargs):
    """Create an index safely, handling existing indexes"""
    try:
        # Check if an index already exists for this field
        existing_index = check_index_exists(collection, field_name)
        
        if existing_index:
            print(f"  Index already exists for {field_name}: {existing_index}")
            return existing_index
        
        # Create the index
        result = collection.create_index(field_name, **kwargs)
        print(f"  Created index for {field_name}: {result}")
        return result
    except pymongo.errors.OperationFailure as e:
        if "Index already exists with a different name" in str(e):
            print(f"  Index conflict for {field_name}. Dropping existing index and recreating...")
            
            # Find the conflicting index
            for index in collection.list_indexes():
                if field_name in index["key"] and index["name"] != "_id_":
                    try:
                        collection.drop_index(index["name"])
                        print(f"  Dropped conflicting index: {index['name']}")
                        
                        # Try to create the index again
                        result = collection.create_index(field_name, **kwargs)
                        print(f"  Created index for {field_name}: {result}")
                        return result
                    except Exception as drop_error:
                        print(f"  Error dropping conflicting index: {str(drop_error)}")
                        return None
            
            print(f"  Could not find the conflicting index to drop for {field_name}")
            return None
        else:
            print(f"  Error creating index for {field_name}: {str(e)}")
            return None
    except Exception as e:
        print(f"  Unexpected error creating index for {field_name}: {str(e)}")
        return None

def create_compound_index_safely(collection, fields, **kwargs):
    """Create a compound index safely, handling existing indexes"""
    try:
        # Convert fields to list of tuples if it's not already
        if not isinstance(fields, list):
            fields = [(fields, pymongo.ASCENDING)]
        
        # Check if a similar index already exists
        existing_indexes = list(collection.list_indexes())
        for index in existing_indexes:
            if index["name"] == "_id_":
                continue
                
            # Compare key patterns
            index_keys = list(index["key"].items())
            if len(index_keys) == len(fields) and all(k[0] == f[0] for k, f in zip(index_keys, fields)):
                print(f"  Similar compound index already exists: {index['name']}")
                return index["name"]
        
        # Create the index
        result = collection.create_index(fields, **kwargs)
        print(f"  Created compound index: {result}")
        return result
    except pymongo.errors.OperationFailure as e:
        if "Index already exists with a different name" in str(e):
            print(f"  Compound index conflict. Dropping existing index and recreating...")
            
            # Find indexes that might be conflicting
            for index in collection.list_indexes():
                if index["name"] == "_id_":
                    continue
                    
                # Check if this index contains all our fields
                index_keys = list(index["key"].items())
                field_names = [f[0] for f in fields]
                if all(k[0] in field_names for k in index_keys):
                    try:
                        collection.drop_index(index["name"])
                        print(f"  Dropped conflicting index: {index['name']}")
                        
                        # Try to create the index again
                        result = collection.create_index(fields, **kwargs)
                        print(f"  Created compound index: {result}")
                        return result
                    except Exception as drop_error:
                        print(f"  Error dropping conflicting index: {str(drop_error)}")
                        return None
            
            print(f"  Could not find the conflicting index to drop")
            return None
        else:
            print(f"  Error creating compound index: {str(e)}")
            return None
    except Exception as e:
        print(f"  Unexpected error creating compound index: {str(e)}")
        return None

def create_indexes(db):
    """Create appropriate indexes for all collections"""
    print("Creating indexes for all collections...")
    
    # Users collection
    if "users" in db.list_collection_names():
        print("Creating indexes for users collection...")
        create_index_safely(db.users, "id", unique=True)
        create_index_safely(db.users, "email", unique=True)
        create_index_safely(db.users, "username")
        create_index_safely(db.users, "role")
    
    # Patients collection
    if "patients" in db.list_collection_names():
        print("Creating indexes for patients collection...")
        create_index_safely(db.patients, "id", unique=True)
        create_index_safely(db.patients, "user_id")
        create_index_safely(db.patients, "email")
        create_index_safely(db.patients, "name")
        create_index_safely(db.patients, "phone")
        create_index_safely(db.patients, "blood_type")
        
        # Text index for search
        try:
            db.patients.create_index([("name", pymongo.TEXT), ("address", pymongo.TEXT)], name="patient_text_search")
            print("  Created text index for patients")
        except pymongo.errors.OperationFailure as e:
            if "already exists" in str(e):
                print("  Text index for patients already exists")
            else:
                print(f"  Error creating text index for patients: {str(e)}")
    
    # Doctors collection
    if "doctors" in db.list_collection_names():
        print("Creating indexes for doctors collection...")
        create_index_safely(db.doctors, "id", unique=True)
        create_index_safely(db.doctors, "user_id")
        create_index_safely(db.doctors, "email")
        create_index_safely(db.doctors, "name")
        create_index_safely(db.doctors, "specialization")
        create_index_safely(db.doctors, "medical_center")
    
    # Appointments collection
    if "appointments" in db.list_collection_names():
        print("Creating indexes for appointments collection...")
        create_index_safely(db.appointments, "id", unique=True)
        create_index_safely(db.appointments, "patient")
        create_index_safely(db.appointments, "doctor")
        create_index_safely(db.appointments, "date")
        create_index_safely(db.appointments, "status")
        
        # Create compound index for appointment conflict resolution
        try:
            create_compound_index_safely(
                db.appointments, 
                [("doctor", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
                unique=True,
                partialFilterExpression={"status": "scheduled"},
                name="appointments_doctor_date_conflict"
            )
            print("  Created appointment conflict resolution index")
        except Exception as e:
            print(f"  Error creating appointment conflict index: {str(e)}")
    
    # Clinic staff collection
    if "clinic_staff" in db.list_collection_names():
        print("Creating indexes for clinic_staff collection...")
        create_index_safely(db.clinic_staff, "id", unique=True)
        create_index_safely(db.clinic_staff, "user_id")
        create_index_safely(db.clinic_staff, "email")
        create_index_safely(db.clinic_staff, "role")
        
        # Text index for search
        try:
            db.clinic_staff.create_index(
                [("first_name", pymongo.TEXT), ("last_name", pymongo.TEXT), ("full_name", pymongo.TEXT)],
                name="staff_name_text_index"
            )
            print("  Created text index for clinic_staff")
        except pymongo.errors.OperationFailure as e:
            if "already exists" in str(e):
                print("  Text index for clinic_staff already exists")
            else:
                print(f"  Error creating text index for clinic_staff: {str(e)}")
    
    # Medical records collection
    if "medical_records" in db.list_collection_names():
        print("Creating indexes for medical_records collection...")
        create_index_safely(db.medical_records, "id", unique=True)
        create_index_safely(db.medical_records, "patient_id")
        create_index_safely(db.medical_records, "doctor_id")
        create_index_safely(db.medical_records, "appointment_id")
        create_index_safely(db.medical_records, "date")
    
    print("Finished creating indexes")
    return True

def implement_denormalization(db):
    """Implement proper denormalization strategy"""
    print("Implementing denormalization strategy...")
    
    # Backup collections
    backup_collection(db, "appointments")
    
    # Embed patient and doctor info in appointments
    appointments = list(db.appointments.find({}))
    updated_appointments = 0
    
    for appointment in appointments:
        updates = {}
        
        # Get patient info
        patient_id = appointment.get("patient")
        if patient_id:
            patient = db.patients.find_one({"id": patient_id})
            if patient:
                updates["patientInfo"] = {
                    "id": patient.get("id"),
                    "name": patient.get("name", ""),
                    "email": patient.get("email", ""),
                    "phone": patient.get("phone", ""),
                    "blood_type": patient.get("blood_type", ""),
                    "allergies": patient.get("allergies", [])
                }
        
        # Get doctor info
        doctor_id = appointment.get("doctor")
        if doctor_id:
            doctor = db.doctors.find_one({"id": doctor_id})
            if doctor:
                updates["doctorInfo"] = {
                    "id": doctor.get("id"),
                    "name": doctor.get("name", ""),
                    "specialization": doctor.get("specialization", ""),
                    "email": doctor.get("email", ""),
                    "phone": doctor.get("phone", ""),
                    "consultation_fee": doctor.get("consultation_fee", 0)
                }
        
        # Update appointment if we have new data
        if updates:
            db.appointments.update_one(
                {"_id": appointment["_id"]},
                {"$set": updates}
            )
            updated_appointments += 1
    
    print(f"Updated {updated_appointments} appointments with embedded patient and doctor info")
    
    # Add version field for optimistic concurrency control if not present
    result = db.appointments.update_many(
        {"version": {"$exists": False}},
        {"$set": {"version": 1}}
    )
    
    print(f"Added version field to {result.modified_count} appointments")
    
    # Embed availability in doctors collection
    if "doctor_availability" in db.list_collection_names():
        doctors = list(db.doctors.find({}))
        updated_doctors = 0
        
        for doctor in doctors:
            doctor_id = doctor.get("id")
            if not doctor_id:
                continue
            
            # Get doctor's availability
            availability = list(db.doctor_availability.find({"doctor_id": doctor_id}))
            
            # Structure availability by day
            regular_availability = {}
            for avail in availability:
                day = avail.get("day_of_week")
                if day is not None:
                    day_name = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][day]
                    
                    if day_name not in regular_availability:
                        regular_availability[day_name] = []
                    
                    time_slot = {
                        "start_time": avail.get("start_time"),
                        "end_time": avail.get("end_time"),
                        "is_available": avail.get("is_available", True)
                    }
                    regular_availability[day_name].append(time_slot)
            
            # Get doctor exceptions (days off)
            exceptions = list(db.doctor_exceptions.find({"doctor_id": doctor_id}))
            exception_dates = []
            
            for exception in exceptions:
                exception_dates.append({
                    "date": exception.get("date"),
                    "reason": exception.get("reason", ""),
                    "is_available": exception.get("is_available", False)
                })
            
            # Update doctor with embedded availability
            updates = {}
            if regular_availability:
                updates["regular_availability"] = regular_availability
            if exception_dates:
                updates["exception_dates"] = exception_dates
            
            if updates:
                db.doctors.update_one(
                    {"id": doctor_id},
                    {"$set": updates}
                )
                updated_doctors += 1
        
        print(f"Updated {updated_doctors} doctors with embedded availability")
    
    return True

def main():
    """Main function to run the script"""
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

    # Analyze schema
    issues = analyze_schema(db)
    
    if not issues:
        print("No issues found with the database schema. Database adheres to the assignment brief.")
        return True
    
    # Ask for confirmation to proceed
    confirm = input("Do you want to fix the identified issues? (y/n): ")
    if confirm.lower() != 'y':
        print("Operation cancelled by user.")
        return False
    
    # Fix issues
    if any(issue["issue"] == "Medical data found in appointments collection" for issue in issues):
        fix_medical_data_location(db)
    
    if any(issue["issue"] == "Missing indexes" for issue in issues):
        create_indexes(db)
    
    if any(issue["issue"] == "Missing appointment conflict resolution mechanism" for issue in issues):
        create_indexes(db)  # This will also create the conflict resolution index
    
    if any(issue["issue"] == "Missing denormalized patient and doctor info" for issue in issues):
        implement_denormalization(db)
    
    # Verify fixes
    print("\nVerifying fixes...")
    remaining_issues = analyze_schema(db)
    
    if not remaining_issues:
        print("All issues have been fixed. Database now adheres to the assignment brief.")
    else:
        print(f"There are still {len(remaining_issues)} issues remaining.")
    
    print("Script completed successfully!")
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("Script completed successfully!")
        sys.exit(0)
    else:
        print("Script failed or was cancelled.")
        sys.exit(1)