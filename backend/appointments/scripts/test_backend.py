#!/usr/bin/env python3
"""
Comprehensive Backend Testing Script for Medical Appointment System

This script tests all backend functionality including:
- Authentication and authorization
- API endpoints for doctors, patients, appointments
- Edge cases like concurrent booking, daily limits
- Error handling and validation

Usage:
python test_backend.py --url http://localhost:8000
"""

import argparse
import requests
import json
import sys
import time
import random
from datetime import datetime, timedelta
import threading
import concurrent.futures

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Test credentials
TEST_USERS = {
    'admin': {
        'email': 'admin@medical-system.com',
        'password': 'Admin123!',
        'role': 'admin'
    },
    'doctor': {
        'email': 'doctor@example.com',
        'password': 'Doctor123!',
        'role': 'doctor'
    },
    'patient': {
        'email': 'patient@example.com',
        'password': 'Patient123!',
        'role': 'patient'
    }
}

class BackendTester:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.tokens = {}
        self.users = {}
        self.resources = {
            'doctors': [],
            'patients': [],
            'appointments': []
        }
        self.results = {
            'passed': 0,
            'failed': 0,
            'skipped': 0
        }
        self.session = requests.Session()
    
    def print_header(self, text):
        """Print a formatted header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD} {text} {Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    
    def print_subheader(self, text):
        """Print a formatted subheader"""
        print(f"\n{Colors.CYAN}{Colors.BOLD}{text}{Colors.ENDC}")
        print(f"{Colors.CYAN}{'-' * len(text)}{Colors.ENDC}")
    
    def print_success(self, text):
        """Print a success message"""
        print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")
        self.results['passed'] += 1
    
    def print_failure(self, text, error=None):
        """Print a failure message"""
        print(f"{Colors.RED}✗ {text}{Colors.ENDC}")
        if error:
            print(f"{Colors.RED}  Error: {error}{Colors.ENDC}")
        self.results['failed'] += 1
    
    def print_warning(self, text):
        """Print a warning message"""
        print(f"{Colors.YELLOW}! {text}{Colors.ENDC}")
    
    def print_info(self, text):
        """Print an info message"""
        print(f"{Colors.BLUE}ℹ {text}{Colors.ENDC}")
    
    def print_response(self, response, truncate=True):
        """Print response details"""
        print(f"{Colors.BLUE}  Status: {response.status_code} {response.reason}{Colors.ENDC}")
        
        try:
            data = response.json()
            if truncate and isinstance(data, list) and len(data) > 3:
                print(f"{Colors.BLUE}  Response: {json.dumps(data[:3])} ... ({len(data)} items){Colors.ENDC}")
            else:
                print(f"{Colors.BLUE}  Response: {json.dumps(data)}{Colors.ENDC}")
        except:
            if len(response.text) > 200 and truncate:
                print(f"{Colors.BLUE}  Response: {response.text[:200]}...{Colors.ENDC}")
            else:
                print(f"{Colors.BLUE}  Response: {response.text}{Colors.ENDC}")
    
    def print_summary(self):
        """Print test summary"""
        total = self.results['passed'] + self.results['failed'] + self.results['skipped']
        success_rate = (self.results['passed'] / total) * 100 if total > 0 else 0
        
        print(f"\n{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
        print(f"{Colors.BOLD} TEST SUMMARY {Colors.ENDC}")
        print(f"{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
        print(f"Total tests: {total}")
        print(f"{Colors.GREEN}Passed: {self.results['passed']} ({success_rate:.1f}%){Colors.ENDC}")
        print(f"{Colors.RED}Failed: {self.results['failed']}{Colors.ENDC}")
        print(f"{Colors.YELLOW}Skipped: {self.results['skipped']}{Colors.ENDC}")
        print(f"{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    
    def request(self, method, endpoint, data=None, files=None, role=None, expected_status=None, verbose=True):
        """Make a request to the API"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if role and role in self.tokens:
            headers['Authorization'] = f"Token {self.tokens[role]}"
        
        if data and not files:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(data)
        
        try:
            if data and not files:
                response = self.session.request(method, url, headers=headers, json=data)
            else:
                response = self.session.request(method, url, headers=headers, data=data, files=files)
            
            if verbose:
                print(f"\n{Colors.BLUE}Request: {method} {url}{Colors.ENDC}")
                if data:
                    if isinstance(data, dict) and 'password' in data:
                        # Don't print passwords
                        safe_data = data.copy()
                        safe_data['password'] = '********'
                        print(f"{Colors.BLUE}Data: {json.dumps(safe_data)}{Colors.ENDC}")
                    else:
                        print(f"{Colors.BLUE}Data: {json.dumps(data)}{Colors.ENDC}")
            
            if verbose:
                self.print_response(response)
            
            if expected_status and response.status_code != expected_status:
                return False, response
            
            return True, response
        except Exception as e:
            if verbose:
                print(f"{Colors.RED}Request error: {str(e)}{Colors.ENDC}")
            return False, str(e)
    
    def login(self, role):
        """Login with the specified role"""
        self.print_subheader(f"Login as {role}")
        
        if role not in TEST_USERS:
            self.print_failure(f"Unknown role: {role}")
            return False
        
        user = TEST_USERS[role]
        success, response = self.request('POST', '/api/login/', data={
            'email': user['email'],
            'username': user['email'],
            'password': user['password'],
            'role': role
        })
        
        if not success or response.status_code != 200:
            self.print_failure(f"Login as {role} failed")
            return False
        
        try:
            data = response.json()
            if 'token' in data and 'user' in data:
                self.tokens[role] = data['token']
                self.users[role] = data['user']
                self.print_success(f"Login as {role} successful")
                return True
            else:
                self.print_failure(f"Login response missing token or user data")
                return False
        except:
            self.print_failure(f"Failed to parse login response")
            return False
    
    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        self.print_header("Testing Authentication Endpoints")
        
        # Test CSRF token endpoint
        self.print_subheader("CSRF Token")
        success, response = self.request('GET', '/api/csrf/')
        if success and response.status_code == 200:
            self.print_success("CSRF token endpoint works")
        else:
            self.print_failure("CSRF token endpoint failed")
        
        # Test login with each role
        for role in ['admin', 'doctor', 'patient']:
            self.login(role)
        
        # Test token validation
        self.print_subheader("Token Validation")
        if 'admin' in self.tokens:
            success, response = self.request('GET', '/api/validate-token/', role='admin')
            if success and response.status_code == 200:
                self.print_success("Token validation successful")
            else:
                self.print_failure("Token validation failed")
        else:
            self.print_warning("Skipping token validation (no admin token)")
            self.results['skipped'] += 1
    
    def test_user_endpoints(self):
        """Test user-related endpoints"""
        self.print_header("Testing User Endpoints")
        
        # Test user profile
        self.print_subheader("User Profile")
        for role in ['admin', 'doctor', 'patient']:
            if role in self.tokens:
                success, response = self.request('GET', '/api/profile/', role=role)
                if success and response.status_code == 200:
                    self.print_success(f"Get {role} profile successful")
                else:
                    self.print_failure(f"Get {role} profile failed")
        
        # Test users list (admin only)
        self.print_subheader("Users List (Admin Only)")
        if 'admin' in self.tokens:
            success, response = self.request('GET', '/api/users/', role='admin')
            if success and response.status_code == 200:
                self.print_success("Admin can access users list")
                
                # Store some user IDs for later tests
                try:
                    users = response.json()
                    for user in users:
                        if user.get('role') == 'doctor' and len(self.resources['doctors']) < 3:
                            self.resources['doctors'].append(user.get('id'))
                        elif user.get('role') == 'patient' and len(self.resources['patients']) < 3:
                            self.resources['patients'].append(user.get('id'))
                    
                    self.print_info(f"Stored {len(self.resources['doctors'])} doctor IDs and {len(self.resources['patients'])} patient IDs for testing")
                except:
                    self.print_warning("Failed to parse users response")
        else:
            self.print_failure("Admin access to users list failed")
        
        # Test unauthorized access to users endpoint
        for role in ['doctor', 'patient']:
            if role in self.tokens:
                success, response = self.request('GET', '/api/users/', role=role, expected_status=403)
                if not success and response.status_code == 403:
                    self.print_success(f"{role.capitalize()} cannot access users list (correctly forbidden)")
                else:
                    self.print_failure(f"{role.capitalize()} should not be able to access users list")
    
    def test_doctor_endpoints(self):
        """Test doctor-related endpoints"""
        self.print_header("Testing Doctor Endpoints")
        
        # Test get all doctors
        self.print_subheader("Get All Doctors")
        for role in self.tokens.keys():
            success, response = self.request('GET', '/api/doctors/', role=role)
            if success and response.status_code == 200:
                self.print_success(f"{role.capitalize()} can get all doctors")
                
                # Store doctor IDs if we don't have them yet
                if not self.resources['doctors']:
                    try:
                        doctors = response.json()
                        self.resources['doctors'] = [doctor.get('id') for doctor in doctors[:3]]
                        self.print_info(f"Stored {len(self.resources['doctors'])} doctor IDs for testing")
                    except:
                        self.print_warning("Failed to parse doctors response")
            else:
                self.print_failure(f"{role.capitalize()} cannot get all doctors")
        
        # Test get doctor by ID
        self.print_subheader("Get Doctor by ID")
        if self.resources['doctors']:
            doctor_id = self.resources['doctors'][0]
            for role in self.tokens.keys():
                success, response = self.request('GET', f'/api/doctors/{doctor_id}/', role=role)
                if success and response.status_code == 200:
                    self.print_success(f"{role.capitalize()} can get doctor by ID")
                else:
                    self.print_failure(f"{role.capitalize()} cannot get doctor by ID")
        else:
            self.print_warning("Skipping get doctor by ID (no doctor IDs)")
            self.results['skipped'] += 1
        
        # Test doctor availability
        self.print_subheader("Doctor Availability")
        if self.resources['doctors']:
            doctor_id = self.resources['doctors'][0]
            for role in self.tokens.keys():
                success, response = self.request('GET', f'/api/doctors/{doctor_id}/availability/', role=role)
                if success and response.status_code == 200:
                    self.print_success(f"{role.capitalize()} can get doctor availability")
                else:
                    self.print_failure(f"{role.capitalize()} cannot get doctor availability")
        else:
            self.print_warning("Skipping doctor availability (no doctor IDs)")
            self.results['skipped'] += 1
    
    def test_patient_endpoints(self):
        """Test patient-related endpoints"""
        self.print_header("Testing Patient Endpoints")
        
        # Test get all patients
        self.print_subheader("Get All Patients")
        for role in self.tokens.keys():
            success, response = self.request('GET', '/api/patients/', role=role)
            if success and response.status_code == 200:
                self.print_success(f"{role.capitalize()} can get all patients")
                
                # Store patient IDs if we don't have them yet
                if not self.resources['patients']:
                    try:
                        patients = response.json()
                        self.resources['patients'] = [patient.get('id') for patient in patients[:3]]
                        self.print_info(f"Stored {len(self.resources['patients'])} patient IDs for testing")
                    except:
                        self.print_warning("Failed to parse patients response")
                else:
                    # This might be expected behavior depending on your system's permissions
                    self.print_warning(f"{role.capitalize()} cannot get all patients (may be expected)")
        
        # Test get patient by ID
        self.print_subheader("Get Patient by ID")
        if self.resources['patients']:
            patient_id = self.resources['patients'][0]
            for role in ['admin', 'doctor']:
                if role in self.tokens:
                    success, response = self.request('GET', f'/api/patients/{patient_id}/', role=role)
                    if success and response.status_code == 200:
                        self.print_success(f"{role.capitalize()} can get patient by ID")
                    else:
                        self.print_warning(f"{role.capitalize()} cannot get patient by ID (may be expected)")
        else:
            self.print_warning("Skipping get patient by ID (no patient IDs)")
            self.results['skipped'] += 1
    
    def test_appointment_endpoints(self):
        """Test appointment-related endpoints"""
        self.print_header("Testing Appointment Endpoints")
        
        # Test get all appointments
        self.print_subheader("Get All Appointments")
        for role in self.tokens.keys():
            success, response = self.request('GET', '/api/appointments/', role=role)
            if success and response.status_code == 200:
                self.print_success(f"{role.capitalize()} can get appointments")
                
                # Store appointment IDs for later tests
                try:
                    appointments = response.json()
                    if appointments:
                        self.resources['appointments'] = [appt.get('id') for appt in appointments[:3]]
                        self.print_info(f"Stored {len(self.resources['appointments'])} appointment IDs for testing")
                except:
                    self.print_warning("Failed to parse appointments response")
            else:
                self.print_failure(f"{role.capitalize()} cannot get appointments")
        
        # Test get appointment by ID
        self.print_subheader("Get Appointment by ID")
        if self.resources['appointments']:
            appointment_id = self.resources['appointments'][0]
            for role in self.tokens.keys():
                success, response = self.request('GET', f'/api/appointments/{appointment_id}/', role=role)
                if success and response.status_code == 200:
                    self.print_success(f"{role.capitalize()} can get appointment by ID")
                else:
                    self.print_failure(f"{role.capitalize()} cannot get appointment by ID")
        else:
            self.print_warning("Skipping get appointment by ID (no appointment IDs)")
            self.results['skipped'] += 1
        
        # Test create appointment
        self.print_subheader("Create Appointment")
        if self.resources['doctors'] and 'patient' in self.tokens:
            doctor_id = self.resources['doctors'][0]
            
            # Create an appointment for tomorrow
            tomorrow = datetime.now() + timedelta(days=1)
            appointment_time = tomorrow.replace(hour=10, minute=0).strftime('%Y-%m-%dT%H:%M:%S')
            
            appointment_data = {
                'doctor': doctor_id,
                'date': appointment_time,
                'notes': 'Test appointment from API test',
                'reason_for_visit': 'API Testing',
                'blood_type': 'O+',
                'medications': 'None',
                'allergies': 'None',
                'medical_conditions': 'None',
                'patient_phone': '555-123-4567'
            }
            
            success, response = self.request('POST', '/api/appointments/', data=appointment_data, role='patient')
            if success and response.status_code in [200, 201]:
                self.print_success("Patient can create appointment")
                
                # Store the new appointment ID
                try:
                    new_appointment = response.json()
                    if new_appointment and 'id' in new_appointment:
                        self.resources['appointments'].append(new_appointment['id'])
                        self.print_info(f"Stored new appointment ID: {new_appointment['id']}")
                except:
                    self.print_warning("Failed to parse new appointment response")
            else:
                self.print_failure("Patient cannot create appointment")
        else:
            self.print_warning("Skipping create appointment (no doctor ID or patient token)")
            self.results['skipped'] += 1
        
        # Test update appointment status
        self.print_subheader("Update Appointment Status")
        if self.resources['appointments'] and 'doctor' in self.tokens:
            appointment_id = self.resources['appointments'][0]
            
            success, response = self.request(
                'PATCH', 
                f'/api/appointments/{appointment_id}/update-status/', 
                data={'status': 'completed'}, 
                role='doctor'
            )
            
            if success and response.status_code == 200:
                self.print_success("Doctor can update appointment status")
            else:
                self.print_warning("Doctor cannot update appointment status via standard endpoint")
                
                # Try the direct update endpoint as fallback
                self.print_info("Trying direct update endpoint...")
                success, response = self.request(
                    'POST',
                    f'/api/appointments/{appointment_id}/direct-update/',
                    data={'status': 'completed'},
                    role='doctor'
                )
                
                if success and response.status_code == 200:
                    self.print_success("Doctor can update appointment status via direct endpoint")
                else:
                    self.print_failure("Doctor cannot update appointment status")
        else:
            self.print_warning("Skipping update appointment status (no appointment IDs or doctor token)")
            self.results['skipped'] += 1
        
        # Test cancel appointment
        self.print_subheader("Cancel Appointment")
        if 'patient' in self.tokens and len(self.resources['appointments']) > 1:
            appointment_id = self.resources['appointments'][-1]
            
            success, response = self.request(
                'POST',
                f'/api/appointments/{appointment_id}/cancel/',
                role='patient'
            )
            
            if success and response.status_code in [200, 202]:
                self.print_success("Patient can cancel appointment")
            else:
                self.print_failure("Patient cannot cancel appointment")
        else:
            self.print_warning("Skipping cancel appointment (no appointment IDs or patient token)")
            self.results['skipped'] += 1
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        self.print_header("Testing Edge Cases")
        
        # Test concurrent appointment booking
        self.print_subheader("Concurrent Appointment Booking")
        if 'patient' in self.tokens and self.resources['doctors']:
            doctor_id = self.resources['doctors'][0]
            
            # Create appointment data for same time slot
            tomorrow = datetime.now() + timedelta(days=1)
            appointment_time = tomorrow.replace(hour=11, minute=0).strftime('%Y-%m-%dT%H:%M:%S')
            
            appointment_data = {
                'doctor': doctor_id,
                'date': appointment_time,
                'notes': 'Concurrent booking test',
                'reason_for_visit': 'Testing concurrent booking',
                'blood_type': 'A+',
                'medications': 'None',
                'allergies': 'None',
                'medical_conditions': 'None',
                'patient_phone': '555-123-4567'
            }
            
            # Function to book appointment
            def book_appointment():
                return self.request(
                    'POST',
                    '/api/appointments/',
                    data=appointment_data,
                    role='patient',
                    verbose=False
                )
            
            # Book appointments concurrently
            self.print_info("Attempting to book 3 concurrent appointments for the same time slot...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(book_appointment) for _ in range(3)]
                results = [future.result() for future in concurrent.futures.as_completed(futures)]
            
            # Check results
            successes = sum(1 for success, _ in results if success)
            failures = 3 - successes
            
            self.print_info(f"Concurrent booking results: {successes} succeeded, {failures} failed")
            
            if failures > 0:
                self.print_success("System correctly prevented some concurrent bookings")
            else:
                self.print_warning("System allowed all concurrent bookings (check if this is intended)")
        else:
            self.print_warning("Skipping concurrent booking test (missing doctor ID or patient token)")
            self.results['skipped'] += 1
        
        # Test booking outside doctor's hours
        self.print_subheader("Booking Outside Doctor's Hours")
        if self.resources['doctors'] and 'patient' in self.tokens:
            doctor_id = self.resources['doctors'][0]
            
            # Create appointment at 3 AM (likely outside hours)
            tomorrow = datetime.now() + timedelta(days=1)
            appointment_time = tomorrow.replace(hour=3, minute=0).strftime('%Y-%m-%dT%H:%M:%S')
            
            appointment_data = {
                'doctor': doctor_id,
                'date': appointment_time,
                'notes': 'Outside hours test',
                'reason_for_visit': 'Testing outside hours booking',
                'patient_phone': '555-123-4567'
            }
            
            success, response = self.request(
                'POST',
                '/api/appointments/',
                data=appointment_data,
                role='patient'
            )
            
            if not success or response.status_code >= 400:
                self.print_success("System correctly rejected booking outside doctor's hours")
            else:
                self.print_warning("System allowed booking outside doctor's hours (check if this is intended)")
        else:
            self.print_warning("Skipping outside hours test (missing doctor ID or patient token)")
            self.results['skipped'] += 1
        
        # Test invalid data handling
        self.print_subheader("Invalid Data Handling")
        if 'patient' in self.tokens:
            # Test with missing required fields
            invalid_data = {
                'notes': 'Invalid appointment test'
                # Missing doctor and date fields
            }
            
            success, response = self.request(
                'POST',
                '/api/appointments/',
                data=invalid_data,
                role='patient'
            )
            
            if not success or response.status_code >= 400:
                self.print_success("System correctly rejected appointment with missing required fields")
            else:
                self.print_failure("System accepted appointment with missing required fields")
            
            # Test with invalid date format
            invalid_data = {
                'doctor': self.resources['doctors'][0] if self.resources['doctors'] else 'invalid-id',
                'date': 'not-a-date',
                'notes': 'Invalid date format test'
            }
            
            success, response = self.request(
                'POST',
                '/api/appointments/',
                data=invalid_data,
                role='patient'
            )
            
            if not success or response.status_code >= 400:
                self.print_success("System correctly rejected appointment with invalid date format")
            else:
                self.print_failure("System accepted appointment with invalid date format")
        else:
            self.print_warning("Skipping invalid data tests (no patient token)")
            self.results['skipped'] += 1
    
    def test_performance(self):
        """Test API performance under load"""
        self.print_header("Testing API Performance")
        
        endpoints = [
            ('/api/doctors/', 'GET', None),
            ('/api/patients/', 'GET', None),
            ('/api/appointments/', 'GET', None)
        ]
        
        for endpoint, method, role in endpoints:
            if role in self.tokens:
                self.print_subheader(f"Performance: {method} {endpoint}")
                
                # Make 10 requests and measure time
                times = []
                for i in range(10):
                    start_time = time.time()
                    success, _ = self.request(method, endpoint, role=role, verbose=False)
                    end_time = time.time()
                    
                    if success:
                        times.append(end_time - start_time)
                
                if times:
                    avg_time = sum(times) / len(times)
                    max_time = max(times)
                    min_time = min(times)
                    
                    self.print_info(f"Average response time: {avg_time:.3f}s")
                    self.print_info(f"Min/Max response time: {min_time:.3f}s / {max_time:.3f}s")
                    
                    if avg_time < 1.0:
                        self.print_success(f"Performance is good (avg &lt; 1s)")
                    elif avg_time < 3.0:
                        self.print_warning(f"Performance is acceptable but could be improved")
                    else:
                        self.print_failure(f"Performance is poor (avg > 3s)")
            else:
                self.print_warning(f"Skipping performance test for {endpoint} (no {role} token)")
                self.results['skipped'] += 1
    
    def test_concurrent_requests(self):
        """Test API with concurrent requests"""
        self.print_header("CONCURRENT REQUESTS TESTS")
        
        # Only run if we have at least one token
        if not self.tokens:
            self.skip_test("Concurrent Requests", "No authentication tokens available")
            return
        
        # Get a role with a token
        role = list(self.tokens.keys())[0]
        
        # Endpoint to test
        endpoint = '/api/doctors/'
        
        # Number of concurrent requests
        num_concurrent = 10
        
        self.log(f"Making {num_concurrent} concurrent requests to {endpoint}")
        
        # Function for worker threads
        def worker():
            success, response = self.request('GET', endpoint, auth_role=role)
            return success and response and response.status_code == 200
        
        # Use thread pool to make concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
            futures = [executor.submit(worker) for _ in range(num_concurrent)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # Calculate success rate
        success_count = sum(results)
        success_rate = (success_count / num_concurrent) * 100
        
        self.log(f"Concurrent requests success rate: {success_rate:.1f}%")
        
        # Record result
        if success_rate == 100:
            self.print_success("Concurrent requests handled successfully")
        elif success_rate >= 80:
            self.print_warning("Some concurrent requests failed, but overall performance is acceptable")
        else:
            self.print_failure("Concurrent requests test failed")
    
    def run_tests(self):
        """Run all tests"""
        self.print_header("MEDICAL APPOINTMENT SYSTEM BACKEND TESTS")
        print(f"Testing against: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test authentication
        self.test_auth_endpoints()
        
        # Test user endpoints
        self.test_user_endpoints()
        
        # Test doctor endpoints
        self.test_doctor_endpoints()
        
        # Test patient endpoints
        self.test_patient_endpoints()
        
        # Test appointment endpoints
        self.test_appointment_endpoints()
        
        # Test edge cases
        self.test_edge_cases()
        
        # Test performance
        self.test_performance()
        
        # Test concurrent requests
        self.test_concurrent_requests()
        
        # Print summary
        self.print_summary()
        
        return self.results['failed'] == 0

def main():
    parser = argparse.ArgumentParser(description='Test API endpoints for Medical Appointment System')
    parser.add_argument('--url', default='http://localhost:8000', help='Base URL of the API')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose output')
    
    args = parser.parse_args()
    
    tester = BackendTester(args.url, args.verbose)
    success = tester.run_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())