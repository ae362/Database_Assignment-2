from django.utils import timezone
from bson.objectid import ObjectId
import pymongo
import json
import uuid
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import json_util

# MongoDB setup
MONGO_URI = "mongodb://localhost:27017/"
DATABASE_NAME = "healthcare_appointment_system"

client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

# Create indexes for better performance
db.appointments.create_index([("doctor_id", ASCENDING), ("date", ASCENDING)])
db.appointments.create_index([("patient_id", ASCENDING), ("date", ASCENDING)])
db.appointments.create_index([("status", ASCENDING)])
db.doctors.create_index([("specialization", ASCENDING)])
db.doctors.create_index([("is_available", ASCENDING)])
db.patients.create_index([("user_id", ASCENDING)])
db.clinic_staff.create_index([("email", ASCENDING)], unique=True)

# Helper function to parse MongoDB documents to JSON
def parse_json(data):
    return json.loads(json_util.dumps(data))

def book_appointment(patient_id, doctor_id, appointment_date, notes="", medical_data=None):
    """
    Book an appointment with MongoDB transaction support
    
    Args:
        patient_id (str): ID of the patient
        doctor_id (str): ID of the doctor
        appointment_date (datetime): Date and time of the appointment
        notes (str, optional): Notes for the appointment
        medical_data (dict, optional): Medical data for the appointment
        
    Returns:
        tuple: (success, result)
            - If success is True, result is the appointment ID
            - If success is False, result is an error message
    """
    # Validate inputs
    if not patient_id or not doctor_id or not appointment_date:
        return False, "Missing required fields"
    
    # Check if appointment is in the past
    if appointment_date < timezone.now():
        return False, "Cannot book appointments in the past"
    
    try:
        # Check if the time slot is already booked
        existing = db.appointments.find_one({
            "doctor_id": doctor_id,
            "date": appointment_date,
            "status": "scheduled"
        })
        
        if existing:
            return False, "This time slot is already booked"
        
        # Get patient and doctor info
        patient = db.patients.find_one({"id": patient_id}) or db.patients.find_one({"user_id": patient_id})
        doctor = db.doctors.find_one({"id": doctor_id})
        
        if not patient:
            return False, "Invalid patient ID"
        
        if not doctor:
            return False, "Invalid doctor ID"
        
        # Prepare patient info to embed
        patient_info = {
            "name": patient.get("name", ""),
            "phone": patient.get("phone", ""),
            "email": patient.get("email", "")
        }
        
        # Prepare doctor info to embed
        doctor_info = {
            "name": doctor.get("name", ""),
            "specialization": doctor.get("specialization", ""),
            "phone": doctor.get("phone", "")
        }
        
        # Prepare medical data to embed
        if not medical_data:
            # Extract from patient's medical info
            patient_medical_info = patient.get("medical_info", {})
            medical_data = {
                "blood_type": patient_medical_info.get("blood_type", ""),
                "allergies": patient_medical_info.get("allergies", []),
                "medications": patient_medical_info.get("medications", []),
                "medical_conditions": patient_medical_info.get("chronic_diseases", []),
                "reason_for_visit": notes
            }
        
        # Create the appointment
        appointment_id = str(ObjectId())
        appointment = {
            "id": appointment_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "date": appointment_date,
            "status": "scheduled",
            "notes": notes,
            "patient_info": patient_info,
            "doctor_info": doctor_info,
            "medical_data": medical_data,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Insert the appointment
        db.appointments.insert_one(appointment)
        
        # Store booking history in MongoDB
        booking_entry = {
            'appointment_id': appointment_id,
            'patient_name': patient_info["name"],
            'date': appointment_date
        }
        
        # Update doctor's booking history in MongoDB
        db.doctor_booking_history.update_one(
            {'doctor_id': doctor_id},
            {'$push': {'bookings': booking_entry}},
            upsert=True
        )
        
        return True, appointment_id
                
    except Exception as e:
        return False, f"Error booking appointment: {str(e)}"

def get_available_slots(doctor_id, date):
    """
    Get available appointment slots for a doctor on a specific date
    
    Args:
        doctor_id (str): ID of the doctor
        date (date): Date to check availability
        
    Returns:
        list: List of available time slots
    """
    try:
        # Get doctor
        doctor = db.doctors.find_one({"id": doctor_id})
        if not doctor:
            return []
        
        # Check if doctor is available on this day
        day_of_week = date.weekday()
        available_days = doctor.get("available_days", [])
        
        # Convert day numbers to day names if needed
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_name = day_names[day_of_week]
        
        if str(day_of_week) not in available_days and day_name not in available_days:
            return []
        
        # Check if doctor has an exception for this date
        exception = db.doctor_exceptions.find_one({
            "doctor_id": doctor_id,
            "date": date.strftime("%Y-%m-%d")
        })
        
        if exception:
            return []
        
        # Define working hours (e.g., 9 AM to 5 PM)
        start_hour = 9
        end_hour = 17
        
        # Define slot duration in minutes
        slot_duration = 30
        
        # Get booked appointments for this doctor on this date
        date_start = datetime.combine(date, datetime.min.time())
        date_end = datetime.combine(date, datetime.max.time())
        
        booked_appointments = list(db.appointments.find({
            "doctor_id": doctor_id,
            "date": {"$gte": date_start, "$lte": date_end},
            "status": "scheduled"
        }))
        
        # Extract booked times
        booked_times = [appointment["date"].time() for appointment in booked_appointments]
        
        # Generate all possible slots
        all_slots = []
        current_time = datetime.combine(date, datetime.min.time().replace(hour=start_hour))
        end_time = datetime.combine(date, datetime.min.time().replace(hour=end_hour))
        
        while current_time < end_time:
            # Check if this slot is booked
            if current_time.time() not in booked_times:
                all_slots.append(current_time)
            
            # Move to next slot
            current_time = current_time.replace(minute=current_time.minute + slot_duration)
        
        return all_slots
    
    except Exception as e:
        print(f"Error getting available slots: {str(e)}")
        return []

def cancel_appointment(appointment_id, user_id):
    """
    Cancel an appointment
    
    Args:
        appointment_id (str): ID of the appointment
        user_id (str): ID of the user cancelling the appointment
        
    Returns:
        tuple: (success, result)
            - If success is True, result is a success message
            - If success is False, result is an error message
    """
    try:
        # Get appointment
        appointment = db.appointments.find_one({"id": appointment_id})
        if not appointment:
            return False, "Appointment not found"
        
        # Get user
        user = db.users.find_one({"id": user_id})
        if not user:
            return False, "User not found"
        
        # Check if user has permission to cancel this appointment
        if user.get("role") != "admin" and user_id != appointment["patient_id"] and user_id != appointment["doctor_id"]:
            return False, "You do not have permission to cancel this appointment"
        
        # Update appointment status
        db.appointments.update_one(
            {"id": appointment_id},
            {"$set": {"status": "cancelled", "updated_at": datetime.now()}}
        )
        
        return True, "Appointment cancelled successfully"
    
    except Exception as e:
        return False, f"Error cancelling appointment: {str(e)}"

def reschedule_appointment(appointment_id, new_date, user_id):
    """
    Reschedule an appointment
    
    Args:
        appointment_id (str): ID of the appointment
        new_date (datetime): New date and time for the appointment
        user_id (str): ID of the user rescheduling the appointment
        
    Returns:
        tuple: (success, result)
            - If success is True, result is a success message
            - If success is False, result is an error message
    """
    try:
        # Get appointment
        appointment = db.appointments.find_one({"id": appointment_id})
        if not appointment:
            return False, "Appointment not found"
        
        # Get user
        user = db.users.find_one({"id": user_id})
        if not user:
            return False, "User not found"
        
        # Check if user has permission to reschedule this appointment
        if user.get("role") != "admin" and user_id != appointment["patient_id"] and user_id != appointment["doctor_id"]:
            return False, "You do not have permission to reschedule this appointment"
        
        # Check if new date is in the past
        if new_date < timezone.now():
            return False, "Cannot reschedule to a past date"
        
        # Check if the time slot is already booked
        existing = db.appointments.find_one({
            "id": {"$ne": appointment_id},  # Exclude current appointment
            "doctor_id": appointment["doctor_id"],
            "date": new_date,
            "status": "scheduled"
        })
        
        if existing:
            return False, "This time slot is already booked"
        
        # Update appointment date
        db.appointments.update_one(
            {"id": appointment_id},
            {"$set": {"date": new_date, "updated_at": datetime.now()}}
        )
        
        return True, "Appointment rescheduled successfully"
    
    except Exception as e:
        return False, f"Error rescheduling appointment: {str(e)}"

def get_appointment_details(appointment_id, user_id):
    """
    Get detailed information about an appointment
    
    Args:
        appointment_id (str): ID of the appointment
        user_id (str): ID of the user requesting the details
        
    Returns:
        tuple: (success, result)
            - If success is True, result is the appointment details
            - If success is False, result is an error message
    """
    try:
        # Get appointment
        appointment = db.appointments.find_one({"id": appointment_id})
        if not appointment:
            return False, "Appointment not found"
        
        # Get user
        user = db.users.find_one({"id": user_id})
        if not user:
            return False, "User not found"
        
        # Check if user has permission to view this appointment
        if user.get("role") != "admin" and user_id != appointment["patient_id"] and user_id != appointment["doctor_id"]:
            return False, "You do not have permission to view this appointment"
        
        # Get additional information
        patient = db.patients.find_one({"id": appointment["patient_id"]})
        doctor = db.doctors.find_one({"id": appointment["doctor_id"]})
        
        # Prepare detailed response
        details = {
            "appointment": appointment,
            "patient": patient,
            "doctor": doctor
        }
        
        return True, details
    
    except Exception as e:
        return False, f"Error getting appointment details: {str(e)}"

def update_appointment_status(appointment_id, new_status, user_id, notes=None):
    """
    Update the status of an appointment
    
    Args:
        appointment_id (str): ID of the appointment
        new_status (str): New status for the appointment
        user_id (str): ID of the user updating the status
        notes (str, optional): Additional notes for the status update
        
    Returns:
        tuple: (success, result)
            - If success is True, result is a success message
            - If success is False, result is an error message
    """
    try:
        # Get appointment
        appointment = db.appointments.find_one({"id": appointment_id})
        if not appointment:
            return False, "Appointment not found"
        
        # Get user
        user = db.users.find_one({"id": user_id})
        if not user:
            return False, "User not found"
        
        # Check if user has permission to update this appointment
        if user.get("role") != "admin" and user.get("role") != "doctor":
            return False, "You do not have permission to update this appointment status"
        
        # If doctor, check if they are the assigned doctor
        if user.get("role") == "doctor":
            doctor = db.doctors.find_one({"user_id": user_id})
            if not doctor or doctor["id"] != appointment["doctor_id"]:
                return False, "You can only update appointments assigned to you"
        
        # Validate status
        valid_statuses = ["scheduled", "completed", "cancelled", "no_show"]
        if new_status not in valid_statuses:
            return False, f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        
        # Update appointment status
        update_data = {
            "status": new_status,
            "updated_at": datetime.now()
        }
        
        if notes:
            update_data["notes"] = notes
        
        db.appointments.update_one(
            {"id": appointment_id},
            {"$set": update_data}
        )
        
        return True, f"Appointment status updated to {new_status}"
    
    except Exception as e:
        return False, f"Error updating appointment status: {str(e)}"

def get_patient_appointments(patient_id, status=None):
    """
    Get all appointments for a patient
    
    Args:
        patient_id (str): ID of the patient
        status (str, optional): Filter by appointment status
        
    Returns:
        list: List of appointments
    """
    try:
        # Build query
        query = {"patient_id": patient_id}
        
        if status:
            query["status"] = status
        
        # Get appointments
        appointments = list(db.appointments.find(query).sort("date", DESCENDING))
        
        return appointments
    
    except Exception as e:
        print(f"Error getting patient appointments: {str(e)}")
        return []

def get_doctor_appointments(doctor_id, date=None, status=None):
    """
    Get all appointments for a doctor
    
    Args:
        doctor_id (str): ID of the doctor
        date (date, optional): Filter by date
        status (str, optional): Filter by appointment status
        
    Returns:
        list: List of appointments
    """
    try:
        # Build query
        query = {"doctor_id": doctor_id}
        
        if status:
            query["status"] = status
        
        if date:
            date_start = datetime.combine(date, datetime.min.time())
            date_end = datetime.combine(date, datetime.max.time())
            query["date"] = {"$gte": date_start, "$lte": date_end}
        
        # Get appointments
        appointments = list(db.appointments.find(query).sort("date", ASCENDING))
        
        return appointments
    
    except Exception as e:
        print(f"Error getting doctor appointments: {str(e)}")
        return []

def get_appointment_statistics(doctor_id=None, start_date=None, end_date=None):
    """
    Get statistics about appointments
    
    Args:
        doctor_id (str, optional): Filter by doctor
        start_date (date, optional): Start date for statistics
        end_date (date, optional): End date for statistics
        
    Returns:
        dict: Appointment statistics
    """
    try:
        # Build query
        query = {}
        
        if doctor_id:
            query["doctor_id"] = doctor_id
        
        if start_date and end_date:
            query["date"] = {
                "$gte": datetime.combine(start_date, datetime.min.time()),
                "$lte": datetime.combine(end_date, datetime.max.time())
            }
        
        # Get total appointments
        total = db.appointments.count_documents(query)
        
        # Get appointments by status
        scheduled = db.appointments.count_documents({**query, "status": "scheduled"})
        completed = db.appointments.count_documents({**query, "status": "completed"})
        cancelled = db.appointments.count_documents({**query, "status": "cancelled"})
        no_show = db.appointments.count_documents({**query, "status": "no_show"})
        
        # Calculate completion rate
        completion_rate = (completed / total) * 100 if total > 0 else 0
        
        # Calculate cancellation rate
        cancellation_rate = ((cancelled + no_show) / total) * 100 if total > 0 else 0
        
        # Get appointments by day of week
        days_of_week = {
            0: "Monday",
            1: "Tuesday",
            2: "Wednesday",
            3: "Thursday",
            4: "Friday",
            5: "Saturday",
            6: "Sunday"
        }
        
        day_stats = {}
        for day_num, day_name in days_of_week.items():
            day_query = query.copy()
            day_query["date"] = {"$dayOfWeek": day_num + 1}  # MongoDB uses 1-7 for days of week
            day_stats[day_name] = db.appointments.count_documents(day_query)
        
        # Prepare statistics
        statistics = {
            "total": total,
            "by_status": {
                "scheduled": scheduled,
                "completed": completed,
                "cancelled": cancelled,
                "no_show": no_show
            },
            "completion_rate": completion_rate,
            "cancellation_rate": cancellation_rate,
            "by_day_of_week": day_stats
        }
        
        return statistics
    
    except Exception as e:
        print(f"Error getting appointment statistics: {str(e)}")
        return {}

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
            return JsonResponse({'error': 'Invalid authorization format'}, status=401)
        
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
            
            # Check if filtering by patient
            patient_id = request.GET.get('patient')
            
            # Check if filtering by date range
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            
            # Check if filtering by status
            status = request.GET.get('status')
            
            # Pagination parameters
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
            skip = (page - 1) * limit
            
            # Build query
            query = {}
            
            if doctor_id:
                query['doctor_id'] = doctor_id
                
            if patient_id:
                query['patient_id'] = patient_id
                
            if status:
                query['status'] = status
                
            if start_date and end_date:
                query['date'] = {
                    '$gte': datetime.fromisoformat(start_date),
                    '$lte': datetime.fromisoformat(end_date)
                }
            
            if is_admin_request:
                # Admin users can see all appointments with filters
                pass  # query is already set up
            else:
                # Regular users only see their own appointments
                if user.get('role') == 'doctor':
                    doctor = db.doctors.find_one({'user_id': user['id']})
                    if doctor:
                        query['doctor_id'] = doctor['id']
                    else:
                        query['doctor_id'] = 'non_existent'  # No matches
                else:
                    query['patient_id'] = user['id']
            
            # Get total count for pagination
            total_count = db.appointments.count_documents(query)
            
            # Get appointments with pagination
            appointments_cursor = db.appointments.find(query).sort('date', DESCENDING).skip(skip).limit(limit)
            appointments = list(appointments_cursor)
            
            # Convert to JSON
            appointments_json = parse_json(appointments)
            
            # Add pagination metadata
            response_data = {
                'appointments': appointments_json,
                'pagination': {
                    'total': total_count,
                    'page': page,
                    'limit': limit,
                    'pages': (total_count + limit - 1) // limit
                }
            }
            
            response = JsonResponse(response_data, safe=False)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to view this appointment
            if user.get('role') != 'admin':
                doctor = None
                if user.get('role') == 'doctor':
                    doctor = db.doctors.find_one({'user_id': user['id']})
                
                if (doctor and doctor['id'] != appointment['doctor_id']) and user['id'] != appointment['patient_id']:
                    response = JsonResponse({'error': 'You do not have permission to view this appointment'}, status=403)
                    return add_cors_headers(response)
            
            # Convert to JSON
            appointment_json = parse_json(appointment)
            
            response = JsonResponse(appointment_json, safe=False)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            data = json.loads(request.body)
            
            # Set patient to current user if not admin
            if user.get('role') != 'admin' and user.get('role') != 'doctor':
                data['patient_id'] = user['id']
            
            # Validate required fields
            required_fields = ['doctor_id', 'date']
            for field in required_fields:
                if field not in data:
                    response = JsonResponse({'error': f'Missing required field: {field}'}, status=400)
                    return add_cors_headers(response)
            
            # Convert date string to datetime
            if isinstance(data['date'], str):
                data['date'] = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            
            # Book appointment using helper function
            success, result = book_appointment(
                patient_id=data.get('patient_id', user['id']),
                doctor_id=data['doctor_id'],
                appointment_date=data['date'],
                notes=data.get('notes', ''),
                medical_data=data.get('medical_data')
            )
            
            if success:
                # Get appointment
                appointment = db.appointments.find_one({'id': result})
                
                # Convert to JSON
                appointment_json = parse_json(appointment)
                
                response = JsonResponse(appointment_json, status=201)
                return add_cors_headers(response)
            else:
                response = JsonResponse({'error': result}, status=400)
                return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to update this appointment
            if user.get('role') != 'admin':
                doctor = None
                if user.get('role') == 'doctor':
                    doctor = db.doctors.find_one({'user_id': user['id']})
                
                # Doctors can update appointment status and notes
                if doctor and doctor['id'] == appointment['doctor_id']:
                    allowed_fields = ['status', 'notes', 'medical_data']
                    data = json.loads(request.body)
                    
                    # Filter out fields that doctor can't update
                    update_data = {k: v for k, v in data.items() if k in allowed_fields}
                    
                    if not update_data:
                        response = JsonResponse({'error': 'No valid fields to update'}, status=400)
                        return add_cors_headers(response)
                    
                    # Update timestamp
                    update_data['updated_at'] = datetime.now()
                    
                    # Update appointment
                    db.appointments.update_one({'id': id}, {'$set': update_data})
                    
                    # Get updated appointment
                    updated_appointment = db.appointments.find_one({'id': id})
                    
                    # Convert to JSON
                    appointment_json = parse_json(updated_appointment)
                    
                    response = JsonResponse(appointment_json)
                    return add_cors_headers(response)
                
                # Patients can only reschedule or cancel their own appointments
                elif user['id'] == appointment['patient_id']:
                    data = json.loads(request.body)
                    
                    # Patients can only update date or status (to cancel)
                    allowed_fields = ['date', 'status']
                    update_data = {k: v for k, v in data.items() if k in allowed_fields}
                    
                    # Patients can only cancel appointments, not change to other statuses
                    if 'status' in update_data and update_data['status'] != 'cancelled':
                        response = JsonResponse({'error': 'Patients can only cancel appointments'}, status=400)
                        return add_cors_headers(response)
                    
                    if not update_data:
                        response = JsonResponse({'error': 'No valid fields to update'}, status=400)
                        return add_cors_headers(response)
                    
                    # If rescheduling, check doctor availability
                    if 'date' in update_data:
                        # Convert date string to datetime
                        if isinstance(update_data['date'], str):
                            update_data['date'] = datetime.fromisoformat(update_data['date'].replace('Z', '+00:00'))
                        
                        appointment_date = update_data['date']
                        appointment_end = appointment_date + timedelta(minutes=30)
                        
                        # Check if doctor has another appointment at the same time
                        conflicting_appointments = db.appointments.count_documents({
                            'id': {'$ne': id},  # Exclude current appointment
                            'doctor_id': appointment['doctor_id'],
                            'status': {'$nin': ['cancelled', 'completed']},
                            '$or': [
                                # Appointment starts during existing appointment
                                {'date': {'$lt': appointment_date, '$gte': appointment_end}},
                                # Appointment ends during existing appointment
                                {'date': {'$lte': appointment_date, '$gt': appointment_end}},
                                # Appointment encompasses existing appointment
                                {'date': {'$gte': appointment_date, '$lt': appointment_end}}
                            ]
                        })
                        
                        if conflicting_appointments > 0:
                            response = JsonResponse({'error': 'Doctor is not available at the requested time'}, status=400)
                            return add_cors_headers(response)
                    
                    # Update timestamp
                    update_data['updated_at'] = datetime.now()
                    
                    # Update appointment
                    db.appointments.update_one({'id': id}, {'$set': update_data})
                    
                    # Get updated appointment
                    updated_appointment = db.appointments.find_one({'id': id})
                    
                    # Convert to JSON
                    appointment_json = parse_json(updated_appointment)
                    
                    response = JsonResponse(appointment_json)
                    return add_cors_headers(response)
                
                else:
                    response = JsonResponse({'error': 'You do not have permission to update this appointment'}, status=403)
                    return add_cors_headers(response)
            
            # Admin can update any field
            else:
                data = json.loads(request.body)
                
                # Convert date string to datetime if present
                if 'date' in data and isinstance(data['date'], str):
                    data['date'] = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
                
                # Update timestamp
                data['updated_at'] = datetime.now()
                
                # Update appointment
                db.appointments.update_one({'id': id}, {'$set': data})
                
                # Get updated appointment
                updated_appointment = db.appointments.find_one({'id': id})
                
                # Convert to JSON
                appointment_json = parse_json(updated_appointment)
                
                response = JsonResponse(appointment_json)
                return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
            # Get appointment
            appointment = db.appointments.find_one({'id': id})
            if not appointment:
                response = JsonResponse({'error': 'Appointment not found'}, status=404)
                return add_cors_headers(response)
            
            # Check if user has permission to delete this appointment
            if user.get('role') != 'admin' and user['id'] != appointment['patient_id']:
                response = JsonResponse({'error': 'You do not have permission to delete this appointment'}, status=403)
                return add_cors_headers(response)
            
            # Delete appointment (or mark as cancelled)
            if user.get('role') == 'admin':
                # Admins can hard delete
                db.appointments.delete_one({'id': id})
            else:
                # Patients just mark as cancelled
                db.appointments.update_one({'id': id}, {'$set': {'status': 'cancelled', 'updated_at': datetime.now()}})
            
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
def clinic_staff(request, id=None):
    """
    Endpoint for clinic staff management (admin only)
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
            
        # Extract the token
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
        
        # Check if user is admin
        if user.get('role') != 'admin':
            response = JsonResponse({'error': 'Admin privileges required'}, status=403)
            return add_cors_headers(response)
        
        # LIST
        if request.method == 'GET' and id is None:
            # Get all clinic staff with pagination
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
            skip = (page - 1) * limit
            
            # Get total count for pagination
            total_count = db.clinic_staff.count_documents({})
            
            # Get clinic staff with pagination
            staff_cursor = db.clinic_staff.find().sort('name', ASCENDING).skip(skip).limit(limit)
            staff_list = list(staff_cursor)
            
            # Convert to JSON
            staff_json = parse_json(staff_list)
            
            # Add pagination metadata
            response_data = {
                'clinic_staff': staff_json,
                'pagination': {
                    'total': total_count,
                    'page': page,
                    'limit': limit,
                    'pages': (total_count + limit - 1) // limit
                }
            }
            
            response = JsonResponse(response_data, safe=False)
            return add_cors_headers(response)
        
        # RETRIEVE
        elif request.method == 'GET' and id is not None:
            # Get staff member
            staff = db.clinic_staff.find_one({'id': id})
            if not staff:
                response = JsonResponse({'error': 'Staff member not found'}, status=404)
                return add_cors_headers(response)
            
            # Convert to JSON
            staff_json = parse_json(staff)
            
            response = JsonResponse(staff_json, safe=False)
            return add_cors_headers(response)
        
        # CREATE
        elif request.method == 'POST' and id is None:
            data = json.loads(request.body)
            
            # Generate UUID for new staff member
            staff_id = str(uuid.uuid4())
            data['id'] = staff_id
            
            # Add timestamps
            now = datetime.now()
            data['created_at'] = now
            data['updated_at'] = now
            
            # Set default values
            if 'is_active' not in data:
                data['is_active'] = True
            
            # Validate data
            required_fields = ['name', 'email', 'phone', 'position']
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
            
            # Insert staff member
            db.clinic_staff.insert_one(data)
            
            # Convert to JSON
            staff_json = parse_json(data)
            
            response = JsonResponse(staff_json, status=201)
            return add_cors_headers(response)
        
        # UPDATE
        elif request.method in ['PUT', 'PATCH'] and id is not None:
            # Get staff member
            staff = db.clinic_staff.find_one({'id': id})
            if not staff:
                response = JsonResponse({'error': 'Staff member not found'}, status=404)
                return add_cors_headers(response)
            
            data = json.loads(request.body)
            
            # Ensure position remains 'admin'
            if 'position' in data and data['position'] != 'admin':
                response = JsonResponse({'error': 'Clinic staff position must remain "admin"'}, status=400)
                return add_cors_headers(response)
            
            # Check if email is being changed and if it already exists
            if 'email' in data and data['email'] != staff['email']:
                if db.clinic_staff.find_one({'email': data['email']}):
                    response = JsonResponse({'error': 'Email already exists'}, status=400)
                    return add_cors_headers(response)
            
            # Update timestamp
            data['updated_at'] = datetime.now()
            
            # Update staff member
            db.clinic_staff.update_one({'id': id}, {'$set': data})
            
            # Get updated staff member
            updated_staff = db.clinic_staff.find_one({'id': id})
            
            # Convert to JSON
            staff_json = parse_json(updated_staff)
            
            response = JsonResponse(staff_json)
            return add_cors_headers(response)
        
        # DELETE
        elif request.method == 'DELETE' and id is not None:
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

@csrf_exempt
def doctors_availability(request, doctor_id):
    """
    Endpoint to get doctor's availability
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
            
        # Extract the token
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
        
        # Only GET method is allowed
        if request.method != 'GET':
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
        
        # Get doctor
        doctor = db.doctors.find_one({'id': doctor_id})
        if not doctor:
            response = JsonResponse({'error': 'Doctor not found'}, status=404)
            return add_cors_headers(response)
        
        # Check if doctor is available
        if not doctor.get('is_available', True):
            response = JsonResponse({'available_slots': [], 'message': 'Doctor is not available for appointments'})
            return add_cors_headers(response)
        
        # Get date range from query parameters
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to next 7 days
            start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = start_date + timedelta(days=7)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        # Get doctor's working hours
        working_hours = doctor.get('working_hours', {
            'monday': {'start': '09:00', 'end': '17:00'},
            'tuesday': {'start': '09:00', 'end': '17:00'},
            'wednesday': {'start': '09:00', 'end': '17:00'},
            'thursday': {'start': '09:00', 'end': '17:00'},
            'friday': {'start': '09:00', 'end': '17:00'},
            'saturday': None,
            'sunday': None
        })
        
        # Get doctor's appointments in the date range
        appointments = list(db.appointments.find({
            'doctor_id': doctor_id,
            'status': {'$nin': ['cancelled']},
            'date': {'$gte': start_date, '$lt': end_date}
        }))
        
        # Generate available slots
        available_slots = []
        current_date = start_date
        
        while current_date < end_date:
            day_name = current_date.strftime('%A').lower()
            day_hours = working_hours.get(day_name)
            
            if day_hours:
                # Parse working hours
                start_hour, start_minute = map(int, day_hours['start'].split(':'))
                end_hour, end_minute = map(int, day_hours['end'].split(':'))
                
                day_start = current_date.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
                day_end = current_date.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
                
                # Skip if day is already past
                if day_end < datetime.now():
                    current_date = current_date + timedelta(days=1)
                    continue
                
                # Generate slots (30-minute intervals)
                slot_time = day_start
                while slot_time < day_end:
                    slot_end = slot_time + timedelta(minutes=30)
                    
                    # Check if slot conflicts with any appointment
                    is_available = True
                    for appointment in appointments:
                        appt_time = appointment['date']
                        appt_end = appt_time + timedelta(minutes=30)
                        
                        if (slot_time >= appt_time and slot_time < appt_end) or \
                           (slot_end > appt_time and slot_end <= appt_end) or \
                           (slot_time <= appt_time and slot_end >= appt_end):
                            is_available = False
                            break
                    
                    # Check if we've reached daily patient limit
                    day_start_check = current_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    day_end_check = day_start_check + timedelta(days=1)
                    
                    daily_appointments = db.appointments.count_documents({
                        'doctor_id': doctor_id,
                        'status': {'$nin': ['cancelled']},
                        'date': {'$gte': day_start_check, '$lt': day_end_check}
                    })
                    
                    if daily_appointments >= doctor.get('daily_patient_limit', 20):
                        is_available = False
                    
                    if is_available:
                        available_slots.append({
                            'start': slot_time.isoformat(),
                            'end': slot_end.isoformat()
                        })
                    
                    slot_time = slot_end
            
            current_date = current_date + timedelta(days=1)
        
        response = JsonResponse({'available_slots': available_slots})
        return add_cors_headers(response)
    except Exception as e:
        print(f"Doctor availability endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

@csrf_exempt
def appointment_stats(request):
    """
    Endpoint to get appointment statistics
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
            
        # Extract the token
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
        
        # Only GET method is allowed
        if request.method != 'GET':
            response = JsonResponse({'error': 'Method not allowed'}, status=405)
            return add_cors_headers(response)
        
        # Check if user is admin or doctor
        if user.get('role') not in ['admin', 'doctor']:
            response = JsonResponse({'error': 'Admin or doctor privileges required'}, status=403)
            return add_cors_headers(response)
        
        # Get date range from query parameters
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 30 days
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        # Build query
        query = {
            'date': {'$gte': start_date, '$lt': end_date}
        }
        
        # If doctor, only show their appointments
        if user.get('role') == 'doctor':
            doctor = db.doctors.find_one({'user_id': user['id']})
            if doctor:
                query['doctor_id'] = doctor['id']
            else:
                query['doctor_id'] = 'non_existent'  # No matches
        
        # Get appointment counts by status
        status_counts = {}
        for status in ['scheduled', 'completed', 'cancelled', 'no_show']:
            status_query = query.copy()
            status_query['status'] = status
            status_counts[status] = db.appointments.count_documents(status_query)
        
        # Get appointment counts by day
        day_counts = []
        current_date = start_date
        while current_date < end_date:
            next_date = current_date + timedelta(days=1)
            day_query = query.copy()
            day_query['date'] = {'$gte': current_date, '$lt': next_date}
            
            day_data = {
                'date': current_date.strftime('%Y-%m-%d'),
                'total': db.appointments.count_documents(day_query),
                'completed': db.appointments.count_documents({**day_query, 'status': 'completed'}),
                'cancelled': db.appointments.count_documents({**day_query, 'status': 'cancelled'}),
                'no_show': db.appointments.count_documents({**day_query, 'status': 'no_show'})
            }
            day_counts.append(day_data)
            current_date = next_date
        
        # Get top doctors by appointment count (admin only)
        top_doctors = []
        if user.get('role') == 'admin':
            doctor_pipeline = [
                {'$match': {'date': {'$gte': start_date, '$lt': end_date}}},
                {'$group': {'_id': '$doctor_id', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 5}
            ]
            
            doctor_counts = list(db.appointments.aggregate(doctor_pipeline))
            
            for doc in doctor_counts:
                doctor_id = doc['_id']
                doctor = db.doctors.find_one({'id': doctor_id})
                if doctor:
                    top_doctors.append({
                        'id': doctor_id,
                        'name': doctor.get('name', 'Unknown'),
                        'specialization': doctor.get('specialization', 'Unknown'),
                        'appointment_count': doc['count']
                    })
        
        # Prepare response
        stats = {
            'total_appointments': sum(status_counts.values()),
            'status_counts': status_counts,
            'daily_counts': day_counts,
            'top_doctors': top_doctors,
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        }
        
        response = JsonResponse(stats)
        return add_cors_headers(response)
    except Exception as e:
        print(f"Appointment stats endpoint error: {str(e)}")
        response = JsonResponse({'error': 'An error occurred while processing your request'}, status=500)
        return add_cors_headers(response)

# Helper functions
def handle_options_request(request):
    """Handle OPTIONS request for CORS"""
    response = JsonResponse({})
    return add_cors_headers(response)

def add_cors_headers(response):
    """Add CORS headers to response"""
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

def get_user_from_token(token):
    """Get user from token"""
    try:
        # This is a placeholder - implement your token validation logic
        # For example, you might verify a JWT token or check a token in your database
        
        # For demonstration purposes, let's assume we have a users collection
        user = db.users.find_one({"token": token})
        return user
    except Exception as e:
        print(f"Error validating token: {str(e)}")
        return None
