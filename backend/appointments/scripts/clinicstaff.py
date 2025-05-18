import os
import pymongo
from bson.objectid import ObjectId
from datetime import datetime
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

def create_clinic_staff_collection(db):
    """
    Create a dedicated collection for clinic staff by extracting users with staff roles
    and adding additional staff-specific fields
    """
    print("Creating clinic_staff collection...")

    # Check if collection already exists
    if "clinic_staff" in db.list_collection_names():
        print("clinic_staff collection already exists. Creating backup before dropping...")
        backup_collection(db, "clinic_staff")
        db.clinic_staff.drop()
        print("Dropped existing clinic_staff collection")

    # Get all staff users from the users collection
    staff_users = list(db.users.find({
        "$or": [
            {"is_staff": True},
            {"is_superuser": True},
            {"role": {"$in": ["admin", "doctor", "staff"]}}
        ]
    }))

    print(f"Found {len(staff_users)} staff users")

    # Create clinic_staff collection
    if len(staff_users) > 0:
        # Process each staff user
        clinic_staff_docs = []
        
        for user in staff_users:
            # Create a staff document with enhanced fields
            staff_doc = {
                "id": user.get("id", str(uuid.uuid4())),
                "user_id": user.get("id"),
                "email": user.get("email", ""),
                "username": user.get("username", ""),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "role": user.get("role", "staff"),
                "is_admin": user.get("role") == "admin" or user.get("is_superuser", False),
                "is_doctor": user.get("role") == "doctor",
                "is_active": user.get("is_active", True),
                "phone": user.get("phone", ""),
                "last_login": user.get("last_login"),
                "date_joined": user.get("date_joined", datetime.now()),
                "permissions": user.get("permissions", []),
                "department": user.get("department", "General"),
                "position": user.get("position", "Staff Member"),
                "schedule": user.get("schedule", {}),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            # If user is a doctor, get additional doctor info
            if user.get("role") == "doctor":
                doctor = db.doctors.find_one({"user_id": user.get("id")})
                if doctor:
                    staff_doc["doctor_id"] = doctor.get("id")
                    staff_doc["specialization"] = doctor.get("specialization", "")
                    staff_doc["qualification"] = doctor.get("qualification", "")
                    staff_doc["experience_years"] = doctor.get("experience_years", 0)
                    staff_doc["consultation_fee"] = doctor.get("consultation_fee", 0)
                    staff_doc["regular_availability"] = doctor.get("regular_availability", {})
                    staff_doc["medical_center"] = doctor.get("medical_center", "")
                    staff_doc["medical_center_name"] = doctor.get("medical_center_name", "")
                    staff_doc["emergency_available"] = doctor.get("emergency_available", False)
                    staff_doc["daily_patient_limit"] = doctor.get("daily_patient_limit", 10)
            
            clinic_staff_docs.append(staff_doc)
        
        # Insert all staff documents
        if clinic_staff_docs:
            db.clinic_staff.insert_many(clinic_staff_docs)
            print(f"Inserted {len(clinic_staff_docs)} documents into clinic_staff collection")
        
        # Create indexes
        print("Creating indexes for clinic_staff collection...")
        db.clinic_staff.create_index("id", unique=True)
        db.clinic_staff.create_index("user_id")
        db.clinic_staff.create_index("email")
        db.clinic_staff.create_index("role")
        db.clinic_staff.create_index([("first_name", pymongo.TEXT), ("last_name", pymongo.TEXT), ("full_name", pymongo.TEXT)], 
                                    name="name_text_index")
        db.clinic_staff.create_index("department")
        
        print("clinic_staff collection created successfully")
        
        # Create a view that joins staff with their appointments
        try:
            # Check if view exists
            if "staff_appointments" in db.list_collection_names():
                print("staff_appointments view already exists. Dropping...")
                db.command({"drop": "staff_appointments"})
            
            # Create the view
            db.command({
                "create": "staff_appointments",
                "viewOn": "appointments",
                "pipeline": [
                    {
                        "$lookup": {
                            "from": "clinic_staff",
                            "localField": "doctor",
                            "foreignField": "doctor_id",
                            "as": "staff_info"
                        }
                    },
                    {
                        "$unwind": {
                            "path": "$staff_info",
                            "preserveNullAndEmptyArrays": True
                        }
                    }
                ]
            })
            print("Created staff_appointments view")
        except Exception as e:
            print(f"Error creating staff_appointments view: {str(e)}")
        
        return True
    else:
        print("No staff users found. clinic_staff collection not created.")
        return False

def fix_appointment_medical_data(db):
    """
    Fix the issue with medical data in appointments collection by:
    1. Moving medical data from appointments to patients
    2. Removing redundant medical data from appointments
    """
    print("Starting to fix medical data in appointments collection...")
    
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
    
    # Process each appointment
    for appointment in appointments:
        patient_id = appointment.get("patient")
        if not patient_id:
            continue
            
        # Find the patient
        patient = db.patients.find_one({"id": patient_id})
        if not patient:
            continue
            
        # Update patient medical data if it's empty or missing
        updates = {}
        
        if appointment.get("blood_type") and (not patient.get("blood_type") or patient.get("blood_type") == ""):
            updates["blood_type"] = appointment.get("blood_type")
            
        if appointment.get("allergies") and (not patient.get("allergies") or patient.get("allergies") == ""):
            updates["allergies"] = appointment.get("allergies")
            
        if appointment.get("medications") and (not patient.get("medications") or patient.get("medications") == ""):
            updates["medications"] = appointment.get("medications")
            
        if appointment.get("medical_conditions") and (not patient.get("medical_history") or patient.get("medical_history") == ""):
            updates["medical_history"] = appointment.get("medical_conditions")
        
        # Update patient if we have new data
        if updates:
            db.patients.update_one(
                {"id": patient_id},
                {"$set": updates}
            )
            print(f"Updated patient {patient_id} with medical data from appointment {appointment.get('id')}")
    
    # Now remove the medical data from appointments
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
    
    # Add a reference to patient medical data in appointments
    appointments = list(db.appointments.find({}))
    
    for appointment in appointments:
        patient_id = appointment.get("patient")
        if not patient_id:
            continue
            
        # Find the patient
        patient = db.patients.find_one({"id": patient_id})
        if not patient:
            continue
            
        # Create a patientMedicalInfo field with critical information
        patient_medical_info = {
            "blood_type": patient.get("blood_type", ""),
            "allergies": patient.get("allergies", ""),
            "critical_conditions": patient.get("medical_history", "")
        }
        
        # Update the appointment
        db.appointments.update_one(
            {"_id": appointment["_id"]},
            {"$set": {"patientMedicalInfo": patient_medical_info}}
        )
    
    print("Finished fixing medical data in appointments collection")
    return True

def main():
    """Main function to run the script"""
    print("Starting MongoDB clinic staff creation script...")

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
    print("1. Create clinic_staff collection")
    print("2. Fix medical data in appointments collection")
    print("3. Do both operations")
    
    choice = input("Enter your choice (1-3): ")
    
    if choice == "1":
        create_clinic_staff_collection(db)
    elif choice == "2":
        fix_appointment_medical_data(db)
    elif choice == "3":
        create_clinic_staff_collection(db)
        fix_appointment_medical_data(db)
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