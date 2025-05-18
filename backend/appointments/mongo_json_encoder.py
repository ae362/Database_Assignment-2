import json
from bson import ObjectId
from datetime import datetime

class MongoJSONEncoder(json.JSONEncoder):
    """
    JSONEncoder subclass that knows how to encode MongoDB-specific objects:
    - ObjectId
    - datetime
    """
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(MongoJSONEncoder, self).default(obj)

class MongoResponse:
    """
    Response class that uses MongoJSONEncoder for MongoDB objects
    """
    def __init__(self, data=None, status=200):
        self.data = data
        self.status = status
        
    def to_json(self):
        """
        Convert data to JSON using MongoJSONEncoder
        """
        if self.data is None:
            return None
        return json.loads(json.dumps(self.data, cls=MongoJSONEncoder))