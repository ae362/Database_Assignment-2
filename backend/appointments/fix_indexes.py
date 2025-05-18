# fix_indexes.py
import os
import pymongo
import sys

def get_mongodb_client():
    """
    Get MongoDB client
    """
    # Get MongoDB URI from environment
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/')
    
    if not mongodb_uri:
        print("MongoDB URI not configured. Please set MONGODB_URI environment variable.")
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
        print("MongoDB connection successful")
        return client
    except Exception as e:
        print(f"MongoDB connection failed: {str(e)}")
        return None

def fix_mongodb_indexes():
    """
    Fix MongoDB indexes by dropping all indexes and recreating them with unique names
    """
    client = get_mongodb_client()
    if not client:
        return False
    
    # Get database
    db_name = os.environ.get('MONGODB_NAME', 'hcams')
    db = client[db_name]
    
    # Collections to fix
    collections = ['users', 'patients', 'doctors', 'appointments']
    
    # First, drop all indexes except _id
    for collection_name in collections:
        collection = db[collection_name]
        
        print(f"Dropping all indexes for {collection_name} collection...")
        
        try:
            # List all indexes
            indexes = list(collection.list_indexes())
            print(f"Found {len(indexes)} indexes in {collection_name}")
            
            # Drop all non-_id indexes
            for index in indexes:
                index_name = index.get('name')
                if index_name != '_id_':
                    try:
                        print(f"Dropping index {index_name} from {collection_name}")
                        collection.drop_index(index_name)
                    except Exception as e:
                        print(f"Error dropping index {index_name}: {str(e)}")
        except Exception as e:
            print(f"Error listing indexes for {collection_name}: {str(e)}")
    
    # Now create new indexes with unique names
    print("Creating new indexes...")
    
    # Users collection
    try:
        db.users.create_index("email", unique=True, name="users_email_unique")
        db.users.create_index("id", unique=True, name="users_id_unique")
        print("Created indexes for users collection")
    except Exception as e:
        print(f"Error creating indexes for users collection: {str(e)}")
    
    # Patients collection
    try:
        db.patients.create_index("email", unique=True, name="patients_email_unique")
        db.patients.create_index("id", unique=True, name="patients_id_unique")
        db.patients.create_index("user_id", name="patients_user_id")
        print("Created indexes for patients collection")
    except Exception as e:
        print(f"Error creating indexes for patients collection: {str(e)}")
    
    # Doctors collection
    try:
        db.doctors.create_index("email", unique=True, name="doctors_email_unique")
        db.doctors.create_index("id", unique=True, name="doctors_id_unique")
        db.doctors.create_index("user_id", name="doctors_user_id")
        print("Created indexes for doctors collection")
    except Exception as e:
        print(f"Error creating indexes for doctors collection: {str(e)}")
    
    # Appointments collection
    try:
        db.appointments.create_index("id", unique=True, name="appointments_id_unique")
        db.appointments.create_index("patient", name="appointments_patient")
        db.appointments.create_index("doctor", name="appointments_doctor")
        
        # Create compound index with a custom name
        db.appointments.create_index(
            [("doctor", 1), ("date", 1)],
            name="appointments_doctor_date_unique",
            unique=True,
            partialFilterExpression={"status": "scheduled"}
        )
        print("Created indexes for appointments collection")
    except Exception as e:
        print(f"Error creating indexes for appointments collection: {str(e)}")
    
    print("MongoDB indexes fixed successfully")
    return True

if __name__ == "__main__":
    fix_mongodb_indexes()