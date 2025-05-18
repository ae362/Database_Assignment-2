// User types
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: "admin" | "doctor" | "patient"
  username?: string
  is_active?: boolean
  date_joined?: string
  last_login?: string
  phone?: string
  birthday?: string
  gender?: string
  address?: string
  avatar?: string
}

// Doctor types
export interface Doctor {
  id: string
  user_id?: string
  name: string
  specialization: string
  email: string
  phone: string
  qualification?: string
  experience_years?: number
  consultation_fee?: string
  available_days?: string
  bio?: string
  medical_center?: string
  medical_center_name?: string
  emergency_available?: boolean
  daily_patient_limit?: number
  is_available?: boolean
  created_at?: string
}

// Patient types
export interface Patient {
  id: string
  user_id?: string
  name: string
  email: string
  phone?: string
  date_of_birth?: string
  gender?: string
  address?: string
  medical_history?: string
  allergies?: string | string[]
  medications?: string | string[]
  chronic_diseases?: string
  created_at?: string
}

export interface Appointment {
  id: string | number
  patient: string
  patient_name: string
  doctor: string
  doctor_name: string
  date: string
  status: string
  reason_for_visit?: string
  notes: string
  patient_info?: {
    name: string
    email: string
    phone: string
    gender?: string
    address?: string
    date_of_birth?: string
  }
  doctor_info?: {
    name: string
    specialization: string
    phone?: string
  }
  medical_data?: {
    blood_type: string
    allergies: string[]
    medications: string[]
    medical_conditions: string[]
    reason_for_visit?: string
    chronic_diseases?: string[]
  }
  created_at: string
}

export interface PatientData {
  id: string
  name: string
  email: string
  phone: string
  gender?: string
  address?: string
  medical_history?: string[]
  allergies?: string[]
  medications?: string[]
  blood_type?: string
  chronic_diseases?: string[]
  medical_info?: {
    blood_type?: string
    allergies?: string[]
    medications?: string[]
    medical_history?: string[]
    chronic_diseases?: string[]
  }
}

// Doctor Exception types
export interface DoctorException {
  id: string
  doctor_id: string
  doctor_name: string
  date: string
  reason: string
  created_at?: string
  created_by?: string
}

// Auth types
export interface LoginCredentials {
  email: string
  password: string
  role?: string // Add the optional role property
}

export interface RegisterData {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
  birthday?: string
  gender?: string
  address?: string
  [key: string]: any
}

export interface AuthResponse {
  token: string
  user: User
}
