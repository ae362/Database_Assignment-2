from rest_framework import serializers
from bson import ObjectId
from decimal import Decimal
from datetime import datetime
from .mongodb_utils import get_mongodb_database, mongo_id_to_str

# Get MongoDB database
db = get_mongodb_database()

class MongoModelSerializer(serializers.Serializer):
    """
    Base serializer for MongoDB documents
    """
    id = serializers.CharField(read_only=True)
    
    def to_representation(self, instance):
        """
        Convert MongoDB document to a dictionary with string IDs
        """
        return mongo_id_to_str(instance)

class MedicalCenterSerializer(MongoModelSerializer):
    name = serializers.CharField(max_length=100)
    address = serializers.CharField()
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_null=True)
    website = serializers.URLField(required=False, allow_null=True)
    
    def create(self, validated_data):
        result = db.medical_centers.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.medical_centers.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}

class UserSerializer(MongoModelSerializer):
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    avatar = serializers.CharField(required=False, allow_null=True)
    role = serializers.CharField(max_length=20, default='patient')
    recent_doctor_name = serializers.SerializerMethodField()
    
    def get_recent_doctor_name(self, obj):
        if 'recent_doctor' in obj and obj['recent_doctor']:
            doctor = db.doctors.find_one({'_id': ObjectId(obj['recent_doctor'])})
            if doctor:
                return f"Dr. {doctor['name']}"
        return None
    
    def create(self, validated_data):
        # Generate username from email if not provided
        if 'username' not in validated_data:
            email = validated_data['email']
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while db.users.find_one({'username': username}):
                username = f"{base_username}{counter}"
                counter += 1
            validated_data['username'] = username
        
        # Set default values
        validated_data['date_joined'] = datetime.now()
        validated_data['is_active'] = True
        validated_data['is_staff'] = validated_data.get('role') == 'doctor' or validated_data.get('role') == 'admin'
        validated_data['is_superuser'] = validated_data.get('role') == 'admin'
        
        result = db.users.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.users.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}

class MedicalInfoSerializer(serializers.Serializer):
    """
    Serializer for patient medical information
    """
    blood_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    allergies = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    medical_history = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    chronic_diseases = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    medications = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    last_updated = serializers.DateTimeField(default=datetime.now)

class DoctorSerializer(MongoModelSerializer):
    name = serializers.CharField(max_length=100)
    specialization = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    qualification = serializers.CharField(max_length=100, default="No qualification")
    experience_years = serializers.IntegerField(default=0, min_value=0)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('20.00'), min_value=Decimal('20.00'))
    available_days = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    medical_center = serializers.CharField(required=False, allow_null=True)
    medical_center_name = serializers.SerializerMethodField()
    emergency_available = serializers.BooleanField(default=False)
    daily_patient_limit = serializers.IntegerField(default=10)
    is_available = serializers.BooleanField(default=True)
    
    def get_medical_center_name(self, obj):
        if 'medical_center' in obj and obj['medical_center']:
            medical_center = db.medical_centers.find_one({'_id': ObjectId(obj['medical_center'])})
            if medical_center:
                return medical_center['name']
        return None
    
    def create(self, validated_data):
        result = db.doctors.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.doctors.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}

class PatientSerializer(MongoModelSerializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    medical_info = MedicalInfoSerializer(required=False)
    user_id = serializers.CharField(required=False)
    
    def create(self, validated_data):
        # Extract and handle medical_info separately
        medical_info = validated_data.pop('medical_info', {
            'blood_type': '',
            'allergies': [],
            'medical_history': [],
            'chronic_diseases': [],
            'medications': [],
            'last_updated': datetime.now()
        })
        
        # Add medical_info back to validated_data
        validated_data['medical_info'] = medical_info
        
        result = db.patients.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        # Extract and handle medical_info separately
        if 'medical_info' in validated_data:
            medical_info = validated_data.pop('medical_info')
            
            # Update last_updated timestamp
            medical_info['last_updated'] = datetime.now()
            
            # If instance already has medical_info, update it
            if 'medical_info' in instance:
                instance_medical_info = instance['medical_info']
                updated_medical_info = {**instance_medical_info, **medical_info}
                validated_data['medical_info'] = updated_medical_info
            else:
                validated_data['medical_info'] = medical_info
        
        db.patients.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        updated_instance = db.patients.find_one({'_id': ObjectId(instance['_id'])})
        return updated_instance

class PatientInfoSerializer(serializers.Serializer):
    """
    Serializer for embedded patient information in appointments
    """
    name = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class DoctorInfoSerializer(serializers.Serializer):
    """
    Serializer for embedded doctor information in appointments
    """
    name = serializers.CharField()
    specialization = serializers.CharField()
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class MedicalDataSerializer(serializers.Serializer):
    """
    Serializer for medical data in appointments
    """
    blood_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    allergies = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    medications = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    medical_conditions = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    reason_for_visit = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class AppointmentSerializer(MongoModelSerializer):
    patient = serializers.CharField()
    doctor = serializers.CharField()
    date = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(default='scheduled')
    patient_info = PatientInfoSerializer(required=False)
    doctor_info = DoctorInfoSerializer(required=False)
    medical_data = MedicalDataSerializer(required=False)
    
    def create(self, validated_data):
        # Set default values
        validated_data['created_at'] = datetime.now()
        
        # Get patient and doctor information to embed
        patient_id = validated_data['patient']
        doctor_id = validated_data['doctor']
        
        # Get patient data
        patient = db.patients.find_one({'_id': ObjectId(patient_id)}) or db.patients.find_one({'id': patient_id})
        if patient:
            # Embed patient info
            validated_data['patient_info'] = {
                'name': patient.get('name', ''),
                'phone': patient.get('phone', ''),
                'email': patient.get('email', '')
            }
            
            # Embed medical data from patient
            medical_info = patient.get('medical_info', {})
            validated_data['medical_data'] = {
                'blood_type': medical_info.get('blood_type', ''),
                'allergies': medical_info.get('allergies', []),
                'medications': medical_info.get('medications', []),
                'medical_conditions': medical_info.get('chronic_diseases', []),
                'reason_for_visit': validated_data.get('notes', '')
            }
        
        # Get doctor data
        doctor = db.doctors.find_one({'_id': ObjectId(doctor_id)}) or db.doctors.find_one({'id': doctor_id})
        if doctor:
            # Embed doctor info
            validated_data['doctor_info'] = {
                'name': doctor.get('name', ''),
                'specialization': doctor.get('specialization', ''),
                'phone': doctor.get('phone', '')
            }
        
        # Check if date is in the past
        if validated_data['date'] < datetime.now():
            validated_data['status'] = 'completed'
        
        # Check for conflicts (same doctor, same time)
        existing = db.appointments.find_one({
            'doctor': doctor_id,
            'date': validated_data['date'],
            'status': 'scheduled'
        })
        
        if existing:
            raise serializers.ValidationError("This time slot is already booked")
        
        result = db.appointments.insert_one(validated_data)
        
        # Update patient's recent doctor
        if validated_data['status'] == 'completed' and 'patient' in validated_data:
            db.users.update_one(
                {'_id': ObjectId(validated_data['patient'])},
                {'$set': {'recent_doctor': validated_data['doctor']}}
            )
        
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        # Update embedded data if patient or doctor changes
        if 'patient' in validated_data and validated_data['patient'] != instance['patient']:
            patient_id = validated_data['patient']
            patient = db.patients.find_one({'_id': ObjectId(patient_id)}) or db.patients.find_one({'id': patient_id})
            if patient:
                # Update patient info
                validated_data['patient_info'] = {
                    'name': patient.get('name', ''),
                    'phone': patient.get('phone', ''),
                    'email': patient.get('email', '')
                }
                
                # Update medical data
                medical_info = patient.get('medical_info', {})
                validated_data['medical_data'] = {
                    'blood_type': medical_info.get('blood_type', ''),
                    'allergies': medical_info.get('allergies', []),
                    'medications': medical_info.get('medications', []),
                    'medical_conditions': medical_info.get('chronic_diseases', []),
                    'reason_for_visit': validated_data.get('notes', instance.get('notes', ''))
                }
        
        if 'doctor' in validated_data and validated_data['doctor'] != instance['doctor']:
            doctor_id = validated_data['doctor']
            doctor = db.doctors.find_one({'_id': ObjectId(doctor_id)}) or db.doctors.find_one({'id': doctor_id})
            if doctor:
                # Update doctor info
                validated_data['doctor_info'] = {
                    'name': doctor.get('name', ''),
                    'specialization': doctor.get('specialization', ''),
                    'phone': doctor.get('phone', '')
                }
        
        # Check for conflicts if date is changing
        if 'date' in validated_data and validated_data['date'] != instance['date']:
            existing = db.appointments.find_one({
                'doctor': validated_data.get('doctor', instance['doctor']),
                'date': validated_data['date'],
                'status': 'scheduled',
                '_id': {'$ne': ObjectId(instance['_id'])}
            })
            
            if existing:
                raise serializers.ValidationError("This time slot is already booked")
        
        db.appointments.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        
        # Update patient's recent doctor if status changed to completed
        if validated_data.get('status') == 'completed' and instance.get('status') != 'completed':
            db.users.update_one(
                {'_id': ObjectId(instance['patient'])},
                {'$set': {'recent_doctor': instance['doctor']}}
            )
        
        updated_instance = db.appointments.find_one({'_id': ObjectId(instance['_id'])})
        return updated_instance

class ClinicStaffSerializer(MongoModelSerializer):
    """
    Serializer for clinic staff (admin users)
    """
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    position = serializers.CharField(max_length=100)
    permissions = serializers.ListField(child=serializers.CharField(), required=False)
    hire_date = serializers.DateField(default=datetime.now().date)
    user_id = serializers.CharField(required=False)
    
    def create(self, validated_data):
        result = db.clinic_staff.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.clinic_staff.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}

class RegistrationSerializer(MongoModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    username = serializers.CharField(required=False)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    birthday = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    chronic_diseases = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    medical_history = serializers.CharField(required=False, allow_blank=True)
    
    def create(self, validated_data):
        from .mongo_auth import hash_password
        
        # Hash password
        password = validated_data.pop('password')
        validated_data['password'] = hash_password(password)
        
        # Generate username from email if not provided
        if 'username' not in validated_data:
            email = validated_data['email']
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while db.users.find_one({'username': username}):
                username = f"{base_username}{counter}"
                counter += 1
            validated_data['username'] = username
        
        # Set default values
        validated_data['date_joined'] = datetime.now()
        validated_data['is_active'] = True
        validated_data['is_staff'] = validated_data.get('role') == 'doctor' or validated_data.get('role') == 'admin'
        validated_data['is_superuser'] = validated_data.get('role') == 'admin'
        
        result = db.users.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}

class PatientRegistrationSerializer(RegistrationSerializer):
    role = serializers.CharField(default='patient', read_only=True)
    medical_info = MedicalInfoSerializer(required=False)
    
    def create(self, validated_data):
        # Extract medical info if provided
        medical_info = validated_data.pop('medical_info', {
            'blood_type': '',
            'allergies': [],
            'medical_history': [],
            'chronic_diseases': [],
            'medications': [],
            'last_updated': datetime.now()
        })
        
        # Create user
        user = super().create(validated_data)
        
        # Create patient profile
        patient_data = {
            'name': f"{validated_data['first_name']} {validated_data['last_name']}",
            'email': validated_data['email'],
            'phone': validated_data.get('phone', ''),
            'date_of_birth': validated_data.get('birthday', ''),
            'gender': validated_data.get('gender', ''),
            'address': validated_data.get('address', ''),
            'user_id': str(user['_id']),
            'medical_info': medical_info,
            'created_at': datetime.now()
        }
        
        db.patients.insert_one(patient_data)
        
        return user

class DoctorRegistrationSerializer(RegistrationSerializer):
    role = serializers.CharField(default='doctor', read_only=True)
    specialization = serializers.CharField(required=True)
    qualification = serializers.CharField(required=True)
    experience_years = serializers.IntegerField(default=0, min_value=0)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('20.00'), min_value=Decimal('20.00'))
    available_days = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    medical_center = serializers.CharField(required=False, allow_null=True)
    emergency_available = serializers.BooleanField(default=False)
    daily_patient_limit = serializers.IntegerField(default=10)
    is_available = serializers.BooleanField(default=True)
    
    def create(self, validated_data):
        # Extract doctor-specific fields
        doctor_fields = {
            'specialization': validated_data.pop('specialization'),
            'qualification': validated_data.pop('qualification'),
            'experience_years': validated_data.pop('experience_years', 0),
            'consultation_fee': validated_data.pop('consultation_fee', Decimal('20.00')),
            'available_days': validated_data.pop('available_days', []),
            'bio': validated_data.pop('bio', ''),
            'medical_center': validated_data.pop('medical_center', None),
            'emergency_available': validated_data.pop('emergency_available', False),
            'daily_patient_limit': validated_data.pop('daily_patient_limit', 10),
            'is_available': validated_data.pop('is_available', True)
        }
        
        # Create user
        user = super().create(validated_data)
        
        # Create doctor profile
        doctor_data = {
            'name': f"{validated_data['first_name']} {validated_data['last_name']}",
            'email': validated_data['email'],
            'phone': validated_data.get('phone', ''),
            'user_id': str(user['_id']),
            **doctor_fields,
            'created_at': datetime.now()
        }
        
        db.doctors.insert_one(doctor_data)
        
        return user

class AdminRegistrationSerializer(RegistrationSerializer):
    role = serializers.CharField(default='admin', read_only=True)
    position = serializers.CharField(required=True)
    permissions = serializers.ListField(child=serializers.CharField(), required=False, default=['all'])
    
    def create(self, validated_data):
        # Extract admin-specific fields
        admin_fields = {
            'position': validated_data.pop('position'),
            'permissions': validated_data.pop('permissions', ['all']),
        }
        
        # Create user
        validated_data['role'] = 'admin'
        user = super().create(validated_data)
        
        # Create clinic staff profile
        staff_data = {
            'name': f"{validated_data['first_name']} {validated_data['last_name']}",
            'email': validated_data['email'],
            'phone': validated_data.get('phone', ''),
            'user_id': str(user['_id']),
            **admin_fields,
            'hire_date': datetime.now().date(),
            'created_at': datetime.now()
        }
        
        db.clinic_staff.insert_one(staff_data)
        
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={'input_type': 'password'})

class DoctorAvailabilitySerializer(MongoModelSerializer):
    doctor = serializers.CharField()
    day_of_week = serializers.IntegerField(min_value=0, max_value=6)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    is_available = serializers.BooleanField(default=True)
    day_name = serializers.SerializerMethodField()
    
    def get_day_name(self, obj):
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return days[obj['day_of_week']]
    
    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("End time must be after start time")
        return data
    
    def create(self, validated_data):
        result = db.doctor_availability.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.doctor_availability.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}

class AvailabilityExceptionSerializer(MongoModelSerializer):
    doctor = serializers.CharField()
    date = serializers.DateField()
    is_available = serializers.BooleanField(default=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    
    def validate_date(self, value):
        if value < datetime.now().date():
            raise serializers.ValidationError("Cannot set exceptions for past dates")
        return value
    
    def create(self, validated_data):
        result = db.availability_exceptions.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.availability_exceptions.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}
