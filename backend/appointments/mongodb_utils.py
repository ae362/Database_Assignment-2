# mongodb_utils.py
import os
import ssl
import threading
import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
import pymongo
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, PyMongoError
from bson.objectid import ObjectId
from django.conf import settings

# Configure logging
logger = logging.getLogger(__name__)

# Thread-local storage for MongoDB connections
_thread_local = threading.local()

def get_mongodb_client() -> MongoClient:
    """
    Get a MongoDB client with proper SSL configuration.
    Uses thread-local storage to reuse connections.
    
    Returns:
        MongoClient: MongoDB client instance
    """
    if not hasattr(_thread_local, 'mongodb_client'):
        try:
            # Configure SSL context if needed
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Create MongoDB client with connection pooling
            _thread_local.mongodb_client = MongoClient(
                settings.MONGODB_URI,
                ssl=True,
                ssl_cert_reqs=ssl.CERT_NONE,
                connectTimeoutMS=30000,
                socketTimeoutMS=60000,
                serverSelectionTimeoutMS=30000,
                maxPoolSize=100,
                minPoolSize=10,
                maxIdleTimeMS=45000,
                waitQueueTimeoutMS=10000
            )
            
            # Test connection
            _thread_local.mongodb_client.admin.command('ping')
            logger.info("MongoDB connection established successfully")
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB connection failed: {str(e)}")
            raise
            
    return _thread_local.mongodb_client

def get_mongodb_database() -> Database:
    """
    Get the MongoDB database.
    
    Returns:
        Database: MongoDB database instance
    """
    client = get_mongodb_client()
    return client[settings.MONGODB_NAME]

def get_collection(collection_name: str) -> Collection:
    """
    Get a MongoDB collection by name.
    
    Args:
        collection_name (str): Name of the collection
        
    Returns:
        Collection: MongoDB collection instance
    """
    db = get_mongodb_database()
    return db[collection_name]

def close_mongodb_connection() -> None:
    """
    Close the MongoDB connection.
    Should be called when the thread is done with MongoDB.
    """
    if hasattr(_thread_local, 'mongodb_client'):
        _thread_local.mongodb_client.close()
        del _thread_local.mongodb_client
        logger.debug("MongoDB connection closed")

def convert_id_to_string(document: Dict) -> Dict:
    """
    Convert MongoDB ObjectId to string in a document.
    
    Args:
        document (Dict): MongoDB document
        
    Returns:
        Dict: Document with ObjectId converted to string
    """
    if document and '_id' in document:
        document['_id'] = str(document['_id'])
    return document

def prepare_document_for_mongodb(document: Dict) -> Dict:
    """
    Prepare a document for MongoDB insertion by handling special types.
    
    Args:
        document (Dict): Document to prepare
        
    Returns:
        Dict: Prepared document
    """
    # Create a copy to avoid modifying the original
    doc = document.copy()
    
    # Convert Django model instances to their primary keys
    for key, value in document.items():
        if hasattr(value, 'pk'):
            doc[key] = value.pk
            
    return doc

def handle_mongodb_error(func):
    """
    Decorator to handle MongoDB errors.
    
    Args:
        func: Function to decorate
        
    Returns:
        Function: Decorated function
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except PyMongoError as e:
            logger.error(f"MongoDB error in {func.__name__}: {str(e)}")
            raise
    return wrapper

@handle_mongodb_error
def insert_document(collection_name: str, document: Dict) -> str:
    """
    Insert a document into a collection.
    
    Args:
        collection_name (str): Name of the collection
        document (Dict): Document to insert
        
    Returns:
        str: ID of the inserted document
    """
    collection = get_collection(collection_name)
    document = prepare_document_for_mongodb(document)
    result = collection.insert_one(document)
    return str(result.inserted_id)

@handle_mongodb_error
def insert_many_documents(collection_name: str, documents: List[Dict]) -> List[str]:
    """
    Insert multiple documents into a collection.
    
    Args:
        collection_name (str): Name of the collection
        documents (List[Dict]): Documents to insert
        
    Returns:
        List[str]: IDs of the inserted documents
    """
    collection = get_collection(collection_name)
    prepared_docs = [prepare_document_for_mongodb(doc) for doc in documents]
    result = collection.insert_many(prepared_docs)
    return [str(id) for id in result.inserted_ids]

@handle_mongodb_error
def find_document_by_id(collection_name: str, document_id: Union[str, ObjectId]) -> Optional[Dict]:
    """
    Find a document by its ID.
    
    Args:
        collection_name (str): Name of the collection
        document_id (Union[str, ObjectId]): ID of the document
        
    Returns:
        Optional[Dict]: Found document or None
    """
    collection = get_collection(collection_name)
    
    # Convert string ID to ObjectId if needed
    if isinstance(document_id, str):
        document_id = ObjectId(document_id)
        
    document = collection.find_one({'_id': document_id})
    return convert_id_to_string(document) if document else None

@handle_mongodb_error
def find_document(collection_name: str, query: Dict, projection: Dict = None) -> Optional[Dict]:
    """
    Find a document by query.
    
    Args:
        collection_name (str): Name of the collection
        query (Dict): Query to find the document
        projection (Dict, optional): Fields to include/exclude
        
    Returns:
        Optional[Dict]: Found document or None
    """
    collection = get_collection(collection_name)
    document = collection.find_one(query, projection)
    return convert_id_to_string(document) if document else None

@handle_mongodb_error
def find_documents(collection_name: str, query: Dict = None, projection: Dict = None, 
                  sort: List = None, limit: int = 0, skip: int = 0) -> List[Dict]:
    """
    Find documents by query.
    
    Args:
        collection_name (str): Name of the collection
        query (Dict, optional): Query to find documents
        projection (Dict, optional): Fields to include/exclude
        sort (List, optional): Sort specification
        limit (int, optional): Maximum number of documents to return
        skip (int, optional): Number of documents to skip
        
    Returns:
        List[Dict]: Found documents
    """
    collection = get_collection(collection_name)
    
    # Default query to empty dict if None
    if query is None:
        query = {}
        
    cursor = collection.find(query, projection)
    
    if sort:
        cursor = cursor.sort(sort)
    
    if skip:
        cursor = cursor.skip(skip)
        
    if limit:
        cursor = cursor.limit(limit)
        
    return [convert_id_to_string(doc) for doc in cursor]

@handle_mongodb_error
def update_document(collection_name: str, document_id: Union[str, ObjectId], 
                   update_data: Dict, upsert: bool = False) -> bool:
    """
    Update a document by its ID.
    
    Args:
        collection_name (str): Name of the collection
        document_id (Union[str, ObjectId]): ID of the document
        update_data (Dict): Data to update
        upsert (bool, optional): Whether to insert if document doesn't exist
        
    Returns:
        bool: True if document was updated, False otherwise
    """
    collection = get_collection(collection_name)
    
    # Convert string ID to ObjectId if needed
    if isinstance(document_id, str):
        document_id = ObjectId(document_id)
    
    # Prepare update data
    update_data = prepare_document_for_mongodb(update_data)
    
    result = collection.update_one(
        {'_id': document_id},
        {'$set': update_data},
        upsert=upsert
    )
    
    return result.modified_count > 0 or (upsert and result.upserted_id is not None)

@handle_mongodb_error
def update_documents(collection_name: str, query: Dict, update_data: Dict, 
                    upsert: bool = False) -> int:
    """
    Update multiple documents by query.
    
    Args:
        collection_name (str): Name of the collection
        query (Dict): Query to find documents
        update_data (Dict): Data to update
        upsert (bool, optional): Whether to insert if documents don't exist
        
    Returns:
        int: Number of documents updated
    """
    collection = get_collection(collection_name)
    
    # Prepare update data
    update_data = prepare_document_for_mongodb(update_data)
    
    result = collection.update_many(
        query,
        {'$set': update_data},
        upsert=upsert
    )
    
    return result.modified_count

@handle_mongodb_error
def delete_document(collection_name: str, document_id: Union[str, ObjectId]) -> bool:
    """
    Delete a document by its ID.
    
    Args:
        collection_name (str): Name of the collection
        document_id (Union[str, ObjectId]): ID of the document
        
    Returns:
        bool: True if document was deleted, False otherwise
    """
    collection = get_collection(collection_name)
    
    # Convert string ID to ObjectId if needed
    if isinstance(document_id, str):
        document_id = ObjectId(document_id)
        
    result = collection.delete_one({'_id': document_id})
    return result.deleted_count > 0

@handle_mongodb_error
def delete_documents(collection_name: str, query: Dict) -> int:
    """
    Delete multiple documents by query.
    
    Args:
        collection_name (str): Name of the collection
        query (Dict): Query to find documents
        
    Returns:
        int: Number of documents deleted
    """
    collection = get_collection(collection_name)
    result = collection.delete_many(query)
    return result.deleted_count

@handle_mongodb_error
def count_documents(collection_name: str, query: Dict = None) -> int:
    """
    Count documents by query.
    
    Args:
        collection_name (str): Name of the collection
        query (Dict, optional): Query to count documents
        
    Returns:
        int: Number of documents
    """
    collection = get_collection(collection_name)
    
    # Default query to empty dict if None
    if query is None:
        query = {}
        
    return collection.count_documents(query)

@handle_mongodb_error
def aggregate(collection_name: str, pipeline: List[Dict]) -> List[Dict]:
    """
    Perform an aggregation pipeline.
    
    Args:
        collection_name (str): Name of the collection
        pipeline (List[Dict]): Aggregation pipeline
        
    Returns:
        List[Dict]: Aggregation results
    """
    collection = get_collection(collection_name)
    results = collection.aggregate(pipeline)
    return [convert_id_to_string(doc) for doc in results]

@handle_mongodb_error
def text_search(collection_name: str, search_text: str, 
               filter_query: Dict = None, projection: Dict = None, 
               sort: List = None, limit: int = 0) -> List[Dict]:
    """
    Perform a text search.
    
    Args:
        collection_name (str): Name of the collection
        search_text (str): Text to search for
        filter_query (Dict, optional): Additional filter query
        projection (Dict, optional): Fields to include/exclude
        sort (List, optional): Sort specification
        limit (int, optional): Maximum number of documents to return
        
    Returns:
        List[Dict]: Search results
    """
    collection = get_collection(collection_name)
    
    # Build query
    query = {'$text': {'$search': search_text}}
    
    # Add additional filter if provided
    if filter_query:
        query.update(filter_query)
    
    # Add text score to projection if not specified
    if projection is None:
        projection = {'score': {'$meta': 'textScore'}}
    elif isinstance(projection, dict):
        projection['score'] = {'$meta': 'textScore'}
    
    # Default sort by text score if not specified
    if sort is None:
        sort = [('score', {'$meta': 'textScore'})]
    
    # Execute search
    cursor = collection.find(query, projection).sort(sort)
    
    if limit:
        cursor = cursor.limit(limit)
    
    return [convert_id_to_string(doc) for doc in cursor]

def check_indexes_exist() -> bool:
    """
    Check if MongoDB indexes have been set up.
    
    Returns:
        bool: True if indexes exist, False otherwise
    """
    try:
        db = get_mongodb_database()
        return db.index_metadata.find_one({'setup_completed': True}) is not None
    except PyMongoError as e:
        logger.error(f"Error checking MongoDB indexes: {str(e)}")
        return False

def get_index_info(collection_name: str) -> List[Dict]:
    """
    Get information about indexes in a collection.
    
    Args:
        collection_name (str): Name of the collection
        
    Returns:
        List[Dict]: Index information
    """
    try:
        collection = get_collection(collection_name)
        indexes = collection.index_information()
        return [{'name': name, 'info': info} for name, info in indexes.items()]
    except PyMongoError as e:
        logger.error(f"Error getting index info: {str(e)}")
        return []

def execute_transaction(callback):
    """
    Execute a MongoDB transaction.
    
    Args:
        callback: Function to execute in the transaction
        
    Returns:
        Any: Result of the callback function
    """
    client = get_mongodb_client()
    
    with client.start_session() as session:
        return session.with_transaction(callback)

def create_ttl_index(collection_name: str, field_name: str, expiration_seconds: int) -> bool:
    """
    Create a TTL (Time-To-Live) index on a collection.
    
    Args:
        collection_name (str): Name of the collection
        field_name (str): Field to create the index on
        expiration_seconds (int): Seconds after which documents expire
        
    Returns:
        bool: True if index was created, False otherwise
    """
    try:
        collection = get_collection(collection_name)
        collection.create_index(
            [(field_name, ASCENDING)],
            expireAfterSeconds=expiration_seconds
        )
        return True
    except PyMongoError as e:
        logger.error(f"Error creating TTL index: {str(e)}")
        return False

def create_geospatial_index(collection_name: str, field_name: str) -> bool:
    """
    Create a geospatial index on a collection.
    
    Args:
        collection_name (str): Name of the collection
        field_name (str): Field to create the index on
        
    Returns:
        bool: True if index was created, False otherwise
    """
    try:
        collection = get_collection(collection_name)
        collection.create_index([(field_name, "2dsphere")])
        return True
    except PyMongoError as e:
        logger.error(f"Error creating geospatial index: {str(e)}")
        return False

def log_mongodb_operation(operation: str, collection: str, details: Dict = None) -> None:
    """
    Log a MongoDB operation for auditing purposes.
    
    Args:
        operation (str): Operation performed
        collection (str): Collection on which operation was performed
        details (Dict, optional): Additional details
    """
    try:
        db = get_mongodb_database()
        log_entry = {
            'operation': operation,
            'collection': collection,
            'timestamp': datetime.now(),
            'details': details or {}
        }
        db.operation_logs.insert_one(log_entry)
    except PyMongoError as e:
        logger.error(f"Error logging MongoDB operation: {str(e)}")

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def mongo_to_json(mongo_obj):
    """Convert MongoDB document to JSON-serializable dict"""
    if isinstance(mongo_obj, dict):
        return {k: mongo_to_json(v) for k, v in mongo_obj.items()}
    elif isinstance(mongo_obj, list):
        return [mongo_to_json(item) for item in mongo_obj]
    elif isinstance(mongo_obj, ObjectId):
        return str(mongo_obj)
    elif isinstance(mongo_obj, datetime):
        return mongo_obj.isoformat()
    else:
        return mongo_obj
    

_mongo_client = None
_mongo_db = None
def get_mongodb_client():
    """
    Get MongoDB client (singleton pattern)
    """
    global _mongo_client
    
    if _mongo_client is None:
        # Get MongoDB URI from settings or environment
        mongodb_uri = getattr(settings, 'MONGODB_URI', os.environ.get('MONGODB_URI'))
        
        if not mongodb_uri:
            raise Exception("MongoDB URI not configured. Please set MONGODB_URI in settings or environment.")
        
        # Create MongoDB client
        _mongo_client = pymongo.MongoClient(mongodb_uri)
        
        # Test connection
        try:
            # The ismaster command is cheap and does not require auth
            _mongo_client.admin.command('ismaster')
            print("MongoDB connection successful")
        except Exception as e:
            print(f"MongoDB connection failed: {str(e)}")
            raise
    
    return _mongo_client

def get_mongodb_database():
    """
    Get MongoDB database (singleton pattern)
    """
    global _mongo_db
    
    if _mongo_db is None:
        client = get_mongodb_client()
        
        # Get database name from settings or use default
        db_name = getattr(settings, 'MONGODB_NAME', 'hcams')
        
        _mongo_db = client[db_name]
    
    return _mongo_db