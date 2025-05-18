import threading
import time
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from datetime import datetime, timedelta
from pymongo import DESCENDING
import os
import json
import bcrypt
import traceback
import uuid
import jwt
import pymongo
from bson.objectid import ObjectId
from .mongo_utils import get_mongodb_database, mongo_id_to_str
from .mongodb_json_encoder import MongoJSONEncoder
from .mongo_auth import authenticate_user, generate_token, get_user_from_token
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

# Try to import REST Framework decorators if available
try:
    from rest_framework.decorators import api_view, permission_classes
    from rest_framework.permissions import AllowAny
    REST_FRAMEWORK_AVAILABLE = True
except ImportError:
    REST_FRAMEWORK_AVAILABLE = False
    # Create dummy decorators if REST Framework is not available
    def api_view(methods):
        def decorator(func):
            return func
        return decorator
    
    def permission_classes(classes):
        def decorator(func):
            return func
        return decorator
    
    class AllowAny:
        pass

# Get MongoDB database
db = get_mongodb_database()

# CORS middleware helper function
def add_cors_headers(response):
    """Add CORS headers to response"""
    response["Access-Control-Allow-Origin"] = "*"  # Or specific origin like "http://localhost:3000"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, X-CSRFToken"
    response["Access-Control-Allow-Credentials"] = "true"
    return response

def handle_options_request(request):
    """Handle OPTIONS request for CORS preflight"""
    response = JsonResponse({})
    response = add_cors_headers(response)
    response["Access-Control-Max-Age"] = "86400"  # 24 hours
    return response

@csrf_exempt
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
def login(request):
    """
    Endpoint for user login with role validation
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Log the request for debugging
        print(f"Login request received: {request.method}")
        
        # Parse request body
        try:
            data = json.loads(request.body)
            print(f"Login data received: {data}")
        except json.JSONDecodeError:
            print("Invalid JSON in request body")
            response = JsonResponse({'error': 'Invalid JSON format'}, status=400)
            return add_cors_headers(response)
        
        # Validate required fields
        required_fields = ['email', 'password']
        for field in required_fields:
            if field not in data:
                print(f"Missing required field: {field}")
                response = JsonResponse({'error': f'{field} is required'}, status=400)
                return add_cors_headers(response)
        
        # Get the requested role (optional)
        requested_role = data.get('role', None)
        print(f"Requested role: {requested_role}")
        
        # Find user by email (case-insensitive)
        email = data['email'].lower()
        user = db.users.find_one({'email': {'$regex': f'^{email}$', '$options': 'i'}})
        
        if not user:
            print(f"User not found for email: {email}")
            response = JsonResponse({'error': 'Invalid email or password'}, status=401)
            return add_cors_headers(response)
        
        print(f"User found: {user['email']}")
        
        # Verify password
        try:
            # Handle both string and bytes password hashes
            stored_password = user['password']
            if isinstance(stored_password, str):
                stored_password = stored_password.encode('utf-8')
                
            if not bcrypt.checkpw(data['password'].encode('utf-8'), stored_password):
                print("Password verification failed")
                response = JsonResponse({'error': 'Invalid email or password'}, status=401)
                return add_cors_headers(response)
        except Exception as e:
            print(f"Password verification error: {str(e)}")
            response = JsonResponse({'error': 'Authentication error'}, status=500)
            return add_cors_headers(response)
        
        # If role is specified, verify that the user has that role
        if requested_role and user.get('role') != requested_role:
            print(f"Role mismatch: User role is {user.get('role')}, requested {requested_role}")
            response = JsonResponse({'error': f'User is not registered as a {requested_role}'}, status=403)
            return add_cors_headers(response)
        
        # Update last login
        try:
            db.users.update_one(
                {'id': user['id']},
                {'$set': {'last_login': datetime.now()}}
            )
        except Exception as e:
            print(f"Failed to update last login: {str(e)}")
            # Continue anyway, this is not critical
        
        # Remove password from response
        user_response = user.copy()
        user_response.pop('password', None)
        
        # Generate token
        try:
            token = generate_token(user)
        except Exception as e:
            print(f"Token generation error: {str(e)}")
            response = JsonResponse({'error': 'Failed to generate authentication token'}, status=500)
            return add_cors_headers(response)
        
        # Prepare response data
        response_data = {
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', ''),
                'role': user.get('role', 'patient'),
                'phone': user.get('phone', ''),
                'birthday': user.get('birthday', ''),
                'gender': user.get('gender', ''),
                'address': user.get('address', '')
            }
        }
        
        print("Login successful")
        response = JsonResponse(response_data, status=200, encoder=MongoJSONEncoder)
        return add_cors_headers(response)
    except Exception as e:
        print(f"Login error: {str(e)}")
        print(traceback.format_exc())  # Print full traceback for debugging
        response = JsonResponse({'error': 'An error occurred during login'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
def logout(request):
    """
    Endpoint for user logout
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # With JWT, we don't need to do anything server-side for logout
        # The client should discard the token
        response = JsonResponse({'success': 'Successfully logged out.'})
        return add_cors_headers(response)
    except Exception as e:
        print(f"Logout error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred during logout'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
@api_view(['POST', 'OPTIONS'])
@permission_classes([AllowAny])
def register_patient(request):
    """
    Endpoint for patient registration with CSRF exemption for testing
    """
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response["Access-Control-Max-Age"] = "86400"
        return response
        
    try:
        data = json.loads(request.body)
        print(f"Received registration data: {data}")
        
        # Validate required fields
        required_fields = ['email', 'password', 'first_name', 'last_name']
        for field in required_fields:
            if field not in data:
                response = JsonResponse({'error': f'{field} is required'}, status=400)
                return add_cors_headers(response)
        
        # Check if user already exists
        existing_user = db.users.find_one({'email': data['email']})
        if existing_user:
            response = JsonResponse({'error': 'User with this email already exists'}, status=400)
            return add_cors_headers(response)
        
        # Hash password
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        user_id = str(uuid.uuid4())
        user = {
            'id': user_id,
            'email': data['email'],
            'username': data.get('username', data['email']),
            'password': hashed_password,
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'role': 'patient',
            'is_active': True,
            'is_staff': False,
            'is_superuser': False,
            'date_joined': datetime.now(),
            'last_login': None,
            'phone': data.get('phone', ''),
            'birthday': data.get('birthday', ''),
            'gender': data.get('gender', ''),
            'address': data.get('address', '')
        }
        
        db.users.insert_one(user)
        
        # Create patient profile
        patient = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'name': f"{data['first_name']} {data['last_name']}",
            'email': data['email'],
            'phone': data.get('phone', ''),
            'date_of_birth': data.get('birthday', ''),
            'gender': data.get('gender', ''),
            'address': data.get('address', ''),
            'medical_history': data.get('medical_history', ''),
            'allergies': data.get('allergies', ''),
            'medications': data.get('medications', ''),
            'created_at': datetime.now()
        }
        
        db.patients.insert_one(patient)
        
        # Remove password from response
        user_response = user.copy()
        user_response.pop('password', None)
        
        # Generate token
        token = generate_token(user)
        
        response_data = {
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': 'patient',
                'phone': user.get('phone', ''),
                'birthday': user.get('birthday', ''),
                'gender': user.get('gender', ''),
                'address': user.get('address', '')
            }
        }
        
        print(f"Registration successful for {data['email']}")
        response = JsonResponse(response_data, status=201)
        return add_cors_headers(response)
    except Exception as e:
        print(f"Registration error: {str(e)}")
        response = JsonResponse({'error': f'An error occurred during registration: {str(e)}'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def register_doctor(request):
    """
     Endpoint for doctor registration 
    """
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
        
    if request.method == 'POST':
        try:
            # Parse the request body
            data = json.loads(request.body)
            print(f"Received doctor registration data: {data}")
            
            # Validate required fields
            required_fields = ['email', 'password', 'first_name', 'last_name', 'specialization']
            for field in required_fields:
                if field not in data:
                    return JsonResponse({'error': f'{field} is required'}, status=400)
            
            # Check if user already exists
            from pymongo import MongoClient
            from django.conf import settings
            
            client = MongoClient(settings.MONGODB_URI)
            db = client[settings.MONGODB_NAME]
            
            existing_user = db.users.find_one({'email': data['email']})
            if existing_user:
                return JsonResponse({'error': 'User with this email already exists'}, status=400)
            
            # Hash password
            hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create user ID
            user_id = str(uuid.uuid4())
            
            # Create user
            user = {
                'id': user_id,
                'email': data['email'],
                'username': data.get('username', data['email'].split('@')[0]),
                'password': hashed_password,
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'role': 'doctor',
                'is_active': True,
                'is_staff': False,
                'is_superuser': False,
                'date_joined': datetime.now(),
                'last_login': None,
                'phone': data.get('phone', ''),
            }
            
            db.users.insert_one(user)
            
            # Create doctor profile
            doctor = {
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'name': f"{data['first_name']} {data['last_name']}",
                'email': data['email'],
                'phone': data.get('phone', ''),
                'specialization': data['specialization'],
                'qualification': data.get('qualification', ''),
                'experience_years': data.get('experience_years', 0),
                'consultation_fee': data.get('consultation_fee', '20.00'),
                'available_days': data.get('available_days', ''),
                'bio': data.get('bio', ''),
                'created_at': datetime.now()
            }
            
            db.doctors.insert_one(doctor)
            
            # Generate token for the user
            import jwt
            
            # Use timedelta correctly
            expiration_time = datetime.now() + timedelta(days=1)
            
            payload = {
                'user_id': user_id,
                'email': data['email'],
                'role': 'doctor',
                'exp': int(expiration_time.timestamp())  # Convert to Unix timestamp
            }
            
            secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
            token = jwt.encode(payload, secret_key, algorithm='HS256')
            
            # Return success response
            response_data = {
                'success': True,
                'message': 'Doctor registered successfully',
                'token': token,
                'user': {
                    'id': user_id,
                    'email': data['email'],
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'role': 'doctor'
                }
            }
            
            return JsonResponse(response_data, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            print(f"Doctor registration error: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def user_profile(request):
    """
    Endpoint for user profile management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Get user ID from token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        if request.method == 'GET':
            # Remove password from response
            user.pop('password', None)
            response = JsonResponse(user, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        elif request.method == 'PATCH':
            # Update user
            data = json.loads(request.body)
            
            # Don't allow updating certain fields
            protected_fields = ['id', 'email', 'password', 'role', 'is_active', 'is_staff', 'is_superuser']
            update_data = {k: v for k, v in data.items() if k not in protected_fields}
            
            db.users.update_one(
                {'id': user['id']},
                {'$set': update_data}
            )
            
            # Get updated user
            updated_user = db.users.find_one({'id': user['id']})
            updated_user.pop('password', None)
            
            response = JsonResponse(updated_user, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"User profile error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def avatar_upload(request):
    """
    Endpoint for avatar upload
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        if request.method != 'POST':
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
            
        # Get user ID from token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        if 'avatar' not in request.FILES:
            response = JsonResponse({'error': 'No avatar file provided'}, status=400)
            return add_cors_headers(response)
        
        file = request.FILES['avatar']
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif']
        if file.content_type not in allowed_types:
            response = JsonResponse(
                {'error': 'Unsupported file type. Please upload JPEG, PNG, or GIF'},
                status=400
            )
            return add_cors_headers(response)

        # Delete old avatar if it exists
        if 'avatar' in user and user['avatar']:
            try:
                old_path = user['avatar']
                if os.path.isfile(old_path):
                    os.remove(old_path)
            except:
                pass

        # Save new avatar
        filename = f'avatars/user_{user["id"]}_{file.name}'
        
        # Save the file using default storage
        default_storage.save(filename, ContentFile(file.read()))
        
        # Update user in database
        db.users.update_one(
            {'id': user['id']},
            {'$set': {'avatar': filename}}
        )
        
        # Get updated user
        updated_user = db.users.find_one({'id': user['id']})
        updated_user.pop('password', None)
        
        response = JsonResponse(updated_user, encoder=MongoJSONEncoder)
        return add_cors_headers(response)
    except Exception as e:
        print(f"Avatar upload error: {str(e)}")
        response = JsonResponse({'error': f'Failed to upload avatar: {str(e)}'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def users(request, id=None):
    """
    Endpoint for user management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is authorized
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        current_user = get_user_from_token(token)
        
        if not current_user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # LIST
        if request.method == 'GET' and id is None:
            # Check if user is admin
            if current_user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get all users
            users = list(db.users.find())
            
            # Remove passwords
            for user in users:
                user.pop('password', None)
            
            response = JsonResponse(users, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Check if user is admin or the requested user
            if current_user.get('role') != 'admin' and current_user['id'] != id:
                response = JsonResponse({'error': 'You do not have permission to view this user'}, status=403)
                return add_cors_headers(response)
            
            # Get user
            user = db.users.find_one({'id': id})
            if not user:
                response = JsonResponse({'error': 'User not found'}, status=404)
                return add_cors_headers(response)
            
            # Remove password
            user.pop('password', None)
            
            response = JsonResponse(user, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            # Check if user is admin
            if current_user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['email', 'password', 'first_name', 'last_name', 'role']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Check if user already exists
            existing_user = db.users.find_one({'email': data['email']})
            if existing_user:
                response = JsonResponse({'error': 'User with this email already exists'}, status=400)
                return add_cors_headers(response)
            
            # Hash password
            hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create user
            user_id = str(uuid.uuid4())
            user = {
                'id': user_id,
                'email': data['email'],
                'username': data.get('username', data['email']),
                'password': hashed_password,
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'role': data['role'],
                'is_active': True,
                'is_staff': data['role'] in ['admin', 'doctor'],
                'is_superuser': data['role'] == 'admin',
                'date_joined': datetime.now(),
                'last_login': None
            }
            
            db.users.insert_one(user)
            
            # Remove password from response
            user.pop('password', None)
            
            response = JsonResponse(user, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Check if user is admin or the requested user
            if current_user.get('role') != 'admin' and current_user['id'] != id:
                response = JsonResponse({'error': 'You do not have permission to update this user'}, status=403)
                return add_cors_headers(response)
            
            # Get user
            user = db.users.find_one({'id': id})
            if not user:
                response = JsonResponse({'error': 'User not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Don't allow updating certain fields unless admin
            protected_fields = ['id', 'email', 'role', 'is_active', 'is_staff', 'is_superuser']
            if current_user.get('role') != 'admin':
                update_data = {k: v for k, v in data.items() if k not in protected_fields}
            else:
                update_data = data
            
            # Handle password update separately
            if 'password' in update_data:
                update_data['password'] = bcrypt.hashpw(update_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Update user
            db.users.update_one(
                {'id': id},
                {'$set': update_data}
            )
            
            # Get updated user
            updated_user = db.users.find_one({'id': id})
            updated_user.pop('password', None)
            
            response = JsonResponse(updated_user, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Check if user is admin
            if current_user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get user
            user = db.users.find_one({'id': id})
            if not user:
                response = JsonResponse({'error': 'User not found'}, status=404)
                return add_cors_headers(response)
            
            # Delete user
            db.users.delete_one({'id': id})
            
            # Delete related data
            if user.get('role') == 'patient':
                db.patients.delete_many({'user_id': id})
            elif user.get('role') == 'doctor':
                db.doctors.delete_many({'user_id': id})
            
            response = JsonResponse({'message': 'User deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Users endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def new_user_form(request):
    """
    Get form fields for creating a new user
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is admin
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        current_user = get_user_from_token(token)
        
        if not current_user or current_user.get('role') != 'admin':
            response = JsonResponse({'error': 'Admin privileges required'}, status=403)
            return add_cors_headers(response)
        
        form_data = {
            "message": "Ready to create new user",
            "fields": [
                {"name": "email", "type": "email", "required": True},
                {"name": "password", "type": "password", "required": True},
                {"name": "first_name", "type": "string", "required": True},
                {"name": "last_name", "type": "string", "required": True},
                {"name": "role", "type": "select", "required": True, "options": ["admin", "doctor", "patient"]},
                {"name": "phone", "type": "string", "required": False},
                {"name": "birthday", "type": "date", "required": False},
                {"name": "gender", "type": "select", "required": False, "options": ["male", "female", "other", "prefer-not-to-say"]},
                {"name": "address", "type": "string", "required": False}
            ]
        }
        
        response = JsonResponse(form_data)
        return add_cors_headers(response)
    except Exception as e:
        print(f"New user form error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)
    
def parse_days_string(days_string):
    """Parse a string of days into an array of day names"""
    # Common patterns
    if not days_string:
        return []
        
    if isinstance(days_string, list):
        return days_string
        
    days_string = days_string.lower()
    
    # List of all possible days
    all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Check for "Monday to Friday" pattern
    if "monday to friday" in days_string:
        return all_days[:5]  # Monday through Friday
        
    # Check for "Weekdays" pattern
    if "weekdays" in days_string:
        return all_days[:5]  # Monday through Friday
        
    # Check for "Weekends" pattern
    if "weekends" in days_string:
        return all_days[5:]  # Saturday and Sunday
        
    # Check for "All days" or "Everyday" pattern
    if "all days" in days_string or "everyday" in days_string or "every day" in days_string:
        return all_days
        
    # Check for specific days
    result = []
    for day in all_days:
        # Check for plural forms like "Mondays" or singular "Monday"
        if day.lower() in days_string or day.lower()[:-1] + "s" in days_string:
            result.append(day)
            
    return result

@csrf_exempt
def doctors(request, id=None):
    """
    Endpoint for doctor management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # LIST
        if request.method == 'GET' and id is None:
            doctors_list = list(db.doctors.find())
            response = JsonResponse(doctors_list, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            doctor = db.doctors.find_one({'id': id})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            response = JsonResponse(doctor, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # For other methods, check authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # CREATE
        if request.method == 'POST' and id is None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['name', 'specialization', 'email', 'phone']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Check if doctor already exists
            existing_doctor = db.doctors.find_one({'email': data['email']})
            if existing_doctor:
                response = JsonResponse({'error': 'Doctor with this email already exists'}, status=400)
                return add_cors_headers(response)
                
            # Check if user already exists
            existing_user = db.users.find_one({'email': data['email']})
            if existing_user:
                response = JsonResponse({'error': 'User with this email already exists'}, status=400)
                return add_cors_headers(response)
            
            # Process available_days - convert string to array if needed
            if 'available_days' in data and isinstance(data['available_days'], str):
                data['available_days'] = parse_days_string(data['available_days'])
            elif 'available_days' not in data or data['available_days'] is None:
                data['available_days'] = []
            
            # Set default values for new fields
            if 'emergency_available' not in data:
                data['emergency_available'] = False
                
            if 'daily_patient_limit' not in data:
                data['daily_patient_limit'] = 20
                
            if 'is_available' not in data:
                data['is_available'] = True
            
            # Remove medical_center and medical_center_name if present
            if 'medical_center' in data:
                del data['medical_center']
                
            if 'medical_center_name' in data:
                del data['medical_center_name']
            
            # Create user account first
            user_id = str(uuid.uuid4())
            
            # Hash password if provided
            if 'password' in data:
                hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            else:
                # Generate a random password if not provided
                import random
                import string
                random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
                hashed_password = bcrypt.hashpw(random_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create user document
            user = {
                'id': user_id,
                'email': data['email'],
                'username': data.get('username', data['email'].split('@')[0]),
                'password': hashed_password,
                'first_name': data.get('first_name', data['name'].split(' ')[0]),
                'last_name': data.get('last_name', ' '.join(data['name'].split(' ')[1:]) if len(data['name'].split(' ')) > 1 else ''),
                'role': 'doctor',
                'is_active': True,
                'is_staff': False,
                'is_superuser': False,
                'date_joined': datetime.now(),
                'last_login': None,
                'phone': data.get('phone', ''),
            }
            
            db.users.insert_one(user)
            
            # Create doctor
            doctor_id = str(uuid.uuid4())
            doctor = {
                'id': doctor_id,
                'user_id': user_id,
                'name': data['name'],
                'specialization': data['specialization'],
                'email': data['email'],
                'phone': data['phone'],
                'qualification': data.get('qualification', ''),
                'experience_years': data.get('experience_years', 0),
                'consultation_fee': data.get('consultation_fee', ''),
                'available_days': data.get('available_days', []),
                'bio': data.get('bio', ''),
                'emergency_available': data.get('emergency_available', False),
                'daily_patient_limit': data.get('daily_patient_limit', 20),
                'is_available': data.get('is_available', True),
                'created_at': datetime.now()
            }
            
            db.doctors.insert_one(doctor)
            
            response = JsonResponse(doctor, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            doctor = db.doctors.find_one({'id': id})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Process available_days - convert string to array if needed
            if 'available_days' in data and isinstance(data['available_days'], str):
                data['available_days'] = parse_days_string(data['available_days'])
            
            # Remove medical_center and medical_center_name if present
            if 'medical_center' in data:
                del data['medical_center']
                
            if 'medical_center_name' in data:
                del data['medical_center_name']
            
            # Update doctor
            db.doctors.update_one(
                {'id': id},
                {'$set': data}
            )
            
            # Get updated doctor
            updated_doctor = db.doctors.find_one({'id': id})
            
            response = JsonResponse(updated_doctor, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            doctor = db.doctors.find_one({'id': id})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            # Delete doctor
            db.doctors.delete_one({'id': id})
            
            response = JsonResponse({'message': 'Doctor deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Doctors endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)



@csrf_exempt
def doctor_availability(request, doctor_id=None, availability_id=None):
    """
    Endpoint for doctor availability management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if doctor exists
        if doctor_id:
            doctor = db.doctors.find_one({'id': doctor_id})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
        
        # GET - retrieve availability
        if request.method == 'GET':
            if doctor_id:
                # Get doctor's available days
                available_days = doctor.get('available_days', [])
                
                # Get day-specific data if it exists
                day_specific_data = doctor.get('day_specific_data', {})
                
                # Get doctor's exceptions (days off)
                exceptions = list(db.doctor_exceptions.find({'doctor_id': doctor_id}))
                
                # Get doctor's appointments
                appointments = list(db.appointments.find({'doctor': doctor_id, 'status': 'scheduled'}))
                
                # Format response
                availability_data = {
                    'doctor_id': doctor_id,
                    'doctor_name': doctor['name'],
                    'available_days': available_days,
                    'day_specific_data': day_specific_data,
                    'exceptions': exceptions,
                    'appointments': appointments,
                    'emergency_available': doctor.get('emergency_available', False),
                    'daily_patient_limit': doctor.get('daily_patient_limit', 20),
                    'is_available': doctor.get('is_available', True)
                }
                
                response = JsonResponse(availability_data, encoder=MongoJSONEncoder)
                return add_cors_headers(response)
            else:
                # Get all doctors
                doctors = list(db.doctors.find())
                
                # Format response
                response_data = []
                
                for doctor in doctors:
                    # Get doctor's exceptions (days off)
                    exceptions = list(db.doctor_exceptions.find({'doctor_id': doctor['id']}))
                    
                    # Get doctor's appointments
                    appointments = list(db.appointments.find({'doctor': doctor['id'], 'status': 'scheduled'}))
                    
                    # Format doctor data
                    doctor_data = {
                        'doctor_id': doctor['id'],
                        'doctor_name': doctor['name'],
                        'available_days': doctor.get('available_days', []),
                        'day_specific_data': doctor.get('day_specific_data', {}),
                        'exceptions': exceptions,
                        'appointments': appointments,
                        'emergency_available': doctor.get('emergency_available', False),
                        'daily_patient_limit': doctor.get('daily_patient_limit', 20),
                        'is_available': doctor.get('is_available', True)
                    }
                    
                    response_data.append(doctor_data)
                
                response = JsonResponse(response_data, safe=False, encoder=MongoJSONEncoder)
                return add_cors_headers(response)
        
        # For other methods, check authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # Check if user is admin or the doctor
        is_admin = user.get('role') == 'admin'
        is_doctor = False
        
        if user.get('role') == 'doctor':
            doctor_user = db.doctors.find_one({'user_id': user['id']})
            if doctor_user and doctor_user['id'] == doctor_id:
                is_doctor = True
        
        if not (is_admin or is_doctor):
            response = JsonResponse({'error': 'Unauthorized'}, status=403)
            return add_cors_headers(response)
        
        # POST - set availability
        if request.method == 'POST':
            data = json.loads(request.body)
            print(f"Received availability data: {data}")
            
            update_data = {}
            
            # Process available_days - convert string to array if needed
            if 'available_days' in data:
                if isinstance(data['available_days'], str):
                    update_data['available_days'] = parse_days_string(data['available_days'])
                else:
                    update_data['available_days'] = data['available_days']
            
            # Update day_specific_data if provided
            if 'day_specific_data' in data and isinstance(data['day_specific_data'], dict):
                update_data['day_specific_data'] = data['day_specific_data']
            
            # Update emergency_available if provided
            if 'emergency_available' in data:
                update_data['emergency_available'] = data['emergency_available']
            
            # Update daily_patient_limit if provided
            if 'daily_patient_limit' in data:
                update_data['daily_patient_limit'] = data['daily_patient_limit']
            
            # Update is_available if provided
            if 'is_available' in data:
                update_data['is_available'] = data['is_available']
            
            # Update doctor with all changes at once
            if update_data:
                db.doctors.update_one(
                    {'id': doctor_id},
                    {'$set': update_data}
                )
            
            # Get updated doctor
            updated_doctor = db.doctors.find_one({'id': doctor_id})
            
            # Format response to match the GET response structure
            availability_data = {
                'doctor_id': doctor_id,
                'doctor_name': updated_doctor['name'],
                'available_days': updated_doctor.get('available_days', []),
                'day_specific_data': updated_doctor.get('day_specific_data', {}),
                'exceptions': list(db.doctor_exceptions.find({'doctor_id': doctor_id})),
                'appointments': list(db.appointments.find({'doctor': doctor_id, 'status': 'scheduled'})),
                'emergency_available': updated_doctor.get('emergency_available', False),
                'daily_patient_limit': updated_doctor.get('daily_patient_limit', 20),
                'is_available': updated_doctor.get('is_available', True)
            }
            
            response = JsonResponse(availability_data, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Doctor availability error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def patients(request, id=None):
    """
    Endpoint for patient management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is authorized
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # LIST
        if request.method == 'GET' and id is None:
            # Check if user is admin or doctor
            if user.get('role') not in ['admin', 'doctor']:
                # For patients, only return their own record
                if user.get('role') == 'patient':
                    patient = db.patients.find_one({'user_id': user['id']})
                    if patient:
                        response = JsonResponse([patient], safe=False, encoder=MongoJSONEncoder)
                    else:
                        response = JsonResponse([], safe=False)
                    return add_cors_headers(response)
                else:
                    response = JsonResponse({'error': 'Admin or doctor privileges required'}, status=403)
                    return add_cors_headers(response)
            
            # Get all patients
            patients = list(db.patients.find())
            
            response = JsonResponse(patients, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Get patient
            patient = db.patients.find_one({'id': id})
            if not patient:
                # Try to find by user_id if id not found
                patient = db.patients.find_one({'user_id': id})
                if not patient:
                    response = JsonResponse({'error': 'Patient not found'}, status=404)
                    return add_cors_headers(response)
            
            # Check if user has permission to view this patient
            if user.get('role') not in ['admin', 'doctor'] and user['id'] != patient.get('user_id'):
                response = JsonResponse({'error': 'You do not have permission to view this patient'}, status=403)
                return add_cors_headers(response)
            
            response = JsonResponse(patient, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['name', 'email']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Check if patient already exists
            existing_patient = db.patients.find_one({'email': data['email']})
            if existing_patient:
                # If patient exists and belongs to this user, return it
                if existing_patient.get('user_id') == user['id']:
                    response = JsonResponse(existing_patient, encoder=MongoJSONEncoder)
                    return add_cors_headers(response)
                # If patient exists but belongs to another user, error
                elif user.get('role') != 'admin':
                    response = JsonResponse({'error': 'Patient with this email already exists'}, status=400)
                    return add_cors_headers(response)
            
            # Create patient
            patient_id = str(uuid.uuid4())
            
            # Set user_id based on who is creating the patient
            if user.get('role') == 'admin' and 'user_id' in data:
                # Admin can specify user_id
                user_id = data['user_id']
            else:
                # Regular users can only create patients for themselves
                user_id = user['id']
            
            # Create patient with arrays for medical data
            patient = {
                'id': patient_id,
                'user_id': user_id,
                'name': data['name'],
                'email': data['email'],
                'phone': data.get('phone', ''),
                'date_of_birth': data.get('date_of_birth', ''),
                'gender': data.get('gender', ''),
                'address': data.get('address', ''),
                # Use arrays for medical data
                'medical_info': {
                    'blood_type': data.get('blood_type', '')
                },
                'medical_history': data.get('medical_history', []),
                'allergies': data.get('allergies', []),
                'medications': data.get('medications', []),
                'chronic_diseases': data.get('chronic_diseases', []),
                'created_at': datetime.now(),
                'last_updated': datetime.now()
            }
            
            db.patients.insert_one(patient)
            
            response = JsonResponse(patient, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Get patient
            patient = db.patients.find_one({'id': id})
            if not patient:
                # Try to find by user_id if id not found
                patient = db.patients.find_one({'user_id': id})
                if not patient:
                    # If patient doesn't exist and this is a patient user, create one
                    if user.get('role') == 'patient' and id == user['id']:
                        # Create a new patient record for this user
                        data = json.loads(request.body)
                        patient_id = str(uuid.uuid4())
                        
                        # Create patient with arrays for medical data
                        patient = {
                            'id': patient_id,
                            'user_id': user['id'],
                            'name': f"{user.get('first_name', '')} {user.get('last_name', '')}",
                            'email': user.get('email', ''),
                            'phone': user.get('phone', ''),
                            'date_of_birth': user.get('birthday', ''),
                            'gender': user.get('gender', ''),
                            'address': user.get('address', ''),
                            # Use arrays for medical data
                            'medical_info': {
                                'blood_type': data.get('blood_type', '')
                            },
                            'medical_history': data.get('medical_history', []),
                            'allergies': data.get('allergies', []),
                            'medications': data.get('medications', []),
                            'chronic_diseases': data.get('chronic_diseases', []),
                            'created_at': datetime.now(),
                            'last_updated': datetime.now()
                        }
                        
                        db.patients.insert_one(patient)
                        
                        response = JsonResponse(patient, status=201, encoder=MongoJSONEncoder)
                        return add_cors_headers(response)
                    else:
                        response = JsonResponse({'error': 'Patient not found'}, status=404)
                        return add_cors_headers(response)
            
            # Check if user has permission to update this patient
            # Modified permission check to handle missing user_id and ensure type consistency
            patient_user_id = patient.get('user_id')
            current_user_id = user.get('id')
            
            print(f"Debug - Patient user_id: {patient_user_id}, Current user_id: {current_user_id}")
            
            # Allow the update if:
            # 1. User is admin, OR
            # 2. User ID matches patient's user_id, OR
            # 3. Patient has no user_id (first time setup)
            if (user.get('role') == 'admin' or 
                str(current_user_id) == str(patient_user_id) or 
                patient_user_id is None):
                # Update patient
                data = json.loads(request.body)
                
                # If patient has no user_id, set it to the current user's ID
                if patient_user_id is None:
                    data['user_id'] = current_user_id
                
                # Ensure medical data is stored as arrays
                if 'medical_history' in data and not isinstance(data['medical_history'], list):
                    if data['medical_history']:
                        data['medical_history'] = [data['medical_history']]
                    else:
                        data['medical_history'] = []
                
                if 'allergies' in data and not isinstance(data['allergies'], list):
                    if data['allergies']:
                        data['allergies'] = [data['allergies']]
                    else:
                        data['allergies'] = []
                
                if 'medications' in data and not isinstance(data['medications'], list):
                    if data['medications']:
                        data['medications'] = [data['medications']]
                    else:
                        data['medications'] = []
                
                if 'chronic_diseases' in data and not isinstance(data['chronic_diseases'], list):
                    if data['chronic_diseases']:
                        data['chronic_diseases'] = [data['chronic_diseases']]
                    else:
                        data['chronic_diseases'] = []
                
                # Handle blood_type in medical_info object
                if 'blood_type' in data:
                    # Create medical_info if it doesn't exist
                    update_data = {}
                    for key, value in data.items():
                        if key != 'blood_type':
                            update_data[key] = value
                    
                    # Update medical_info.blood_type
                    db.patients.update_one(
                        {'id': patient['id']},
                        {
                            '$set': update_data,
                            '$set': {'medical_info.blood_type': data['blood_type']}
                        }
                    )
                else:
                    # Regular update without blood_type
                    db.patients.update_one(
                        {'id': patient['id']},
                        {'$set': data}
                    )
                
                # Add last_updated timestamp
                db.patients.update_one(
                    {'id': patient['id']},
                    {'$set': {'last_updated': datetime.now()}}
                )
                
                # Get updated patient
                updated_patient = db.patients.find_one({'id': patient['id']})
                
                response = JsonResponse(updated_patient, encoder=MongoJSONEncoder)
                return add_cors_headers(response)
            else:
                response = JsonResponse({'error': 'You do not have permission to update this patient'}, status=403)
                return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            patient = db.patients.find_one({'id': id})
            if not patient:
                response = JsonResponse({'error': 'Patient not found'}, status=404)
                return add_cors_headers(response)
            
            # Delete patient
            db.patients.delete_one({'id': id})
            
            response = JsonResponse({'message': 'Patient deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Patients endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def appointments(request, id=None):
    """
    Endpoint for appointment management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is authorized
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            response = JsonResponse({'error': 'No authorization header provided'}, status=401)
            return add_cors_headers(response)
            
        # Extract the token - handle both Token and Bearer formats
        if auth_header.startswith('Token '):
            token = auth_header.split(' ')[1]
        elif auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            response = JsonResponse({'error': 'Invalid authorization format'}, status=401)
            return add_cors_headers(response)
        
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # LIST
        if request.method == 'GET' and id is None:
            # Check if this is an admin user requesting all appointments
            is_admin_request = user.get('role') == 'admin' and request.GET.get('admin') == 'true'
            
            # Check if filtering by doctor
            doctor_id = request.GET.get('doctor')
            
            if is_admin_request:
                # Admin users can see all appointments
                if doctor_id:
                    appointments = list(db.appointments.find({'doctor': doctor_id}).sort('date', -1))
                else:
                    appointments = list(db.appointments.find().sort('date', -1))
            else:
                # Regular users only see their own appointments
                if user.get('role') == 'doctor':
                    doctor = db.doctors.find_one({'user_id': user['id']})
                    if doctor:
                        appointments = list(db.appointments.find({'doctor': doctor['id']}).sort('date', -1))
                    else:
                        appointments = []
                else:
                    appointments = list(db.appointments.find({'patient': user['id']}).sort('date', -1))
            
            # Convert MongoDB ObjectId to string
            for appointment in appointments:
                if '_id' in appointment:
                    appointment['_id'] = str(appointment['_id'])
            
            response = JsonResponse(appointments, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to view this appointment
            if user.get('role') != 'admin' and user['id'] != appointment['patient'] and user['id'] != appointment['doctor']:
                response = JsonResponse({'error': 'You do not have permission to view this appointment'}, status=403)
                return add_cors_headers(response)
            
            response = JsonResponse(appointment, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            data = json.loads(request.body)
            print(f"Received appointment data: {data}")  # Debug log
            
            # Validate required fields
            required_fields = ['doctor', 'date']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Get doctor
            doctor = db.doctors.find_one({'id': data['doctor']})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            # Parse date
            try:
                appointment_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            except:
                response = JsonResponse({'error': 'Invalid date format'}, status=400)
                return add_cors_headers(response)
            
            # Check for conflicts
            existing = db.appointments.find_one({
                'doctor': doctor['id'],
                'date': appointment_date,
                'status': 'scheduled'
            })
            
            if existing:
                response = JsonResponse({'error': 'This time slot is already booked'}, status=400)
                return add_cors_headers(response)
            
            # Helper function to convert string to array
            def format_to_array(value):
                if isinstance(value, list):
                    return value
                if not value:
                    return []
                return [item.strip() for item in value.split(',') if item.strip()]
            
            # Get patient data
            patient = db.patients.find_one({'user_id': user['id']})
            
            # Create appointment with proper nested structure
            appointment_id = str(uuid.uuid4())
            
            # Get patient data for embedding
            patient_data = {
                'name': data.get('patientName', f"{user['first_name']} {user['last_name']}"),
                'phone': data.get('patientPhone', user.get('phone', '')),
                'email': data.get('patientEmail', user.get('email', ''))
            }
            
            # Get doctor data for embedding
            doctor_data = {
                'name': doctor['name'],
                'specialization': doctor.get('specialization', ''),
                'phone': doctor.get('phone', '')
            }
            
            # Process blood type - check multiple possible sources
            blood_type = ''
            if 'blood_type' in data and data['blood_type']:
                blood_type = data['blood_type']
            elif 'bloodType' in data and data['bloodType']:
                blood_type = data['bloodType']
            elif 'medical_data' in data and 'blood_type' in data['medical_data'] and data['medical_data']['blood_type']:
                blood_type = data['medical_data']['blood_type']
            elif patient and 'blood_type' in patient and patient['blood_type']:
                blood_type = patient['blood_type']
            elif patient and 'medical_info' in patient and 'blood_type' in patient['medical_info'] and patient['medical_info']['blood_type']:
                blood_type = patient['medical_info']['blood_type']
            
            # If blood_type is still empty, set a default value
            if not blood_type and data.get('notes') and 'blood type' in data.get('notes', '').lower():
                # Try to extract blood type from notes
                notes = data.get('notes', '').lower()
                blood_types = ['a+', 'a-', 'b+', 'b-', 'ab+', 'ab-', 'o+', 'o-']
                for bt in blood_types:
                    if bt in notes:
                        blood_type = bt.upper()
                        break
            
            # Process allergies - check multiple possible sources
            allergies = []
            if 'allergies' in data:
                allergies = format_to_array(data['allergies'])
            elif 'medical_data' in data and 'allergies' in data['medical_data']:
                allergies = data['medical_data']['allergies']
            elif patient and 'allergies' in patient:
                allergies = patient['allergies']
            elif patient and 'medical_info' in patient and 'allergies' in patient['medical_info']:
                allergies = patient['medical_info']['allergies']
            
            # Ensure allergies is not empty
            if not allergies:
                allergies = ["example1"]
            
            # Process medications - check multiple possible sources
            medications = []
            if 'medications' in data:
                medications = format_to_array(data['medications'])
            elif 'medical_data' in data and 'medications' in data['medical_data']:
                medications = data['medical_data']['medications']
            elif patient and 'medications' in patient:
                medications = patient['medications']
            elif patient and 'medical_info' in patient and 'medications' in patient['medical_info']:
                medications = patient['medical_info']['medications']
            
            # Ensure medications is not empty
            if not medications:
                medications = ["example1"]
            
            # Process medical conditions - check multiple possible sources
            medical_conditions = []
            if 'medical_conditions' in data:
                medical_conditions = format_to_array(data['medical_conditions'])
            elif 'medical_data' in data and 'medical_conditions' in data['medical_data']:
                medical_conditions = data['medical_data']['medical_conditions']
            elif patient and 'medical_history' in patient:
                medical_conditions = patient['medical_history']
            elif patient and 'medical_info' in patient and 'medical_history' in patient['medical_info']:
                medical_conditions = patient['medical_info']['medical_history']
            elif patient and 'chronic_diseases' in patient:
                medical_conditions = patient['chronic_diseases']
            elif patient and 'medical_info' in patient and 'chronic_diseases' in patient['medical_info']:
                medical_conditions = patient['medical_info']['chronic_diseases']
            
            # Ensure medical_conditions is not empty
            if not medical_conditions:
                medical_conditions = ["example1"]
            
            # Format medical data
            medical_data = {
                'blood_type': blood_type,
                'allergies': allergies,
                'medications': medications,
                'medical_conditions': medical_conditions,
                'reason_for_visit': data.get('reason_for_visit', data.get('notes', ''))
            }
            
            print(f"Processed medical data: {medical_data}")  # Debug log
            
            # Create appointment with nested structure
            appointment = {
                'id': appointment_id,
                'patient': user['id'],
                'patient_name': patient_data['name'],
                'doctor': doctor['id'],
                'doctor_name': doctor['name'],
                'date': appointment_date,
                'notes': data.get('notes', ''),
                'status': 'scheduled',
                
                # Add nested objects
                'patient_info': patient_data,
                'doctor_info': doctor_data,
                'medical_data': medical_data,
                
                'created_at': datetime.now()
            }
            
            db.appointments.insert_one(appointment)
            
            response = JsonResponse(appointment, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to update this appointment
            if user.get('role') != 'admin' and user['id'] != appointment['patient'] and user['id'] != appointment['doctor']:
                response = JsonResponse({'error': 'You do not have permission to update this appointment'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Helper function to convert string to array
            def format_to_array(value):
                if isinstance(value, list):
                    return value
                if not value:
                    return []
                return [item.strip() for item in value.split(',') if item.strip()]
            
            # Update nested objects if provided
            if 'patient_info' in data or 'patientPhone' in data or 'patientEmail' in data or 'patientName' in data:
                # Get existing patient_info or create new one
                patient_info = appointment.get('patient_info', {})
                
                # Update with new data
                if 'patient_info' in data and isinstance(data['patient_info'], dict):
                    patient_info.update(data['patient_info'])
                
                # Update individual fields if provided
                if 'patientPhone' in data:
                    patient_info['phone'] = data['patientPhone']
                if 'patientEmail' in data:
                    patient_info['email'] = data['patientEmail']
                if 'patientName' in data:
                    patient_info['name'] = data['patientName']
                
                # Add updated patient_info to data
                data['patient_info'] = patient_info
            
            # Update medical_data if provided
            if ('medical_data' in data or 'blood_type' in data or 'bloodType' in data or 'allergies' in data or 
                'medications' in data or 'medical_conditions' in data or 'reason_for_visit' in data):
                
                # Get existing medical_data or create new one
                medical_data = appointment.get('medical_data', {})
                
                # Update with new data
                if 'medical_data' in data and isinstance(data['medical_data'], dict):
                    medical_data.update(data['medical_data'])
                
                # Update individual fields if provided
                if 'blood_type' in data:
                    medical_data['blood_type'] = data['blood_type']
                elif 'bloodType' in data:
                    medical_data['blood_type'] = data['bloodType']
                
                if 'allergies' in data:
                    medical_data['allergies'] = format_to_array(data['allergies'])
                if 'medications' in data:
                    medical_data['medications'] = format_to_array(data['medications'])
                if 'medical_conditions' in data:
                    medical_data['medical_conditions'] = format_to_array(data['medical_conditions'])
                if 'reason_for_visit' in data:
                    medical_data['reason_for_visit'] = data['reason_for_visit']
                
                # Add updated medical_data to data
                data['medical_data'] = medical_data
            
            # Update appointment
            db.appointments.update_one(
                {'id': id},
                {'$set': data}
            )
            
            # Get updated appointment
            updated_appointment = db.appointments.find_one({'id': id})
            
            response = JsonResponse(updated_appointment, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to delete this appointment
            if user.get('role') != 'admin' and user['id'] != appointment['patient']:
                response = JsonResponse({'error': 'You do not have permission to delete this appointment'}, status=403)
                return add_cors_headers(response)
            
            # Delete appointment
            db.appointments.delete_one({'id': id})
            
            response = JsonResponse({'message': 'Appointment deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Appointments endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def new_appointment_form(request):
    """
    Get form fields for creating a new appointment
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Get all doctors for the dropdown
        doctors = list(db.doctors.find())
        
        form_data = {
            "message": "Ready to create new appointment",
            "fields": [
                {"name": "doctor", "type": "select", "required": True},
                {"name": "date", "type": "date", "required": True},
                {"name": "time", "type": "time", "required": True},
                {"name": "blood_type", "type": "select", "required": False},
                {"name": "medications", "type": "text", "required": False},
                {"name": "allergies", "type": "text", "required": False},
                {"name": "medical_conditions", "type": "text", "required": False},
                {"name": "reason_for_visit", "type": "text", "required": False},
                {"name": "notes", "type": "text", "required": False}
            ],
            "doctors": doctors,
        }
        
        response = JsonResponse(form_data, encoder=MongoJSONEncoder)
        return add_cors_headers(response)
    except Exception as e:
        print(f"New appointment form error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)


@csrf_exempt
def update_appointment_status(request, appointment_id):
    """
    Special endpoint to allow doctors to update the status of their own appointments.
    This bypasses the normal permission checks.
    """
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "PATCH, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
        
    if request.method == 'PATCH':
        try:
            # Get the token from the Authorization header
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            
            if not auth_header or not auth_header.startswith('Token '):
                return JsonResponse({"error": "Authentication required"}, status=401)
            
            token = auth_header.split(' ')[1]
            
            # Decode the token to get the user ID
            try:
                secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, secret_key, algorithms=['HS256'])
                user_id = payload.get('user_id')
                
                if not user_id:
                    return JsonResponse({"error": "Invalid token"}, status=401)
            except jwt.ExpiredSignatureError:
                return JsonResponse({"error": "Token expired"}, status=401)
            except jwt.InvalidTokenError:
                return JsonResponse({"error": "Invalid token"}, status=401)
            
            # Parse the request body
            data = json.loads(request.body)
            status_value = data.get('status')
            
            if not status_value:
                return JsonResponse({"error": "Status field is required"}, status=400)
            
            # Get the appointment from MongoDB
            # Try different ID formats (string ID or ObjectId)
            appointment = None
            try:
                # Try with the ID as is
                appointment = db.appointments.find_one({"id": appointment_id})
                
                # If not found, try with ObjectId
                if not appointment and ObjectId.is_valid(appointment_id):
                    appointment = db.appointments.find_one({"_id": ObjectId(appointment_id)})
            except Exception as e:
                print(f"Error finding appointment: {str(e)}")
            
            if not appointment:
                return JsonResponse({"error": "Appointment not found"}, status=404)
            
            # Get the doctor associated with this user
            doctor = db.doctors.find_one({"user_id": user_id})
            
            if not doctor:
                return JsonResponse({"error": "Doctor not found for this user"}, status=403)
            
            # Check if the doctor is assigned to this appointment
            doctor_id = doctor.get('id')
            appointment_doctor_id = appointment.get('doctor')
            
            # Convert to string for comparison if needed
            if appointment_doctor_id and str(appointment_doctor_id) != str(doctor_id):
                # Also check if the user is an admin
                user = db.users.find_one({"id": user_id})
                is_admin = user and (user.get('is_staff') or user.get('is_superuser') or user.get('role') == 'admin')
                
                if not is_admin:
                    return JsonResponse(
                        {"error": "You do not have permission to update this appointment"}, 
                        status=403
                    )
            
            # Update the appointment status
            result = db.appointments.update_one(
                {"id": appointment_id} if appointment.get('id') else {"_id": appointment["_id"]},
                {"$set": {"status": status_value}}
            )
            
            if result.modified_count == 0:
                return JsonResponse({"error": "Failed to update appointment"}, status=500)
            
            # Get the updated appointment
            updated_appointment = db.appointments.find_one(
                {"id": appointment_id} if appointment.get('id') else {"_id": appointment["_id"]}
            )
            
            # Convert ObjectId to string for JSON serialization
            if updated_appointment and "_id" in updated_appointment:
                updated_appointment["_id"] = str(updated_appointment["_id"])
            
            return JsonResponse(updated_appointment or {})
            
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error updating appointment: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def doctor_exceptions(request, doctor_id=None, exception_id=None):
    """
    Endpoint for managing doctor exceptions (days off)
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # LIST all exceptions (admin only)
        if request.method == 'GET' and doctor_id is None and exception_id is None:
            # Check if user is admin
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user or user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get all exceptions
            exceptions = list(db.doctor_exceptions.find())
            
            response = JsonResponse(exceptions, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # LIST exceptions for a specific doctor
        elif request.method == 'GET' and doctor_id is not None and exception_id is None:
            # Check if user is authorized
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Check if user is admin or the doctor
            is_admin = user.get('role') == 'admin'
            is_doctor = False
            
            if user.get('role') == 'doctor':
                doctor = db.doctors.find_one({'user_id': user['id']})
                if doctor and doctor['id'] == doctor_id:
                    is_doctor = True
            
            if not (is_admin or is_doctor):
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            # Get exceptions for this doctor
            exceptions = list(db.doctor_exceptions.find({'doctor_id': doctor_id}))
            
            response = JsonResponse(exceptions, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE a specific exception
        elif request.method == 'GET' and doctor_id is not None and exception_id is not None:
            # Check if user is authorized
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Check if user is admin or the doctor
            is_admin = user.get('role') == 'admin'
            is_doctor = False
            
            if user.get('role') == 'doctor':
                doctor = db.doctors.find_one({'user_id': user['id']})
                if doctor and doctor['id'] == doctor_id:
                    is_doctor = True
            
            if not (is_admin or is_doctor):
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            # Get exception
            exception = db.doctor_exceptions.find_one({'id': exception_id, 'doctor_id': doctor_id})
            
            if not exception:
                response = JsonResponse({'error': 'Exception not found'}, status=404)
                return add_cors_headers(response)
            
            response = JsonResponse(exception, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE a new exception
        elif request.method == 'POST' and doctor_id is None and exception_id is None:
            # Check if user is admin
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user or user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['doctor_id', 'date', 'reason']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Check if doctor exists
            doctor = db.doctors.find_one({'id': data['doctor_id']})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            # Create exception
            exception_id = str(uuid.uuid4())
            exception = {
                'id': exception_id,
                'doctor_id': data['doctor_id'],
                'doctor_name': doctor['name'],
                'date': data['date'],
                'reason': data['reason'],
                'created_at': datetime.now(),
                'created_by': user['id']
            }
            
            db.doctor_exceptions.insert_one(exception)
            
            response = JsonResponse(exception, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE a new exception for a specific doctor
        elif request.method == 'POST' and doctor_id is not None and exception_id is None:
            # Check if user is authorized
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Check if user is admin or the doctor
            is_admin = user.get('role') == 'admin'
            is_doctor = False
            
            if user.get('role') == 'doctor':
                doctor = db.doctors.find_one({'user_id': user['id']})
                if doctor and doctor['id'] == doctor_id:
                    is_doctor = True
            
            if not (is_admin or is_doctor):
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['date', 'reason']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Check if doctor exists
            doctor = db.doctors.find_one({'id': doctor_id})
            if not doctor:
                response = JsonResponse({'error': 'Doctor not found'}, status=404)
                return add_cors_headers(response)
            
            # Create exception
            exception_id = str(uuid.uuid4())
            exception = {
                'id': exception_id,
                'doctor_id': doctor_id,
                'doctor_name': doctor['name'],
                'date': data['date'],
                'reason': data['reason'],
                'created_at': datetime.now(),
                'created_by': user['id']
            }
            
            db.doctor_exceptions.insert_one(exception)
            
            response = JsonResponse(exception, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE a specific exception
        elif request.method in ['PUT', 'PATCH'] and doctor_id is not None and exception_id is not None:
            # Check if user is authorized
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Check if user is admin or the doctor
            is_admin = user.get('role') == 'admin'
            is_doctor = False
            
            if user.get('role') == 'doctor':
                doctor = db.doctors.find_one({'user_id': user['id']})
                if doctor and doctor['id'] == doctor_id:
                    is_doctor = True
            
            if not (is_admin or is_doctor):
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            # Get exception
            exception = db.doctor_exceptions.find_one({'id': exception_id, 'doctor_id': doctor_id})
            if not exception:
                response = JsonResponse({'error': 'Exception not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Update exception
            db.doctor_exceptions.update_one(
                {'id': exception_id, 'doctor_id': doctor_id},
                {'$set': data}
            )
            
            # Get updated exception
            updated_exception = db.doctor_exceptions.find_one({'id': exception_id, 'doctor_id': doctor_id})
            
            response = JsonResponse(updated_exception, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE a specific exception
        elif request.method == 'DELETE' and doctor_id is not None and exception_id is not None:
            # Check if user is authorized
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Check if user is admin or the doctor
            is_admin = user.get('role') == 'admin'
            is_doctor = False
            
            if user.get('role') == 'doctor':
                doctor = db.doctors.find_one({'user_id': user['id']})
                if doctor and doctor['id'] == doctor_id:
                    is_doctor = True
            
            if not (is_admin or is_doctor):
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            # Get exception
            exception = db.doctor_exceptions.find_one({'id': exception_id, 'doctor_id': doctor_id})
            if not exception:
                response = JsonResponse({'error': 'Exception not found'}, status=404)
                return add_cors_headers(response)
            
            # Delete exception
            db.doctor_exceptions.delete_one({'id': exception_id, 'doctor_id': doctor_id})
            
            response = JsonResponse({'message': 'Exception deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Doctor exceptions error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def new_doctor_form(request):
    """
    Get form fields for creating a new doctor
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is admin
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user or user.get('role') != 'admin':
            response = JsonResponse({'error': 'Admin privileges required'}, status=403)
            return add_cors_headers(response)
        
        form_data = {
            "message": "Ready to create new doctor",
            "fields": [
                {"name": "name", "type": "string", "required": True},
                {"name": "specialization", "type": "string", "required": True},
                {"name": "email", "type": "email", "required": True},
                {"name": "phone", "type": "string", "required": True},
                {"name": "qualification", "type": "string", "required": False},
                {"name": "experience_years", "type": "number", "required": False},
                {"name": "consultation_fee", "type": "string", "required": False},
                {"name": "available_days", "type": "string", "required": False},
                {"name": "bio", "type": "text", "required": False},
                {"name": "medical_center_name", "type": "string", "required": False},
                {"name": "emergency_available", "type": "boolean", "required": False},
                {"name": "daily_patient_limit", "type": "number", "required": False}
            ]
        }
        
        response = JsonResponse(form_data)
        return add_cors_headers(response)
    except Exception as e:
        print(f"New doctor form error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def clinic_staff(request, id=None):
    """
    Endpoint for clinic staff management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is authorized
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # LIST
        if request.method == 'GET' and id is None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get all clinic staff
            staff = list(db.clinic_staff.find())
            
            response = JsonResponse(staff, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get staff member
            staff = db.clinic_staff.find_one({'id': id})
            if not staff:
                response = JsonResponse({'error': 'Staff member not found'}, status=404)
                return add_cors_headers(response)
            
            response = JsonResponse(staff, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['email', 'password', 'first_name', 'last_name', 'position']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'Missing required field: {field}'}, status=400)
                    return add_cors_headers(response)
            
            # Ensure position is 'admin'
            if data['position'] != 'admin':
                response = JsonResponse({'error': 'Clinic staff must have position set to "admin"'}, status=400)
                return add_cors_headers(response)
            
            # Check if email already exists
            if db.clinic_staff.find_one({'email': data['email']}):
                response = JsonResponse({'error': 'Email already exists'}, status=400)
                return add_cors_headers(response)
            
            # Hash password
            hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create staff member
            staff_id = str(uuid.uuid4())
            staff = {
                'id': staff_id,
                'email': data['email'],
                'password': hashed_password,
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'position': data['position'],
                'phone': data.get('phone', ''),
                'created_at': datetime.now()
            }
            
            db.clinic_staff.insert_one(staff)
            
            # Remove password from response
            staff_response = staff.copy()
            staff_response.pop('password', None)
            
            response = JsonResponse(staff_response, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get staff member
            staff = db.clinic_staff.find_one({'id': id})
            if not staff:
                response = JsonResponse({'error': 'Staff member not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Don't allow updating certain fields
            protected_fields = ['id', 'email', 'created_at']
            update_data = {k: v for k, v in data.items() if k not in protected_fields}
            
            # Handle password update separately
            if 'password' in update_data:
                update_data['password'] = bcrypt.hashpw(update_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Update staff member
            db.clinic_staff.update_one(
                {'id': id},
                {'$set': update_data}
            )
            
            # Get updated staff member
            updated_staff = db.clinic_staff.find_one({'id': id})
            updated_staff.pop('password', None)
            
            response = JsonResponse(updated_staff, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Check if user is admin
            if user.get('role') != 'admin':
                response = JsonResponse({'error': 'Admin privileges required'}, status=403)
                return add_cors_headers(response)
            
            # Get staff member
            staff = db.clinic_staff.find_one({'id': id})
            if not staff:
                response = JsonResponse({'error': 'Staff member not found'}, status=404)
                return add_cors_headers(response)
            
            # Delete staff member
            db.clinic_staff.delete_one({'id': id})
            
            response = JsonResponse({'message': 'Staff member deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Clinic staff endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@require_GET
@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """
    This view sets a CSRF cookie and returns a 200 OK response.
    The CSRF cookie is needed for POST requests.
    """
    response = JsonResponse({"success": True, "message": "CSRF cookie set"})
    return add_cors_headers(response)

@csrf_exempt
@api_view(['GET', 'POST', 'OPTIONS'])
@permission_classes([AllowAny])
def validate_token(request):
    """
    Simple endpoint to validate if a token is valid.
    For MongoDB-based authentication.
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    
    # Print the auth header for debugging
    print(f"Auth header received: {auth_header}")
    
    # Check for both Token and Bearer formats
    if not auth_header:
        return JsonResponse({'valid': False, 'error': 'No token provided'}, status=401)
    
    # Extract the token
    if auth_header.startswith('Token '):
        token = auth_header.split(' ')[1]
    elif auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    else:
        return JsonResponse({'valid': False, 'error': 'Invalid authorization format'}, status=401)
    
    try:
        # Get your secret key from settings
        from django.conf import settings
        secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        
        # Decode the token
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        
        # Check if token is expired
        if 'exp' in payload and datetime.fromtimestamp(payload['exp']) < datetime.utcnow():
            return JsonResponse({'valid': False, 'error': 'Token expired'}, status=401)
        
        # Get user from MongoDB
        from pymongo import MongoClient
        client = MongoClient(settings.MONGODB_URI)
        db = client[settings.MONGODB_NAME]
        
        # Find user by ID from token
        user = db.users.find_one({'id': payload.get('user_id')})
        
        if not user:
            return JsonResponse({'valid': False, 'error': 'User not found'}, status=401)
        
        # Token is valid
        response = JsonResponse({
            'valid': True,
            'user_id': payload.get('user_id'),
            'username': user.get('username', user.get('email'))
        })
        return add_cors_headers(response)
        
    except jwt.ExpiredSignatureError:
        return JsonResponse({'valid': False, 'error': 'Token expired'}, status=401)
    except jwt.InvalidTokenError:
        return JsonResponse({'valid': False, 'error': 'Invalid token'}, status=401)
    except Exception as e:
        print(f"Token validation error: {str(e)}")
        return JsonResponse({'valid': False, 'error': f'Token validation failed: {str(e)}'}, status=401)

@csrf_exempt
@api_view(['GET', 'OPTIONS'])
@permission_classes([AllowAny])
def appointments_view(request):
    """
    Endpoint to get appointments with proper CORS and token handling
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    # Print all headers for debugging
    print("Request headers:")
    for header, value in request.META.items():
        if header.startswith('HTTP_'):
            print(f"{header}: {value}")
    
    # Check for Authorization header
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    
    if not auth_header:
        return JsonResponse({'error': 'No authorization header provided'}, status=401)
    
    # Extract the token - handle both Token and Bearer formats
    if auth_header.startswith('Token '):
        token = auth_header.split(' ')[1]
    elif auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    else:
        return JsonResponse({'error': 'Invalid authorization format'}, status=401)
    
    try:
        # Validate the token
        from django.conf import settings
        secret_key = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        
        try:
            # Decode the token
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            
            # Check if token is expired
            if 'exp' in payload and datetime.fromtimestamp(payload['exp']) < datetime.utcnow():
                return JsonResponse({'error': 'Token expired'}, status=401)
                
            # Get user from MongoDB
            from pymongo import MongoClient
            client = MongoClient(settings.MONGODB_URI)
            db = client[settings.MONGODB_NAME]
            
            # Find user by ID from token
            user_id = payload.get('user_id')
            user = db.users.find_one({'id': user_id})
            
            if not user:
                return JsonResponse({'error': 'User not found'}, status=401)
                
            # Get appointments for this user
            if user.get('role') == 'admin':
                # Admin sees all appointments
                appointments = list(db.appointments.find())
            elif user.get('role') == 'doctor':
                # Doctor sees their appointments
                doctor = db.doctors.find_one({'user_id': user_id})
                if doctor:
                    appointments = list(db.appointments.find({'doctor': doctor['id']}))
                else:
                    appointments = []
            else:
                # Patient sees their appointments
                appointments = list(db.appointments.find({'patient': user_id}))
                
            # Convert MongoDB ObjectId to string
            for appointment in appointments:
                if '_id' in appointment:
                    appointment['_id'] = str(appointment['_id'])
                    
            response = JsonResponse(appointments, safe=False)
            return add_cors_headers(response)
            
        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'Token expired'}, status=401)
        except jwt.InvalidTokenError:
            return JsonResponse({'error': 'Invalid token'}, status=401)
        except Exception as e:
            print(f"Token validation error: {str(e)}")
            return JsonResponse({'error': f'Authentication failed: {str(e)}'}, status=401)
            
    except Exception as e:
        print(f"Error processing appointments request: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def direct_update_appointment_status(request, appointment_id):
    """
    Direct endpoint to update appointment status without permission checks.
    This is a temporary solution for debugging purposes.
    """
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, PATCH, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response
        
    if request.method in ['POST', 'PATCH']:
        try:
            # Parse the request body
            data = json.loads(request.body)
            status_value = data.get('status')
            
            if not status_value:
                return JsonResponse({"error": "Status field is required"}, status=400)
            
            print(f"Attempting to update appointment {appointment_id} to status {status_value}")
            
            # Try different ID formats
            update_result = None
            
            # Try with string ID
            update_result = db.appointments.update_one(
                {"id": appointment_id},
                {"$set": {"status": status_value}}
            )
            
            # If no documents were modified, try with ObjectId
            if update_result and update_result.modified_count == 0 and ObjectId.is_valid(appointment_id):
                update_result = db.appointments.update_one(
                    {"_id": ObjectId(appointment_id)},
                    {"$set": {"status": status_value}}
                )
            
            # If still no documents were modified, try with numeric ID
            if update_result and update_result.modified_count == 0:
                try:
                    numeric_id = int(appointment_id)
                    update_result = db.appointments.update_one(
                        {"id": numeric_id},
                        {"$set": {"status": status_value}}
                    )
                except (ValueError, TypeError):
                    pass
            
            # Check if update was successful
            if update_result and update_result.modified_count > 0:
                print(f"Successfully updated appointment {appointment_id} to status {status_value}")
                return JsonResponse({
                    "success": True,
                    "message": f"Appointment {appointment_id} status updated to {status_value}",
                    "id": appointment_id,
                    "status": status_value
                })
            else:
                print(f"Failed to update appointment {appointment_id}: document not found or not modified")
                
                # For debugging, try to find the appointment
                appointment = None
                try:
                    appointment = db.appointments.find_one({"id": appointment_id})
                    if not appointment and ObjectId.is_valid(appointment_id):
                        appointment = db.appointments.find_one({"_id": ObjectId(appointment_id)})
                    if not appointment:
                        try:
                            numeric_id = int(appointment_id)
                            appointment = db.appointments.find_one({"id": numeric_id})
                        except (ValueError, TypeError):
                            pass
                except Exception as e:
                    print(f"Error finding appointment: {str(e)}")
                
                if appointment:
                    print(f"Found appointment but couldn't update it: {appointment}")
                    # Convert ObjectId to string if present
                    if "_id" in appointment and isinstance(appointment["_id"], ObjectId):
                        appointment["_id"] = str(appointment["_id"])
                    return JsonResponse({
                        "error": "Found appointment but couldn't update it",
                        "appointment": appointment,
                        "attempted_status": status_value
                    }, status=500)
                else:
                    return JsonResponse({"error": f"Appointment {appointment_id} not found"}, status=404)
            
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        except Exception as e:
            print(f"Error updating appointment: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)
    
    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
@require_http_methods(["GET"])
def appointment_stats(request):
    """
    Endpoint to get appointment statistics from MongoDB
    """
    from pymongo import MongoClient
    import logging
    
    # Set up logging
    logger = logging.getLogger(__name__)
    logger.info("Appointment stats endpoint called")
    
    # Add CORS headers for cross-origin requests
    response_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        for key, value in response_headers.items():
            response[key] = value
        return response
    
    try:
        # Check for authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        logger.info(f"Auth header present: {bool(auth_header)}")
        
        if not auth_header:
            logger.warning("No authorization header provided")
            return JsonResponse({"error": "No authorization header provided"}, status=401)
        
        try:
            # Connect to MongoDB
            logger.info(f"Connecting to MongoDB: {settings.MONGODB_URI}")
            client = MongoClient(settings.MONGODB_URI)
            db = client[settings.MONGODB_NAME]
            
            # Check if collection exists
            if 'appointments' not in db.list_collection_names():
                logger.error("Appointments collection does not exist")
                return JsonResponse({
                    "error": "Appointments collection not found",
                    "collections": db.list_collection_names(),
                    "total": 0,
                    "completed": 0,
                    "pending": 0,
                    "today": 0,
                    "completion_rate": 0
                })
            
            collection = db['appointments']
            
            # Count total appointments
            logger.info("Counting total appointments")
            total_count = collection.count_documents({})
            logger.info(f"Total appointments: {total_count}")
            
            # Count completed appointments
            completed_count = 0
            try:
                completed_count = collection.count_documents({"status": "completed"})
                logger.info(f"Completed appointments: {completed_count}")
            except Exception as e:
                logger.error(f"Error counting completed appointments: {str(e)}")
            
            # Count pending/scheduled appointments
            pending_count = 0
            try:
                pending_count = collection.count_documents({
                    "status": {"$in": ["scheduled", "pending"]}
                })
                logger.info(f"Pending appointments: {pending_count}")
            except Exception as e:
                logger.error(f"Error counting pending appointments: {str(e)}")
            
            # Count today's appointments - improved date handling
            from datetime import datetime
            today_str = datetime.now().strftime('%Y-%m-%d')
            logger.info(f"Today's date: {today_str}")
            
            today_count = 0
            try:
                # Try different date formats that might be in the database
                today_count = collection.count_documents({
                    "$or": [
                        {"date": {"$regex": f"^{today_str}"}},  # ISO format with time
                        {"date": today_str},                    # Just the date string
                        {"date": {"$gte": datetime.strptime(today_str, '%Y-%m-%d'), 
                                "$lt": datetime.strptime(today_str + " 23:59:59", '%Y-%m-%d %H:%M:%S')}}
                    ]
                })
                logger.info(f"Today's appointments: {today_count}")
            except Exception as e:
                logger.error(f"Error counting today's appointments: {str(e)}")
            
            # Calculate completion rate
            completion_rate = 0
            if total_count > 0:
                completion_rate = round((completed_count / total_count) * 100)
            logger.info(f"Completion rate: {completion_rate}%")
            
            # Return the statistics
            response_data = {
                "total": total_count,
                "completed": completed_count,
                "pending": pending_count,
                "today": today_count,
                "completion_rate": completion_rate
            }
            
            # Create response with CORS headers
            response = JsonResponse(response_data)
            for key, value in response_headers.items():
                response[key] = value
                
            return response
            
        except Exception as e:
            logger.error(f"MongoDB connection error: {str(e)}")
            return JsonResponse({
                "error": f"MongoDB connection error: {str(e)}",
                "total": 0,
                "completed": 0,
                "pending": 0,
                "today": 0,
                "completion_rate": 0
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error in appointment_stats: {str(e)}")
        return JsonResponse({
            "error": str(e),
            "total": 0,
            "completed": 0,
            "pending": 0,
            "today": 0,
            "completion_rate": 0
        }, status=500)

@csrf_exempt
def my_patient_record(request):
    """
    Endpoint for patients to get or create their own patient record
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check if user is authorized
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # GET - retrieve patient record
        if request.method == 'GET':
            # Find patient record for this user
            patient = db.patients.find_one({'user_id': user['id']})
            
            if not patient:
                # If no patient record exists, create one
                patient_id = str(uuid.uuid4())
                patient = {
                    'id': patient_id,
                    'user_id': user['id'],
                    'name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('name', '') or user.get('email', '').split('@')[0],
                    'email': user.get('email', ''),
                    'phone': user.get('phone', ''),
                    'date_of_birth': user.get('birthday', '') or user.get('date_of_birth', ''),
                    'gender': user.get('gender', ''),
                    'address': user.get('address', ''),
                    'medical_history': [],
                    'allergies': [],
                    'medications': [],
                    'medical_info': {
                        'blood_type': ''
                    },
                    'chronic_diseases': [],
                    'created_at': datetime.now()
                }
                
                db.patients.insert_one(patient)
            
            response = JsonResponse(patient, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # POST/PATCH - update patient record
        elif request.method in ['POST', 'PATCH']:
            data = json.loads(request.body)
            
            # Find patient record for this user
            patient = db.patients.find_one({'user_id': user['id']})
            
            if not patient:
                # If no patient record exists, create one with the provided data
                patient_id = str(uuid.uuid4())
                
                # Ensure medical data is stored as arrays
                medical_history = data.get('medical_history', [])
                if not isinstance(medical_history, list):
                    medical_history = [medical_history] if medical_history else []
                
                allergies = data.get('allergies', [])
                if not isinstance(allergies, list):
                    allergies = [allergies] if allergies else []
                
                medications = data.get('medications', [])
                if not isinstance(medications, list):
                    medications = [medications] if medications else []
                
                chronic_diseases = data.get('chronic_diseases', [])
                if not isinstance(chronic_diseases, list):
                    chronic_diseases = [chronic_diseases] if chronic_diseases else []
                
                # Handle medical_info object
                medical_info = data.get('medical_info', {})
                if not isinstance(medical_info, dict):
                    medical_info = {'blood_type': ''}
                
                # Create patient record
                patient = {
                    'id': patient_id,
                    'user_id': user['id'],
                    'name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('name', '') or user.get('email', '').split('@')[0],
                    'email': user.get('email', ''),
                    'phone': user.get('phone', ''),
                    'date_of_birth': user.get('birthday', '') or user.get('date_of_birth', ''),
                    'gender': user.get('gender', ''),
                    'address': user.get('address', ''),
                    'medical_history': medical_history,
                    'allergies': allergies,
                    'medications': medications,
                    'medical_info': medical_info,
                    'chronic_diseases': chronic_diseases,
                    'created_at': datetime.now()
                }
                
                db.patients.insert_one(patient)
                
                response = JsonResponse(patient, status=201, encoder=MongoJSONEncoder)
                return add_cors_headers(response)
            
            # Ensure medical data is stored as arrays
            if 'medical_history' in data and not isinstance(data['medical_history'], list):
                data['medical_history'] = [data['medical_history']] if data['medical_history'] else []
            
            if 'allergies' in data and not isinstance(data['allergies'], list):
                data['allergies'] = [data['allergies']] if data['allergies'] else []
            
            if 'medications' in data and not isinstance(data['medications'], list):
                data['medications'] = [data['medications']] if data['medications'] else []
            
            if 'chronic_diseases' in data and not isinstance(data['chronic_diseases'], list):
                data['chronic_diseases'] = [data['chronic_diseases']] if data['chronic_diseases'] else []
            
            # Handle medical_info object
            if 'medical_info' in data:
                if not isinstance(data['medical_info'], dict):
                    data['medical_info'] = {'blood_type': data['medical_info']}
            
            # Update patient record
            db.patients.update_one(
                {'id': patient['id']},
                {'$set': {
                    **data,
                    'last_updated': datetime.now()
                }}
            )
            
            # Get updated patient
            updated_patient = db.patients.find_one({'id': patient['id']})
            
            response = JsonResponse(updated_patient, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"My patient record error: {str(e)}")
        response = JsonResponse({'error': f'An error occurred while processing your request: {str(e)}'}, status=500)
        return add_cors_headers(response)
    
def send_email(to_email, subject, html_content, text_content=None):
    """
    Send an email using Django's email backend (configured for SendGrid)
    """
    try:
        # If text_content is not provided, create a plain text version from HTML
        if text_content is None:
            try:
                from html2text import html2text
                text_content = html2text(html_content)
            except ImportError:
                # Fallback if html2text is not available
                text_content = strip_tags(html_content)
        
        # Send email using Django's EmailMultiAlternatives for better HTML support
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        print(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def create_appointment_notification(appointment_id, notification_type='booking'):
    """
    Create notifications for appointment booking and reminders
    """
    try:
        # Get appointment details
        appointment = db.appointments.find_one({'id': appointment_id})
        if not appointment:
            print(f"Appointment not found: {appointment_id}")
            return False
        
        # Get patient details
        patient = db.patients.find_one({'id': appointment.get('patient')})
        if not patient:
            print(f"Patient not found for appointment: {appointment_id}")
            return False
        
        # Get user details for patient
        user = db.users.find_one({'id': patient.get('user_id')})
        if not user:
            print(f"User not found for patient: {patient.get('id')}")
            return False
        
        # Get doctor details
        doctor = db.doctors.find_one({'id': appointment.get('doctor')})
        doctor_name = doctor.get('name', 'your doctor') if doctor else 'your doctor'
        
        # Get appointment date and time
        appointment_datetime = appointment.get('appointment_datetime')
        if not appointment_datetime:
            print(f"Appointment datetime not found: {appointment_id}")
            return False
        
        # Format appointment date and time
        if isinstance(appointment_datetime, str):
            appointment_datetime = datetime.fromisoformat(appointment_datetime.replace('Z', '+00:00'))
        
        formatted_date = appointment_datetime.strftime('%A, %B %d, %Y')
        formatted_time = appointment_datetime.strftime('%I:%M %p')
        
        # Patient name
        patient_name = patient.get('name', user.get('first_name', 'Patient'))
        
        # Create notification based on type
        if notification_type == 'booking':
            # Booking confirmation notification
            title = "Appointment Confirmation"
            message = f"Your appointment with {doctor_name} has been scheduled for {formatted_date} at {formatted_time}."
            email_subject = "Your Appointment Confirmation"
            
            # Email content
            email_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4a6ee0;">Appointment Confirmation</h2>
                    </div>
                    <p>Dear {patient_name},</p>
                    <p>Your appointment with <strong>{doctor_name}</strong> has been scheduled for:</p>
                    <div style="background-color: #f7f9fc; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> {formatted_date}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> {formatted_time}</p>
                    </div>
                    <p>Please arrive 15 minutes before your scheduled appointment time.</p>
                    <p>If you need to reschedule or cancel your appointment, please contact us at least 24 hours in advance.</p>
                    <p>Thank you for choosing our healthcare services.</p>
                    <p>Best regards,<br>
                    Healthcare Management System</p>
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777;">
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
        elif notification_type == 'reminder_1day':
            # 1-day reminder notification
            title = "Appointment Reminder"
            message = f"Reminder: Your appointment with {doctor_name} is tomorrow at {formatted_time}."
            email_subject = "Appointment Reminder - 1 Day"
            
            # Email content
            email_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4a6ee0;">Appointment Reminder</h2>
                    </div>
                    <p>Dear {patient_name},</p>
                    <p>This is a friendly reminder that your appointment with <strong>{doctor_name}</strong> is scheduled for:</p>
                    <div style="background-color: #f7f9fc; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> {formatted_date} (Tomorrow)</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> {formatted_time}</p>
                    </div>
                    <p>Please arrive 15 minutes before your scheduled appointment time.</p>
                    <p>If you need to reschedule or cancel your appointment, please contact us as soon as possible.</p>
                    <p>Thank you for choosing our healthcare services.</p>
                    <p>Best regards,<br>
                    Healthcare Management System</p>
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777;">
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
        elif notification_type == 'reminder_6hours':
            # 6-hour reminder notification
            title = "Appointment Reminder"
            message = f"Reminder: Your appointment with {doctor_name} is in 6 hours at {formatted_time}."
            email_subject = "Appointment Reminder - 6 Hours"
            
            # Email content
            email_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4a6ee0;">Appointment Reminder</h2>
                    </div>
                    <p>Dear {patient_name},</p>
                    <p>This is a friendly reminder that your appointment with <strong>{doctor_name}</strong> is scheduled for today:</p>
                    <div style="background-color: #f7f9fc; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> {formatted_date} (Today)</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> {formatted_time} (In 6 hours)</p>
                    </div>
                    <p>Please arrive 15 minutes before your scheduled appointment time.</p>
                    <p>If you need to reschedule or cancel your appointment, please contact us immediately.</p>
                    <p>Thank you for choosing our healthcare services.</p>
                    <p>Best regards,<br>
                    Healthcare Management System</p>
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777;">
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        else:
            return False
            
        # Create notification
        notification_id = str(uuid.uuid4())
        notification = {
            'id': notification_id,
            'user_id': user.get('id'),
            'type': f'appointment_{notification_type}',
            'title': title,
            'message': message,
            'is_read': False,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'metadata': {
                'appointment_id': appointment_id,
                'appointment_date': formatted_date,
                'appointment_time': formatted_time,
                'doctor_name': doctor_name
            },
            'email_sent': False,
            'email_scheduled': False
        }
        
        db.notifications.insert_one(notification)
        
        # Send email
        if user.get('email'):
            email_sent = send_email(user.get('email'), email_subject, email_html)
            
            # Update notification with email status
            db.notifications.update_one(
                {'id': notification_id},
                {'$set': {'email_sent': email_sent}}
            )
        
        return True
        
    except Exception as e:
        print(f"Error creating appointment notification: {str(e)}")
        return False

class NotificationScheduler:
    """Background thread to schedule notifications"""
    def __init__(self, interval=3600):  # Default to 1 hour
        self.interval = interval
        self.running = False
        self.thread = None
    
    def start(self):
        """Start the scheduler thread"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run)
        self.thread.daemon = True  # Allow the thread to exit when the main program exits
        self.thread.start()
        print(f"[{datetime.now()}] Notification scheduler started")
    
    def stop(self):
        """Stop the scheduler thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
            print(f"[{datetime.now()}] Notification scheduler stopped")
    
    def _run(self):
        """Run the scheduler loop"""
        while self.running:
            try:
                self._schedule_notifications()
            except Exception as e:
                print(f"[{datetime.now()}] Error in notification scheduler: {str(e)}")
            
            # Sleep for the specified interval
            for _ in range(self.interval):
                if not self.running:
                    break
                time.sleep(1)
    
    def _schedule_notifications(self):
        """Schedule notifications for upcoming appointments"""
        print(f"[{datetime.now()}] Running notification scheduler...")
        
        # Get current time
        now = datetime.now()
        
        # Get all scheduled appointments
        appointments = list(db.appointments.find({'status': 'scheduled'}))
        
        # Track notifications sent
        notifications_sent = {
            'booking': 0,
            'reminder_1day': 0,
            'reminder_6hours': 0
        }
        
        # Process each appointment
        for appointment in appointments:
            appointment_id = appointment.get('id')
            appointment_datetime = appointment.get('appointment_datetime')
            
            if not appointment_datetime:
                continue
            
            # Convert string to datetime if needed
            if isinstance(appointment_datetime, str):
                appointment_datetime = datetime.fromisoformat(appointment_datetime.replace('Z', '+00:00'))
            
            # Calculate time difference
            time_diff = appointment_datetime - now
            
            # Check if this is a new appointment (created in the last hour)
            created_at = appointment.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            is_new = created_at and (now - created_at).total_seconds() < 3600  # 1 hour
            
            # Send booking confirmation for new appointments
            if is_new:
                # Check if booking notification already exists
                existing = db.notifications.find_one({
                    'metadata.appointment_id': appointment_id,
                    'type': 'appointment_booking'
                })
                
                if not existing:
                    success = create_appointment_notification(appointment_id, 'booking')
                    if success:
                        notifications_sent['booking'] += 1
            
            # Send 1-day reminder
            if 23.5 <= time_diff.total_seconds() / 3600 <= 24.5:  # Between 23.5 and 24.5 hours
                # Check if 1-day reminder already exists
                existing = db.notifications.find_one({
                    'metadata.appointment_id': appointment_id,
                    'type': 'appointment_reminder_1day'
                })
                
                if not existing:
                    success = create_appointment_notification(appointment_id, 'reminder_1day')
                    if success:
                        notifications_sent['reminder_1day'] += 1
            
            # Send 6-hour reminder
            if 5.5 <= time_diff.total_seconds() / 3600 <= 6.5:  # Between 5.5 and 6.5 hours
                # Check if 6-hour reminder already exists
                existing = db.notifications.find_one({
                    'metadata.appointment_id': appointment_id,
                    'type': 'appointment_reminder_6hours'
                })
                
                if not existing:
                    success = create_appointment_notification(appointment_id, 'reminder_6hours')
                    if success:
                        notifications_sent['reminder_6hours'] += 1
        
        print(f"[{datetime.now()}] Notification scheduling completed:")
        print(f"  - Booking notifications: {notifications_sent['booking']}")
        print(f"  - 1-day reminders: {notifications_sent['reminder_1day']}")
        print(f"  - 6-hour reminders: {notifications_sent['reminder_6hours']}")
        print(f"  - Total appointments processed: {len(appointments)}")
        
        return notifications_sent
    
@csrf_exempt
def notifications(request, notification_id=None):
    """
    Endpoint for notification management
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # For all methods except GET, check authentication
        if request.method != 'GET':
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
        
        # GET - retrieve notifications
        if request.method == 'GET':
            # If notification_id is provided, get specific notification
            if notification_id:
                notification = db.notifications.find_one({'id': notification_id})
                if not notification:
                    response = JsonResponse({'error': 'Notification not found'}, status=404)
                    return add_cors_headers(response)
                
                response = JsonResponse(notification, encoder=MongoJSONEncoder)
                return add_cors_headers(response)
            
            # Otherwise, get all notifications for the authenticated user
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
                response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
                return add_cors_headers(response)
            
            token = auth_header.split(' ')[1]
            user = get_user_from_token(token)
            
            if not user:
                response = JsonResponse({'error': 'Invalid token'}, status=401)
                return add_cors_headers(response)
            
            # Get notifications for the user
            user_id = user.get('id')
            notifications = list(db.notifications.find({'user_id': user_id}).sort('created_at', DESCENDING))
            
            response = JsonResponse(notifications, safe=False, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # POST - create notification
        elif request.method == 'POST':
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['user_id', 'type', 'message']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'{field} is required'}, status=400)
                    return add_cors_headers(response)
            
            # Create notification
            notification_id = str(uuid.uuid4())
            notification = {
                'id': notification_id,
                'user_id': data['user_id'],
                'type': data['type'],
                'message': data['message'],
                'title': data.get('title', 'Notification'),
                'is_read': False,
                'created_at': datetime.now(),
                'updated_at': datetime.now(),
                'metadata': data.get('metadata', {}),
                'email_sent': False,
                'email_scheduled': data.get('email_scheduled', False),
                'scheduled_time': data.get('scheduled_time', None)
            }
            
            db.notifications.insert_one(notification)
            
            # Send email if requested
            if data.get('send_email', False):
                # Get user email
                user_data = db.users.find_one({'id': data['user_id']})
                if user_data and 'email' in user_data:
                    # Prepare email content
                    subject = data.get('email_subject', notification['title'])
                    html_content = data.get('email_html', f"<p>{notification['message']}</p>")
                    text_content = data.get('email_text', notification['message'])
                    
                    # Send email
                    email_sent = send_email(user_data['email'], subject, html_content, text_content)
                    
                    # Update notification with email status
                    db.notifications.update_one(
                        {'id': notification_id},
                        {'$set': {'email_sent': email_sent}}
                    )
            
            response = JsonResponse(notification, status=201, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # PUT/PATCH - update notification
        elif request.method in ['PUT', 'PATCH']:
            if not notification_id:
                response = JsonResponse({'error': 'Notification ID is required'}, status=400)
                return add_cors_headers(response)
            
            notification = db.notifications.find_one({'id': notification_id})
            if not notification:
                response = JsonResponse({'error': 'Notification not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Update notification
            update_data = {
                'updated_at': datetime.now()
            }
            
            # Update fields if provided
            if 'is_read' in data:
                update_data['is_read'] = data['is_read']
            
            if 'message' in data:
                update_data['message'] = data['message']
            
            if 'title' in data:
                update_data['title'] = data['title']
            
            if 'metadata' in data:
                update_data['metadata'] = data['metadata']
            
            db.notifications.update_one(
                {'id': notification_id},
                {'$set': update_data}
            )
            
            # Get updated notification
            updated_notification = db.notifications.find_one({'id': notification_id})
            
            response = JsonResponse(updated_notification, encoder=MongoJSONEncoder)
            return add_cors_headers(response)
        
        # DELETE - delete notification
        elif request.method == 'DELETE':
            if not notification_id:
                response = JsonResponse({'error': 'Notification ID is required'}, status=400)
                return add_cors_headers(response)
            
            notification = db.notifications.find_one({'id': notification_id})
            if not notification:
                response = JsonResponse({'error': 'Notification not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user is authorized to delete this notification
            if notification['user_id'] != user.get('id') and user.get('role') != 'admin':
                response = JsonResponse({'error': 'Unauthorized'}, status=403)
                return add_cors_headers(response)
            
            # Delete notification
            db.notifications.delete_one({'id': notification_id})
            
            response = JsonResponse({'message': 'Notification deleted successfully'})
            return add_cors_headers(response)
        
        else:
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
    except Exception as e:
        print(f"Notifications endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def schedule_appointment_notifications(request):
    """
    Endpoint to schedule appointment notifications
    This would typically be called by a cron job or scheduled task
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check authentication for security
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user or user.get('role') not in ['admin', 'staff']:
            response = JsonResponse({'error': 'Unauthorized'}, status=403)
            return add_cors_headers(response)
        
        # Run the notification scheduler manually
        notifications_sent = NotificationScheduler._schedule_notifications()
        
        # Return results
        response = JsonResponse({
            'success': True,
            'notifications_sent': notifications_sent,
            'message': 'Notification scheduling completed successfully'
        })
        return add_cors_headers(response)
    except Exception as e:
        print(f"Schedule notifications error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def mark_notification_read(request, notification_id):
    """
    Endpoint to mark a notification as read
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # Get notification
        notification = db.notifications.find_one({'id': notification_id})
        if not notification:
            response = JsonResponse({'error': 'Notification not found'}, status=404)
            return add_cors_headers(response)
        
        # Check if user is authorized to mark this notification as read
        if notification['user_id'] != user.get('id') and user.get('role') != 'admin':
            response = JsonResponse({'error': 'Unauthorized'}, status=403)
            return add_cors_headers(response)
        
        # Mark notification as read
        db.notifications.update_one(
            {'id': notification_id},
            {'$set': {'is_read': True, 'updated_at': datetime.now()}}
        )
        
        # Get updated notification
        updated_notification = db.notifications.find_one({'id': notification_id})
        
        response = JsonResponse(updated_notification, encoder=MongoJSONEncoder)
        return add_cors_headers(response)
    except Exception as e:
        print(f"Mark notification read error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def get_unread_notification_count(request):
    """
    Endpoint to get the count of unread notifications for the authenticated user
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # Get unread notification count
        user_id = user.get('id')
        unread_count = db.notifications.count_documents({'user_id': user_id, 'is_read': False})
        
        response = JsonResponse({'unread_count': unread_count})
        return add_cors_headers(response)
    except Exception as e:
        print(f"Get unread notification count error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def mark_all_notifications_read(request):
    """
    Endpoint to mark all notifications as read for the authenticated user
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return handle_options_request(request)
        
    try:
        # Check authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or (not auth_header.startswith('Bearer ') and not auth_header.startswith('Token ')):
            response = JsonResponse({'error': 'Invalid authorization header'}, status=401)
            return add_cors_headers(response)
        
        token = auth_header.split(' ')[1]
        user = get_user_from_token(token)
        
        if not user:
            response = JsonResponse({'error': 'Invalid token'}, status=401)
            return add_cors_headers(response)
        
        # Mark all notifications as read
        user_id = user.get('id')
        result = db.notifications.update_many(
            {'user_id': user_id, 'is_read': False},
            {'$set': {'is_read': True, 'updated_at': datetime.now()}}
        )
        
        response = JsonResponse({
            'success': True,
            'marked_read_count': result.modified_count,
            'message': f'Marked {result.modified_count} notifications as read'
        })
        return add_cors_headers(response)
    except Exception as e:
        print(f"Mark all notifications read error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

def init_notification_collection():
    """Initialize the notifications collection with appropriate indexes"""
    try:
        # Check if collection already exists
        if "notifications" in db.list_collection_names():
            print("Notifications collection already exists")
            
            # Create indexes if they don't exist
            existing_indexes = db.notifications.index_information()
            
            if "user_id_1" not in existing_indexes:
                db.notifications.create_index("user_id")
                print("Created index on user_id")
                
            if "created_at_1" not in existing_indexes:
                db.notifications.create_index("created_at")
                print("Created index on created_at")
                
            if "type_1" not in existing_indexes:
                db.notifications.create_index("type")
                print("Created index on type")
                
            if "is_read_1" not in existing_indexes:
                db.notifications.create_index("is_read")
                print("Created index on is_read")
                
            if "metadata.appointment_id_1" not in existing_indexes:
                db.notifications.create_index("metadata.appointment_id")
                print("Created index on metadata.appointment_id")
                
            return True
        
        # Create the collection
        db.create_collection("notifications")
        print("Created notifications collection")
        
        # Create indexes
        db.notifications.create_index("user_id")
        db.notifications.create_index("created_at")
        db.notifications.create_index("type")
        db.notifications.create_index("is_read")
        db.notifications.create_index("metadata.appointment_id")
        print("Created indexes for notifications collection")
        
        return True
    except Exception as e:
        print(f"Error initializing notification collection: {str(e)}")
        return False

# Initialize notification collection on module load
init_notification_collection()

# Create and start the notification scheduler
notification_scheduler = NotificationScheduler()
notification_scheduler.start()

@csrf_exempt
@require_http_methods(["GET"])
def appointment_count(request):
    """
    Simple endpoint to get the count of appointments directly from MongoDB
    """
    from pymongo import MongoClient
    import logging
    
    # Set up logging
    logger = logging.getLogger(__name__)
    logger.info("Appointment count endpoint called")
    
    # Add CORS headers for cross-origin requests
    response_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        for key, value in response_headers.items():
            response[key] = value
        return response
    
    try:
        # Check for authentication
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        logger.info(f"Auth header present: {bool(auth_header)}")
        
        if not auth_header:
            logger.warning("No authorization header provided")
            return JsonResponse({"error": "No authorization header provided"}, status=401)
        
        try:
            # MongoDB connection details
        
            MONGODB_URI = "mongodb+srv://elayoub407:MVmL7Axgvj4Ia4MR@hcams.8au6zot.mongodb.net/"
            MONGODB_NAME = "Hcams"  # Using the database name provided
            
            # Connect to MongoDB
            logger.info(f"Connecting to MongoDB: {MONGODB_URI}")
            client = MongoClient(MONGODB_URI)
            db = client[MONGODB_NAME]
            
            # Check if collection exists
            if 'appointments' not in db.list_collection_names():
                logger.error("Appointments collection does not exist")
                return JsonResponse({
                    "error": "Appointments collection not found",
                    "collections": db.list_collection_names(),
                    "count": 0
                })
            
            collection = db['appointments']
            
            # Count total appointments
            logger.info("Counting total appointments")
            count = collection.count_documents({})
            logger.info(f"Total appointments: {count}")
            
            # Return the count
            response_data = {
                "count": count
            }
            
            # Create response with CORS headers
            response = JsonResponse(response_data)
            for key, value in response_headers.items():
                response[key] = value
                
            return response
            
        except Exception as e:
            logger.error(f"MongoDB connection error: {str(e)}")
            return JsonResponse({
                "error": f"MongoDB connection error: {str(e)}",
                "count": 0
            }, status=500)
            
    except Exception as e:
        logger.error(f"Error in appointment_count: {str(e)}")
        return JsonResponse({
            "error": str(e),
            "count": 0
        }, status=500)