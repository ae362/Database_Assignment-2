import os
import re
import shutil
from datetime import datetime

def backup_file(file_path):
    """Create a backup of a file before modifying it"""
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return False
        
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    backup_path = f"{file_path}.bak_{timestamp}"
    
    try:
        shutil.copy2(file_path, backup_path)
        print(f"Created backup: {backup_path}")
        return True
    except Exception as e:
        print(f"Error creating backup: {str(e)}")
        return False

def update_serializers_file(file_path):
    """Update the mongo_serializers.py file"""
    if not backup_file(file_path):
        return False
        
    try:
        with open(file_path, 'r') as file:
            content = file.read()
            
        # Update AppointmentSerializer to use patientMedicalInfo instead of direct medical fields
        appointment_serializer_pattern = r'class AppointmentSerializer$$MongoModelSerializer$$:.*?def create\('
        appointment_serializer_section = re.search(appointment_serializer_pattern, content, re.DOTALL)
        
        if appointment_serializer_section:
            old_section = appointment_serializer_section.group(0)
            
            # Create new section with patientMedicalInfo
            new_section = old_section.replace(
                'blood_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)\n    medications = serializers.CharField(required=False, allow_blank=True, allow_null=True)\n    allergies = serializers.CharField(required=False, allow_blank=True, allow_null=True)\n    medical_conditions = serializers.CharField(required=False, allow_blank=True, allow_null=True)',
                'patientMedicalInfo = serializers.DictField(required=False, allow_null=True)'
            )
            
            # Replace the old section with the new one
            content = content.replace(old_section, new_section)
            
        # Update the create method to handle patientMedicalInfo
        create_method_pattern = r'def create$$self, validated_data$$:.*?return \{.*?\}'
        create_method = re.search(create_method_pattern, content, re.DOTALL)
        
        if create_method:
            old_method = create_method.group(0)
            
            # Add code to fetch patient medical info
            new_method = old_method.replace(
                '# Set default values',
                '# Get patient medical info\n        if \'patient\' in validated_data:\n            patient = db.patients.find_one({\'id\': validated_data[\'patient\']})\n            if patient:\n                validated_data[\'patientMedicalInfo\'] = {\n                    \'blood_type\': patient.get(\'blood_type\', \'\'),\n                    \'allergies\': patient.get(\'allergies\', []),\n                    \'critical_conditions\': patient.get(\'medical_history\', [])\n                }\n                \n        # Set default values'
            )
            
            content = content.replace(old_method, new_method)
            
        # Update PatientSerializer to handle structured medical data
        patient_serializer_pattern = r'class PatientSerializer$$MongoModelSerializer$$:.*?def create\('
        patient_serializer_section = re.search(patient_serializer_pattern, content, re.DOTALL)
        
        if not patient_serializer_section:
            # If PatientSerializer doesn't exist, add it
            patient_serializer = """
class PatientSerializer(MongoModelSerializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    date_of_birth = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    blood_type = serializers.CharField(required=False, allow_blank=True)
    medical_history = serializers.ListField(required=False, allow_empty=True)
    allergies = serializers.ListField(required=False, allow_empty=True)
    medications = serializers.ListField(required=False, allow_empty=True)
    user_id = serializers.CharField(required=False)
    
    def create(self, validated_data):
        result = db.patients.insert_one(validated_data)
        return {**validated_data, '_id': result.inserted_id}
    
    def update(self, instance, validated_data):
        db.patients.update_one({'_id': ObjectId(instance['_id'])}, {'$set': validated_data})
        return {**instance, **validated_data}
"""
            # Add the new serializer before the AppointmentSerializer
            content = content.replace(
                'class AppointmentSerializer(MongoModelSerializer):',
                f'{patient_serializer}\n\nclass AppointmentSerializer(MongoModelSerializer):'
            )
        
        # Write the updated content back to the file
        with open(file_path, 'w') as file:
            file.write(content)
            
        print(f"Updated serializers file: {file_path}")
        return True
    except Exception as e:
        print(f"Error updating serializers file: {str(e)}")
        return False

def update_views_file(file_path):
    """Update the mongo_views.py file"""
    if not backup_file(file_path):
        return False
        
    try:
        with open(file_path, 'r') as file:
            content = file.read()
            
        # Update the appointments view to handle patientMedicalInfo
        appointments_post_pattern = r'# CREATE.*?elif request\.method == \'POST\'.*?return add_cors_headers$$response$$'
        appointments_post_section = re.search(appointments_post_pattern, content, re.DOTALL)
        
        if appointments_post_section:
            old_section = appointments_post_section.group(0)
            
            # Replace direct medical fields with patientMedicalInfo
            new_section = old_section.replace(
                "'blood_type': data.get('blood_type', ''),\n                'medications': data.get('medications', ''),\n                'allergies': data.get('allergies', ''),\n                'medical_conditions': data.get('medical_conditions', ''),",
                "# Get patient medical info\n            patient = db.patients.find_one({'id': user['id']})\n            patient_medical_info = {\n                'blood_type': patient.get('blood_type', '') if patient else '',\n                'allergies': patient.get('allergies', []) if patient else [],\n                'critical_conditions': patient.get('medical_history', []) if patient else []\n            }\n            'patientMedicalInfo': patient_medical_info,"
            )
            
            content = content.replace(old_section, new_section)
            
        # Update the patients view to handle structured medical data
        patients_update_pattern = r'# UPDATE.*?elif request\.method in \[\'PUT\', \'PATCH\'\] and id is not None:.*?return add_cors_headers$$response$$'
        patients_update_section = re.search(patients_update_pattern, content, re.DOTALL)
        
        if patients_update_section:
            old_section = patients_update_section.group(0)
            
            # Add code to handle structured medical data
            new_section = old_section.replace(
                "db.patients.update_one(\n                    {'id': id},\n                    {'$set': data}\n                )",
                "# Handle structured medical data\n                if 'medical_history' in data and isinstance(data['medical_history'], str):\n                    # Convert string to structured format\n                    medical_history = data['medical_history']\n                    if medical_history.strip():\n                        conditions = [condition.strip() for condition in medical_history.split(',')]\n                        structured_conditions = []\n                        for condition in conditions:\n                            structured_conditions.append({\n                                'condition': condition,\n                                'diagnosed_date': None,\n                                'notes': ''\n                            })\n                        data['medical_history'] = structured_conditions\n                    else:\n                        data['medical_history'] = []\n                        \n                if 'allergies' in data and isinstance(data['allergies'], str):\n                    # Convert string to structured format\n                    allergies = data['allergies']\n                    if allergies.strip():\n                        allergy_list = [allergy.strip() for allergy in allergies.split(',')]\n                        structured_allergies = []\n                        for allergy in allergy_list:\n                            structured_allergies.append({\n                                'name': allergy,\n                                'severity': 'Unknown',\n                                'reaction': '',\n                                'diagnosed_date': None\n                            })\n                        data['allergies'] = structured_allergies\n                    else:\n                        data['allergies'] = []\n                        \n                if 'medications' in data and isinstance(data['medications'], str):\n                    # Convert string to structured format\n                    medications = data['medications']\n                    if medications.strip():\n                        medication_list = [med.strip() for med in medications.split(',')]\n                        structured_medications = []\n                        for med in medication_list:\n                            structured_medications.append({\n                                'name': med,\n                                'dosage': '',\n                                'frequency': '',\n                                'start_date': None,\n                                'end_date': None\n                            })\n                        data['medications'] = structured_medications\n                    else:\n                        data['medications'] = []\n                \n                db.patients.update_one(\n                    {'id': id},\n                    {'$set': data}\n                )"
            )
            
            content = content.replace(old_section, new_section)
            
        # Write the updated content back to the file
        with open(file_path, 'w') as file:
            file.write(content)
            
        print(f"Updated views file: {file_path}")
        return True
    except Exception as e:
        print(f"Error updating views file: {str(e)}")
        return False

def update_appointment_service_file(file_path):
    """Update the appointment_service.py file"""
    if not backup_file(file_path):
        return False
        
    try:
        with open(file_path, 'r') as file:
            content = file.read()
            
        # Update the book_appointment function to handle patientMedicalInfo
        book_appointment_pattern = r'def book_appointment$$.*?$$:.*?return True, appointment\.id'
        book_appointment_function = re.search(book_appointment_pattern, content, re.DOTALL)
        
        if book_appointment_function:
            old_function = book_appointment_function.group(0)
            
            # Add code to get patient medical info
            new_function = old_function.replace(
                "# Create the appointment using Django ORM",
                "# Get patient medical info from MongoDB\n        patient_doc = db.patients.find_one({'user_id': str(patient_id)})\n        patient_medical_info = None\n        \n        if patient_doc:\n            patient_medical_info = {\n                'blood_type': patient_doc.get('blood_type', ''),\n                'allergies': patient_doc.get('allergies', []),\n                'critical_conditions': patient_doc.get('medical_history', [])\n            }\n            \n        # Create the appointment using Django ORM"
            )
            
            # Add patientMedicalInfo to the appointment
            new_function = new_function.replace(
                "appointment = Appointment.objects.create(\n            patient=patient,\n            doctor=doctor,\n            date=appointment_date,\n            status='scheduled',\n            patient_phone=patient.phone\n        )",
                "appointment = Appointment.objects.create(\n            patient=patient,\n            doctor=doctor,\n            date=appointment_date,\n            status='scheduled',\n            patient_phone=patient.phone,\n            patientMedicalInfo=patient_medical_info\n        )"
            )
            
            content = content.replace(old_function, new_function)
            
        # Write the updated content back to the file
        with open(file_path, 'w') as file:
            file.write(content)
            
        print(f"Updated appointment service file: {file_path}")
        return True
    except Exception as e:
        print(f"Error updating appointment service file: {str(e)}")
        return False

def main():
    """Main function to update all backend files"""
    print("Starting backend code update...")
    
    # Get the current directory
    current_dir = os.getcwd()
    
    # Define file paths
    serializers_file = os.path.join(current_dir, 'mongo_serializers.py')
    views_file = os.path.join(current_dir, 'mongo_views.py')
    appointment_service_file = os.path.join(current_dir, 'appointment_service.py')
    
    # Update files
    update_serializers_file(serializers_file)
    update_views_file(views_file)
    update_appointment_service_file(appointment_service_file)
    
    print("Backend code update completed!")

if __name__ == "__main__":
    main()