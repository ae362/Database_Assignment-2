import bcrypt
import uuid
import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.http import JsonResponse
from .mongo_utils import get_mongodb_database
from .mongo_auth import generate_jwt_token
from .mongo_json_encoder import MongoJSONEncoder
import json

# Get MongoDB database
db = get_mongodb_database()

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            
            if not email or not password:
                return JsonResponse({'error': 'Email and password are required'}, status=400)
            
            # Find user in MongoDB
            user = db.auth_user.find_one({'email': email})
            
            if not user:
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
            
            # Check password
            stored_password = user.get('password', '')
            if isinstance(stored_password, str):
                stored_password = stored_password.encode('utf-8')
            
            if not bcrypt.checkpw(password.encode('utf-8'), stored_password):
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
            
            # Generate JWT token
            token = generate_jwt_token(user)
            
            # Remove password from response
            user_data = {k: v for k, v in user.items() if k != 'password'}
            
            # Convert ObjectId to string
            if '_id' in user_data:
                user_data['id'] = str(user_data['_id'])
                
            return JsonResponse({
                'token': token,
                'user': json.loads(json.dumps(user_data, cls=MongoJSONEncoder))
            })
        except Exception as e:
            return JsonResponse({'error': f'Login failed: {str(e)}'}, status=500)

class RegistrationView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = json.loads(request.body)
            
            # Validate required fields
            required_fields = ['email', 'password', 'first_name', 'last_name']
            for field in required_fields:
                if field not in data:
                    return JsonResponse({'error': f'{field} is required'}, status=400)
            
            # Check if user already exists
            existing_user = db.auth_user.find_one({'email': data['email']})
            if existing_user:
                return JsonResponse({'error': 'User with this email already exists'}, status=400)
            
            # Hash password
            hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            # Create user
            user_id = str(uuid.uuid4())
            user = {
                'id': user_id,
                'email': data['email'],
                'username': data.get('username', data['email'].split('@')[0]),
                'password': hashed_password,
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'role': data.get('role', 'patient'),
                'is_active': True,
                'is_staff': data.get('role') == 'doctor',
                'is_superuser': data.get('role') == 'admin',
                'date_joined': datetime.datetime.now(),
                'last_login': None
            }
            
            # Insert user into MongoDB
            db.auth_user.insert_one(user)
            
            # Generate JWT token
            token = generate_jwt_token(user)
            
            # Remove password from response
            user_data = {k: v for k, v in user.items() if k != 'password'}
            
            return JsonResponse({
                'token': token,
                'user': user_data
            }, status=201)
        except Exception as e:
            return JsonResponse({'error': f'Registration failed: {str(e)}'}, status=500)

def authenticate_user(email, password):
    """
    Authenticate user with email and password
    """
    user = db.auth_user.find_one({'email': email})
    
    if not user:
        return None
    
    try:
        # Ensure password is properly encoded
        stored_password = user.get('password', '')
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')
        
        # Check password
        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            return user
    except Exception as e:
        print(f"Password verification error: {str(e)}")
    
    return None

def get_user_from_token(token):
    """
    Get user from JWT token
    """
    try:
        from .mongo_auth import validate_jwt_token
        
        payload = validate_jwt_token(token)
        if not payload:
            return None
            
        user_id = payload.get('user_id')
        if not user_id:
            return None
            
        # Try to find user by ID
        user = db.auth_user.find_one({'id': user_id})
        
        # If not found, try with _id
        if not user and user_id:
            try:
                from bson.objectid import ObjectId
                user = db.auth_user.find_one({'_id': ObjectId(user_id)})
            except:
                pass
                
        return user
    except Exception as e:
        print(f"Token decode error: {str(e)}")
        return None