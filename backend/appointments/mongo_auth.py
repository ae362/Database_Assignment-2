# appointments/mongo_auth.py
import datetime
import jwt
from django.conf import settings
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from .mongo_utils import get_mongodb_database

class MongoJWTAuthentication(authentication.BaseAuthentication):
    """
    Custom JWT authentication for MongoDB users
    """
    def authenticate(self, request):
        # Get the token from the Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            # Decode the token
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            
            # Get MongoDB database
            db = get_mongodb_database()
            
            # Get user from MongoDB
            user_id = payload.get('user_id')
            if not user_id:
                raise AuthenticationFailed('Invalid token payload')
            
            # Try to find user with id
            user = db.users.find_one({'id': user_id})
            
            # If not found, try with _id
            if not user:
                user = db.users.find_one({'_id': user_id})
            
            if not user:
                raise AuthenticationFailed('User not found')
            
            # Create a simple user object that DRF can use
            user_obj = MongoUser(user)
            
            return (user_obj, token)
        
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')
        except Exception as e:
            raise AuthenticationFailed(f'Authentication failed: {str(e)}')
    
    def authenticate_header(self, request):
        return 'Bearer'

class MongoUser:
    """
    A simple wrapper for MongoDB user documents to make them compatible with DRF
    """
    def __init__(self, user_data):
        self.user_data = user_data
        self.id = user_data.get('id') or str(user_data.get('_id'))
        self.username = user_data.get('username') or user_data.get('email')
        self.email = user_data.get('email')
        self.is_authenticated = True
        self.is_active = user_data.get('is_active', True)
        self.is_staff = user_data.get('is_staff', False)
        self.is_superuser = user_data.get('is_superuser', False)
        self.role = user_data.get('role', 'patient')
    
    def __str__(self):
        return self.username
    
    def get_username(self):
        return self.username
    
    def get_id(self):
        return self.id
    
    def has_perm(self, perm, obj=None):
        # Simple permission check - superusers have all permissions
        if self.is_superuser:
            return True
        # Staff users have most permissions
        if self.is_staff and not perm.startswith('admin'):
            return True
        return False
    
    def has_perms(self, perms, obj=None):
        for perm in perms:
            if not self.has_perm(perm, obj):
                return False
        return True
    
    def has_module_perms(self, app_label):
        # Simple module permission check
        if self.is_superuser:
            return True
        if self.is_staff and app_label != 'admin':
            return True
        return False
    
    @property
    def is_anonymous(self):
        return False

def generate_token(user):
    """
    Generate JWT token for user.
    For use with MongoDB.
    """
    # Get secret key from settings
    secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    
    # Create payload
    payload = {
        'user_id': user['id'],
        'email': user['email'],
        'role': user.get('role', 'patient'),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)  # Token expires in 1 day
    }
    
    # Generate token
    token = jwt.encode(payload, secret_key, algorithm='HS256')
    
    # jwt.encode might return bytes in some versions of PyJWT
    if isinstance(token, bytes):
        return token.decode('utf-8')
    
    return token

def get_user_from_token(token):
    """
    Get user from token.
    For use with MongoDB.
    """
    try:
        # Get secret key from settings
        secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        
        # Decode the token
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        
        # Check if token is expired
        if 'exp' in payload and datetime.datetime.fromtimestamp(payload['exp']) < datetime.datetime.utcnow():
            return None
        
        # Get user from MongoDB
        db = get_mongodb_database()
        
        # Find user by ID from token
        user = db.users.find_one({'id': payload.get('user_id')})
        
        return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    except Exception as e:
        print(f"Token authentication error: {str(e)}")
        return None

def authenticate_user(username, password):
    """
    Authenticate a user with username/email and password.
    For use with MongoDB.
    """
    import bcrypt
    
    db = get_mongodb_database()
    
    # Find user by username or email
    user = db.users.find_one({
        '$or': [
            {'username': username},
            {'email': username}
        ]
    })
    
    if not user:
        return None
    
    # Check password
    stored_password = user.get('password', '')
    if isinstance(stored_password, str):
        stored_password = stored_password.encode('utf-8')
        
    if not bcrypt.checkpw(password.encode('utf-8'), stored_password):
        return None
    
    return user