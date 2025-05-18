#!/usr/bin/env python3
"""
MongoDB Database Copy Script

This script copies all collections from one MongoDB database to another.
It's useful when you need to rename a database, as MongoDB doesn't provide
a direct way to rename databases.

Usage:
    python copy_mongodb_database.py --uri "mongodb+srv://username:password@host" --source "old_db_name" --target "new_db_name"

Options:
    --uri       MongoDB connection URI
    --source    Source database name
    --target    Target database name
    --delete    Delete source database after copying (default: False)
"""

import argparse
import sys
import time
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Copy MongoDB database')
    parser.add_argument('--uri', required=True, help='MongoDB connection URI')
    parser.add_argument('--source', required=True, help='Source database name')
    parser.add_argument('--target', required=True, help='Target database name')
    parser.add_argument('--delete', action='store_true', help='Delete source database after copying')
    return parser.parse_args()

def connect_to_mongodb(uri):
    """Connect to MongoDB server."""
    try:
        client = MongoClient(uri)
        # Verify connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB server successfully")
        return client
    except ConnectionFailure as e:
        print(f"❌ Failed to connect to MongoDB server: {e}")
        sys.exit(1)

def get_collection_stats(db, collection_name):
    """Get collection document count and size."""
    count = db[collection_name].count_documents({})
    stats = db.command("collStats", collection_name)
    size = stats.get("size", 0) / (1024 * 1024)  # Convert to MB
    return count, size

def copy_collection(source_db, target_db, collection_name):
    """Copy a collection from source to target database."""
    start_time = time.time()
    
    # Get source collection stats
    doc_count, size_mb = get_collection_stats(source_db, collection_name)
    print(f"Copying collection '{collection_name}' ({doc_count} documents, {size_mb:.2f} MB)...")
    
    # Check if collection already exists in target
    if collection_name in target_db.list_collection_names():
        print(f"⚠️  Collection '{collection_name}' already exists in target database. Skipping...")
        return False
    
    # Copy collection
    pipeline = [{"$match": {}}, {"$out": {"db": target_db.name, "coll": collection_name}}]
    source_db[collection_name].aggregate(pipeline)
    
    # Verify copy
    target_count, _ = get_collection_stats(target_db, collection_name)
    
    elapsed_time = time.time() - start_time
    if target_count == doc_count:
        print(f"✅ Copied collection '{collection_name}' successfully in {elapsed_time:.2f} seconds")
        return True
    else:
        print(f"❌ Failed to copy collection '{collection_name}' correctly. Source: {doc_count}, Target: {target_count}")
        return False

def copy_indexes(source_db, target_db, collection_name):
    """Copy indexes from source collection to target collection."""
    try:
        # Get indexes from source collection
        indexes = source_db[collection_name].index_information()
        
        # Skip the default _id index
        indexes_to_create = {name: spec for name, spec in indexes.items() if name != '_id_'}
        
        if not indexes_to_create:
            return True
        
        print(f"Copying {len(indexes_to_create)} indexes for collection '{collection_name}'...")
        
        # Create each index in the target collection
        for index_name, index_info in indexes_to_create.items():
            # Extract key fields and order
            keys = [(field, order) for field, order in index_info['key']]
            
            # Extract index options
            options = {k: v for k, v in index_info.items() if k not in ['key', 'v', 'ns']}
            if 'name' in options:
                options['name'] = index_name
            
            # Create the index
            target_db[collection_name].create_index(keys, **options)
        
        print(f"✅ Copied indexes for collection '{collection_name}'")
        return True
    except Exception as e:
        print(f"❌ Failed to copy indexes for collection '{collection_name}': {e}")
        return False

def copy_database(client, source_name, target_name):
    """Copy all collections from source database to target database."""
    # Get source and target databases
    source_db = client[source_name]
    target_db = client[target_name]
    
    # Get list of collections in source database
    collections = source_db.list_collection_names()
    
    if not collections:
        print(f"❌ Source database '{source_name}' has no collections")
        return False
    
    print(f"Found {len(collections)} collections in source database '{source_name}'")
    
    # Create target database by creating a dummy collection if it doesn't exist
    if target_name not in client.list_database_names():
        target_db.create_collection("temp_init_collection")
        print(f"✅ Created target database '{target_name}'")
        # Drop the temporary collection
        target_db.drop_collection("temp_init_collection")
    
    # Copy each collection
    success_count = 0
    for collection_name in collections:
        if copy_collection(source_db, target_db, collection_name):
            # Copy indexes after successful collection copy
            copy_indexes(source_db, target_db, collection_name)
            success_count += 1
    
    # Verify all collections were copied
    if success_count == len(collections):
        print(f"✅ All {len(collections)} collections copied successfully")
        return True
    else:
        print(f"⚠️  {success_count} out of {len(collections)} collections copied successfully")
        return False

def delete_database(client, db_name):
    """Delete a database."""
    try:
        client.drop_database(db_name)
        print(f"✅ Deleted database '{db_name}'")
        return True
    except Exception as e:
        print(f"❌ Failed to delete database '{db_name}': {e}")
        return False

def main():
    """Main function."""
    args = parse_arguments()
    
    # Connect to MongoDB
    client = connect_to_mongodb(args.uri)
    
    # Check if source database exists
    if args.source not in client.list_database_names():
        print(f"❌ Source database '{args.source}' does not exist")
        sys.exit(1)
    
    # Check if source and target are the same
    if args.source == args.target:
        print("❌ Source and target database names cannot be the same")
        sys.exit(1)
    
    # Check if target database already exists
    if args.target in client.list_database_names():
        print(f"⚠️  Target database '{args.target}' already exists")
        confirm = input("Do you want to continue and add to the existing database? (y/n): ")
        if confirm.lower() != 'y':
            print("Operation cancelled")
            sys.exit(0)
    
    print(f"Copying database '{args.source}' to '{args.target}'...")
    
    # Copy database
    success = copy_database(client, args.source, args.target)
    
    if success:
        # Verify databases
        source_collections = client[args.source].list_collection_names()
        target_collections = client[args.target].list_collection_names()
        
        if set(source_collections) <= set(target_collections):
            print("✅ Database copy verification successful")
            
            # Delete source database if requested
            if args.delete:
                confirm = input(f"Are you sure you want to DELETE the source database '{args.source}'? This cannot be undone. (yes/no): ")
                if confirm.lower() == 'yes':
                    delete_database(client, args.source)
                else:
                    print("Source database deletion cancelled")
        else:
            print("❌ Database copy verification failed. Some collections may be missing in the target database.")
    else:
        print("❌ Database copy failed")
    
    # Close connection
    client.close()
    print("MongoDB connection closed")

if __name__ == "__main__":
    main()