import os
import pymongo
from bson.objectid import ObjectId
from datetime import datetime
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

def transfer_medical_data_to_patients(db):
    """
    Transfer medical data from appointments to patients and create appropriate indexes
    """
    print("Starting to transfer medical data from appointments to patients...")
    
    # Backup collections before modification
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
    
    # Create a patientMedicalInfo field in appointments
    print("Adding patientMedicalInfo to appointments...")
    
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
            "medications": patient.get("medications", []),
            "medical_history": patient.get("medical_history", [])
        }
        
        # Update the appointment
        db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"patientMedicalInfo": patient_medical_info}}
        )
        updated_appointments += 1
    
    print(f"Added patientMedicalInfo to {updated_appointments} appointments")
    
    # Create indexes for efficient querying
    print("Creating indexes for patients collection...")
    
    # Drop existing indexes to avoid conflicts
    existing_indexes = list(db.patients.list_indexes())
    for index in existing_indexes:
        if index["name"] != "_id_":  # Don't drop the _id index
            try:
                db.patients.drop_index(index["name"])
                print(f"Dropped existing index: {index['name']}")
            except Exception as e:
                print(f"Error dropping index {index['name']}: {str(e)}")
    
    # Create new indexes
    db.patients.create_index("id", unique=True)
    db.patients.create_index("user_id")
    db.patients.create_index("email")
    db.patients.create_index("name")
    db.patients.create_index("phone")
    db.patients.create_index("blood_type")
    db.patients.create_index([("name", pymongo.TEXT), ("address", pymongo.TEXT)], name="patient_text_search")
    
    print("Created indexes for patients collection")
    
    # Optionally remove medical data from appointments
    remove_data = input("Do you want to remove medical data fields from appointments? (y/n): ")
    if remove_data.lower() == 'y':
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
    
    print("Finished transferring medical data to patients")
    return True

def create_medical_records_collection(db):
    """
    Create a dedicated medical_records collection with proper structure
    """
    print("Creating/updating medical_records collection...")
    
    # Check if collection already exists
    if "medical_records" not in db.list_collection_names():
        print("medical_records collection doesn't exist. Creating...")
    else:
        backup_collection(db, "medical_records")
    
    # Get all patients
    patients = list(db.patients.find({}))
    print(f"Found {len(patients)} patients")
    
    # Get all completed appointments
    completed_appointments = list(db.appointments.find({"status": "completed"}))
    print(f"Found {len(completed_appointments)} completed appointments")
    
    # Create medical records from completed appointments
    medical_records = []
    
    for appointment in completed_appointments:
        patient_id = appointment.get("patient")
        doctor_id = appointment.get("doctor")
        
        if not patient_id or not doctor_id:
            continue
        
        # Create a medical record
        medical_record = {
            "id": str(ObjectId()),
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "appointment_id": appointment.get("id"),
            "date": appointment.get("date"),
            "reason_for_visit": appointment.get("reason_for_visit", ""),
            "diagnosis": appointment.get("diagnosis", ""),
            "treatment": appointment.get("treatment", ""),
            "prescription": appointment.get("prescription", ""),
            "notes": appointment.get("notes", ""),
            "blood_type": appointment.get("blood_type", ""),
            "allergies": appointment.get("allergies", ""),
            "medications": appointment.get("medications", ""),
            "medical_conditions": appointment.get("medical_conditions", ""),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        medical_records.append(medical_record)
    
    # Insert medical records
    if medical_records:
        # Clear existing records if any
        db.medical_records.delete_many({})
        
        # Insert new records
        db.medical_records.insert_many(medical_records)
        print(f"Inserted {len(medical_records)} medical records")
        
        # Create indexes
        db.medical_records.create_index("id", unique=True)
        db.medical_records.create_index("patient_id")
        db.medical_records.create_index("doctor_id")
        db.medical_records.create_index("appointment_id")
        db.medical_records.create_index("date")
        
        print("Created indexes for medical_records collection")
    else:
        print("No medical records to insert")
    
    return True

def main():
    """Main function to run the script"""
    print("Starting MongoDB patient medical data update script...")

    # Get MongoDB client
    client = get_mongodb_client()
    if not client:
        print("Failed to connect to MongoDB. Exiting.")
        return False

    # Get database
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]

    # Ask user what they want to do
    print("\nWhat would you like to do?")
    print("1. Transfer medical data from appointments to patients")
    print("2. Create/update medical_records collection")
    print("3. Do both operations")
    
    choice = input("Enter your choice (1-3): ")
    
    if choice == "1":
        transfer_medical_data_to_patients(db)
    elif choice == "2":
        create_medical_records_collection(db)
    elif choice == "3":
        transfer_medical_data_to_patients(db)
        create_medical_records_collection(db)
    else:
        print("Invalid choice. Exiting.")
        return False
    
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