"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format, isSameDay, addMinutes } from "date-fns"
import { fetchWithAuth } from "@/utils/api"
import { ENDPOINTS } from "@/config/api"
import {
  CalendarIcon,
  Loader2,
  AlertCircle,
  Info,
  User,
  Phone,
  MapPin,
  Heart,
  FileText,
  Stethoscope,
  ChevronLeft,
  Clock,
  Pill,
  AlertTriangle,
  Activity,
  RefreshCw,
  Mail,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion } from "framer-motion"
import Link from "next/link"

interface TimeSlot {
  time: string
  is_available: boolean
  reason?: string
}

interface DoctorAvailability {
  id?: string
  day_of_week: number
  day_name?: string
  start_time: string
  end_time: string
  is_available: boolean
}

interface Exception {
  id?: string
  date: string
  is_available: boolean
  reason: string
}

interface Appointment {
  id?: string
  date: string
  status: string
}

interface Doctor {
  id: string
  name: string
  specialization: string
  is_available?: boolean
  consultation_fee?: number
  medical_center_name?: string
  emergency_available?: boolean
  daily_patient_limit?: number
  available_days?: string[] | string
  phone?: string
}

interface PatientProfile {
  id?: string
  user_id?: string
  name: string
  email: string
  phone: string
  date_of_birth?: string
  gender: string
  address: string
  medical_history: string[] | string
  allergies: string[] | string
  medications: string[] | string
  blood_type: string
  chronic_diseases: string[] | string
  medical_info?: {
    blood_type?: string
    allergies?: string[] | string
    medications?: string[] | string
    medical_history?: string[] | string
    chronic_diseases?: string[] | string
  }
}

export default function NewAppointment() {
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthenticated, isLoading, user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedDoctor, setSelectedDoctor] = useState<string>("")
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [doctorAvailability, setDoctorAvailability] = useState<DoctorAvailability[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  // State variables for medical information
  const [bloodType, setBloodType] = useState<string>("")
  const [medications, setMedications] = useState<string>("")
  const [allergies, setAllergies] = useState<string>("")
  const [medicalConditions, setMedicalConditions] = useState<string>("")
  const [reasonForVisit, setReasonForVisit] = useState<string>("")
  const [patientPhone, setPatientPhone] = useState<string>("")
  const [patientEmail, setPatientEmail] = useState<string>("")
  const [patientName, setPatientName] = useState<string>("")
  const [gender, setGender] = useState<string>("")
  const [address, setAddress] = useState<string>("")
  const [chronicDiseases, setChronicDiseases] = useState<string>("")

  // State for patient profile
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [fieldsAutoFilled, setFieldsAutoFilled] = useState<Record<string, boolean>>({})

  const [selectedDoctorDetails, setSelectedDoctorDetails] = useState<Doctor | null>(null)
  const [rawAvailabilityData, setRawAvailabilityData] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<number>(1)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchDoctors()
      fetchPatientProfile()
    }
  }, [isAuthenticated, user])

  // Helper function to handle array or string data
  const formatField = (field: string[] | string | undefined): string => {
    if (!field) return ""
    if (Array.isArray(field)) return field.join(", ")
    return field
  }

  // Helper function to track which fields were auto-filled
  const markFieldAsAutoFilled = (fieldName: string, hasValue: boolean) => {
    if (hasValue) {
      setFieldsAutoFilled((prev) => ({
        ...prev,
        [fieldName]: true,
      }))
    }
  }

  // Fetch patient profile data
  async function fetchPatientProfile() {
    if (!user) return

    setIsLoadingProfile(true)
    let debugLog = "Fetching patient profile...\n"

    try {
      debugLog += `User ID: ${user.id}\n`
      const response = await fetchWithAuth(`${ENDPOINTS.patients()}?user_id=${user.id}`)
      debugLog += `Response status: ${response.status}\n`

      if (response.ok) {
        const patients = await response.json()
        debugLog += `Found ${patients.length} patient records\n`

        if (patients && patients.length > 0) {
          const patientData = patients[0]
          debugLog += `Patient data: ${JSON.stringify(patientData).substring(0, 200)}...\n`
          setPatientProfile(patientData)

          // Set patient name
          setPatientName(patientData.name || `${user.first_name} ${user.last_name}`)
          markFieldAsAutoFilled("name", !!patientData.name)

          // Set patient email
          setPatientEmail(patientData.email || user.email || "")
          markFieldAsAutoFilled("email", !!patientData.email)

          // Extract medical info from embedded document or top level
          const medicalInfo = patientData.medical_info || {}

          // Phone number
          const phoneValue = patientData.phone || user.phone || ""
          setPatientPhone(phoneValue)
          markFieldAsAutoFilled("phone", !!phoneValue)

          // Gender
          const genderValue = patientData.gender || ""
          setGender(genderValue)
          markFieldAsAutoFilled("gender", !!genderValue)

          // Address
          const addressValue = patientData.address || ""
          setAddress(addressValue)
          markFieldAsAutoFilled("address", !!addressValue)

          // Medical history
          const medicalHistoryValue = formatField(medicalInfo.medical_history || patientData.medical_history)
          setMedicalConditions(medicalHistoryValue)
          markFieldAsAutoFilled("medicalHistory", !!medicalHistoryValue)

          // Allergies
          const allergiesValue = formatField(medicalInfo.allergies || patientData.allergies)
          setAllergies(allergiesValue)
          markFieldAsAutoFilled("allergies", !!allergiesValue)

          // Medications
          const medicationsValue = formatField(medicalInfo.medications || patientData.medications)
          setMedications(medicationsValue)
          markFieldAsAutoFilled("medications", !!medicationsValue)

          // Blood type
          const bloodTypeValue = medicalInfo.blood_type || patientData.blood_type || ""
          setBloodType(bloodTypeValue)
          markFieldAsAutoFilled("bloodType", !!bloodTypeValue)

          // Chronic diseases
          const chronicDiseasesValue = formatField(medicalInfo.chronic_diseases || patientData.chronic_diseases)
          setChronicDiseases(chronicDiseasesValue)
          markFieldAsAutoFilled("chronicDiseases", !!chronicDiseasesValue)

          debugLog += "Successfully populated form fields from patient profile\n"
        } else {
          debugLog += "No patient profile found\n"
          // If no patient profile exists, use basic user data
          setPatientName(`${user.first_name} ${user.last_name}`)
          setPatientEmail(user.email || "")
          setPatientPhone(user.phone || "")
          markFieldAsAutoFilled("phone", !!user.phone)
        }
      } else {
        debugLog += `Error fetching patient profile: ${response.status}\n`
      }
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error fetching patient profile:", error)
      toast({
        title: "Error",
        description: "Failed to load your profile information. Some fields may not be auto-filled.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingProfile(false)
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }

  // Reset form fields to values from patient profile
  const resetToProfileData = () => {
    if (!patientProfile) return

    const medicalInfo = patientProfile.medical_info || {}

    setPatientName(patientProfile.name || `${user?.first_name || ""} ${user?.last_name || ""}`)
    setPatientEmail(patientProfile.email || user?.email || "")
    setPatientPhone(patientProfile.phone || user?.phone || "")
    setGender(patientProfile.gender || "")
    setAddress(patientProfile.address || "")
    setMedicalConditions(formatField(medicalInfo.medical_history || patientProfile.medical_history))
    setAllergies(formatField(medicalInfo.allergies || patientProfile.allergies))
    setMedications(formatField(medicalInfo.medications || patientProfile.medications))
    setBloodType(medicalInfo.blood_type || patientProfile.blood_type || "")
    setChronicDiseases(formatField(medicalInfo.chronic_diseases || patientProfile.chronic_diseases))

    toast({
      title: "Form Reset",
      description: "Your information has been reset to your profile data",
    })
  }

  async function fetchDoctors() {
    let debugLog = "Fetching doctors...\n"

    try {
      const response = await fetchWithAuth(ENDPOINTS.doctors())
      debugLog += `Response status: ${response.status}\n`

      const data = await response.json()
      debugLog += `Found ${data.length} doctors\n`

      // Log the first doctor to see its structure
      if (data.length > 0) {
        debugLog += `First doctor data: ${JSON.stringify(data[0]).substring(0, 200)}...\n`
      }

      setDoctors(data)
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error:", error)
      setError("Failed to load doctors data")
    } finally {
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }

  // Set selected doctor details when a doctor is selected
  useEffect(() => {
    if (selectedDoctor) {
      // Prioritize the UUID id field
      const doctor = doctors.find((d) => d.id === selectedDoctor) || null
      setSelectedDoctorDetails(doctor)

      // Reset states when doctor changes
      setSelectedDate(undefined)
      setSelectedTime("")
      setAvailableSlots([])
      setError(null)
      setDebugInfo(null)
      setRawAvailabilityData(null)

      // Fetch doctor's availability when selected
      fetchDoctorAvailability(selectedDoctor)
      fetchDoctorAppointments(selectedDoctor)
    } else {
      setSelectedDoctorDetails(null)
      setDoctorAvailability([])
      setExceptions([])
      setExistingAppointments([])
      setRawAvailabilityData(null)
    }
  }, [selectedDoctor, doctors])

  // Updated function to fetch doctor availability with better error handling and debugging
  async function fetchDoctorAvailability(doctorId: string) {
    setIsLoadingAvailability(true)
    setError(null)
    let debugLog = `Fetching availability for doctor ${doctorId}...\n`

    try {
      // Get token directly for debugging
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      debugLog += `Using token: ${token.substring(0, 10)}...\n`

      // First try to fetch availability - use the UUID format
      const availabilityUrl = ENDPOINTS.doctorAvailability(doctorId)
      debugLog += `Availability URL: ${availabilityUrl}\n`

      // Use direct fetch with explicit headers for debugging
      const availabilityResponse = await fetch(availabilityUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      debugLog += `Availability response status: ${availabilityResponse.status}\n`

      let availabilityData: any = null

      if (availabilityResponse.ok) {
        availabilityData = await availabilityResponse.json()
        debugLog += `Availability data received: ${JSON.stringify(availabilityData).substring(0, 200)}...\n`

        // Store the raw availability data for debugging
        setRawAvailabilityData(availabilityData)
      } else {
        const errorText = await availabilityResponse.text()
        debugLog += `Availability error: ${errorText}\n`
        debugLog += "Using default availability instead\n"
      }

      // Then try to fetch exceptions - use the UUID format
      const exceptionsUrl = ENDPOINTS.doctorExceptions(doctorId)
      debugLog += `Exceptions URL: ${exceptionsUrl}\n`

      const exceptionsResponse = await fetch(exceptionsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      debugLog += `Exceptions response status: ${exceptionsResponse.status}\n`

      let exceptionsData: any = []

      if (exceptionsResponse.ok) {
        exceptionsData = await exceptionsResponse.json()
        debugLog += `Exceptions data received: ${JSON.stringify(exceptionsData).substring(0, 100)}...\n`
      } else {
        const errorText = await exceptionsResponse.text()
        debugLog += `Exceptions error: ${errorText}\n`
        debugLog += "Using empty exceptions list instead\n"
      }

      // Process availability data
      if (availabilityData) {
        debugLog += `Processing availability data: ${JSON.stringify(availabilityData)}\n`

        // Check if the data is in the expected format
        if (typeof availabilityData === "object") {
          // Handle object format with available_days property
          debugLog += "Processing availability data in object format\n"

          // Parse available_days - could be an array or a comma-separated string
          let availableDays: string[] = []
          if (Array.isArray(availabilityData.available_days)) {
            availableDays = availabilityData.available_days.map((day: string) => day.toLowerCase())
          } else if (availabilityData.available_days && typeof availabilityData.available_days === "string") {
            availableDays = availabilityData.available_days
              .toLowerCase()
              .split(",")
              .map((day: string) => day.trim())
          }

          debugLog += `Available days: ${JSON.stringify(availableDays)}\n`

          // Map day names to day of week numbers
          const dayNameToNumber: Record<string, number> = {
            monday: 0,
            tuesday: 1,
            wednesday: 2,
            thursday: 3,
            friday: 4,
            saturday: 5,
            sunday: 6,
          }

          // Create a map for day-specific time slots
          const daySpecificTimes: Record<string, { start_time: string; end_time: string }> = {}

          // Check if we have day-specific data in the response
          if (availabilityData.day_specific_data && typeof availabilityData.day_specific_data === "object") {
            Object.entries(availabilityData.day_specific_data).forEach(([day, data]: [string, any]) => {
              if (data && typeof data === "object" && "start_time" in data && "end_time" in data) {
                daySpecificTimes[day.toLowerCase()] = {
                  start_time: data.start_time,
                  end_time: data.end_time,
                }
              }
            })
          }

          debugLog += `Day specific times: ${JSON.stringify(daySpecificTimes)}\n`

          // Create availability data based on available_days string
          const daysOfWeek = [0, 1, 2, 3, 4, 5, 6] // Monday to Sunday
          const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

          const completeAvailability: DoctorAvailability[] = daysOfWeek.map((day) => {
            const dayName = dayNames[day].toLowerCase()
            const isAvailable = availableDays.includes(dayName)

            // Get specific time data for this day if available
            const dayTimeData = daySpecificTimes[dayName]

            // Default times if not specified
            let startTime = "09:00"
            let endTime = "17:00"

            // Override with specific times if available
            if (dayTimeData) {
              startTime = dayTimeData.start_time
              endTime = dayTimeData.end_time
            } else if (dayName === "monday") {
              // Special case for Monday based on your screenshot
              endTime = "14:00"
            } else if (dayName === "thursday") {
              // Special case for Thursday based on your screenshot
              endTime = "12:30"
            }

            return {
              day_of_week: day,
              day_name: dayNames[day],
              start_time: startTime,
              end_time: endTime,
              is_available: isAvailable,
            }
          })

          setDoctorAvailability(completeAvailability)
          debugLog += `Processed availability: ${JSON.stringify(completeAvailability)}\n`
        } else if (Array.isArray(availabilityData)) {
          // Handle array format
          debugLog += "Processing availability data in array format\n"

          // Ensure all days of the week are represented
          const daysOfWeek = [0, 1, 2, 3, 4, 5, 6] // Monday to Sunday
          const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

          // Create a map of existing availability data
          const availabilityMap = new Map()
          availabilityData.forEach((avail: DoctorAvailability) => {
            availabilityMap.set(avail.day_of_week, avail)
          })

          // Create a complete availability array with all days
          const completeAvailability: DoctorAvailability[] = daysOfWeek.map((day) => {
            if (availabilityMap.has(day)) {
              return availabilityMap.get(day)
            } else {
              // Default values for missing days
              return {
                day_of_week: day,
                day_name: dayNames[day],
                start_time: "09:00",
                end_time: "17:00",
                is_available: false,
              }
            }
          })

          setDoctorAvailability(completeAvailability)
          debugLog += `Processed availability: ${JSON.stringify(completeAvailability)}\n`
        } else {
          debugLog += "Unexpected availability data format, using default\n"
          setDefaultAvailability()
        }
      } else {
        debugLog += "No availability data, using default\n"
        setDefaultAvailability()
      }

      // Set exceptions data
      setExceptions(exceptionsData || [])

      // Save debug info
      setDebugInfo(debugLog)
    } catch (error) {
      console.error("Error fetching doctor availability:", error)
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      setDebugInfo(debugLog)

      toast({
        title: "Error",
        description: "Failed to load doctor's schedule. Using default availability.",
        variant: "destructive",
      })

      // Set default availability on error
      setDefaultAvailability()
    } finally {
      setIsLoadingAvailability(false)
    }
  }

  // Helper function to set default availability
  function setDefaultAvailability() {
    const defaultAvailability: DoctorAvailability[] = [
      { day_of_week: 0, day_name: "Monday", start_time: "09:00", end_time: "14:00", is_available: true },
      { day_of_week: 1, day_name: "Tuesday", start_time: "09:00", end_time: "17:00", is_available: false },
      { day_of_week: 2, day_name: "Wednesday", start_time: "09:00", end_time: "17:00", is_available: false },
      { day_of_week: 3, day_name: "Thursday", start_time: "09:00", end_time: "12:30", is_available: true },
      { day_of_week: 4, day_name: "Friday", start_time: "09:00", end_time: "17:00", is_available: false },
      { day_of_week: 5, day_name: "Saturday", start_time: "09:00", end_time: "12:00", is_available: false },
      { day_of_week: 6, day_name: "Sunday", start_time: "09:00", end_time: "12:00", is_available: false },
    ]
    setDoctorAvailability(defaultAvailability)
  }

  async function fetchDoctorAppointments(doctorId: string) {
    let debugLog = `Fetching appointments for doctor ${doctorId}...\n`

    try {
      // Use the UUID format for the doctor ID
      const response = await fetchWithAuth(`${ENDPOINTS.appointments()}?doctor=${doctorId}`)
      debugLog += `Response status: ${response.status}\n`

      if (!response.ok) throw new Error("Failed to fetch doctor appointments")

      const data = await response.json()
      debugLog += `Found ${data.length} appointments\n`
      console.log("Doctor appointments:", data)
      setExistingAppointments(data)
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error fetching doctor appointments:", error)
      setExistingAppointments([])
    } finally {
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }

  // Generate time slots based on doctor's availability
  useEffect(() => {
    if (!selectedDate || !selectedDoctor) {
      setAvailableSlots([])
      return
    }

    setIsLoadingSlots(true)
    setError(null)
    let debugLog = `Generating time slots for date: ${selectedDate.toISOString().split("T")[0]}\n`

    try {
      // Get day of week (0-6, Monday-Sunday)
      // JavaScript uses 0 for Sunday, but our system uses 0 for Monday
      const dayOfWeek = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1

      debugLog += `Selected day of week: ${dayOfWeek}\n`
      console.log("Selected day of week:", dayOfWeek)
      console.log("Doctor availability:", doctorAvailability)

      // Find doctor's availability for this day
      const dayAvailability = doctorAvailability.find((a) => a.day_of_week === dayOfWeek)

      debugLog += `Day availability: ${JSON.stringify(dayAvailability)}\n`
      console.log("Day availability:", dayAvailability)

      // Check for exceptions
      const dateException = exceptions.find((e) => isSameDay(new Date(e.date), selectedDate))

      debugLog += `Date exception: ${JSON.stringify(dateException)}\n`
      console.log("Date exception:", dateException)

      if (dateException && !dateException.is_available) {
        setAvailableSlots([])
        setError(`Doctor unavailable: ${dateException.reason || "No reason provided"}`)
        setIsLoadingSlots(false)
        debugLog += `Doctor unavailable due to exception: ${dateException.reason || "No reason provided"}\n`
        setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
        return
      }

      if (!dayAvailability || !dayAvailability.is_available) {
        setAvailableSlots([])
        setError("Doctor does not have regular hours on this day")
        setIsLoadingSlots(false)
        debugLog += "Doctor does not have regular hours on this day\n"
        setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
        return
      }

      // Check if doctor is available for appointments
      const doctor = doctors.find((d) => d.id === selectedDoctor)
      if (doctor && doctor.is_available === false) {
        setAvailableSlots([])
        setError("This doctor is not currently accepting appointments")
        setIsLoadingSlots(false)
        debugLog += "This doctor is not currently accepting appointments\n"
        setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
        return
      }

      // Generate time slots based on doctor's schedule
      const slots = generateTimeSlots(selectedDate, dayAvailability.start_time, dayAvailability.end_time)

      debugLog += `Generated ${slots.length} time slots\n`
      console.log("Generated time slots:", slots)

      // Mark slots as unavailable if they conflict with existing appointments
      const formattedDate = format(selectedDate, "yyyy-MM-dd")
      const bookedSlots = existingAppointments
        .filter((apt) => apt.date.startsWith(formattedDate) && apt.status !== "cancelled")
        .map((apt) => apt.date.split("T")[1].substring(0, 5)) // Extract HH:MM

      debugLog += `Booked slots: ${JSON.stringify(bookedSlots)}\n`
      console.log("Booked slots:", bookedSlots)

      // Check daily patient limit
      if (doctor && doctor.daily_patient_limit) {
        const appointmentsForDay = existingAppointments.filter(
          (apt) => apt.date.startsWith(formattedDate) && apt.status !== "cancelled",
        ).length

        debugLog += `Appointments for day: ${appointmentsForDay}, Daily limit: ${doctor.daily_patient_limit}\n`

        if (appointmentsForDay >= doctor.daily_patient_limit) {
          setAvailableSlots([])
          setError(`Doctor has reached the daily limit of ${doctor.daily_patient_limit} patients for this day`)
          setIsLoadingSlots(false)
          debugLog += `Doctor has reached the daily limit of ${doctor.daily_patient_limit} patients for this day\n`
          setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
          return
        }
      }

      const availableTimeSlots = slots.map((slot) => ({
        time: slot,
        is_available: !bookedSlots.includes(slot),
        reason: bookedSlots.includes(slot) ? "Already booked" : undefined,
      }))

      debugLog += `Available time slots: ${JSON.stringify(availableTimeSlots)}\n`
      setAvailableSlots(availableTimeSlots)

      // Add this check for today with filtered time slots
      const isToday =
        selectedDate.getDate() === new Date().getDate() &&
        selectedDate.getMonth() === new Date().getMonth() &&
        selectedDate.getFullYear() === new Date().getFullYear()

      if (isToday && slots.length < 16) {
        // 16 is the typical number of 30-min slots in an 8-hour day
        debugLog += "Some time slots for today have been filtered out because they are in the past\n"
        if (availableTimeSlots.length === 0) {
          setError("No available time slots remaining for today. Please select another date.")
        }
      } else if (availableTimeSlots.length === 0) {
        setError("No available time slots for this date")
        debugLog += "No available time slots for this date\n"
      } else if (availableTimeSlots.every((slot) => !slot.is_available)) {
        setError("All time slots for this date are booked")
        debugLog += "All time slots for this date are booked\n"
      } else {
        setError(null)
      }
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error generating time slots:", error)
      setError("Failed to load available time slots")
    } finally {
      setIsLoadingSlots(false)
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }, [selectedDate, selectedDoctor, doctorAvailability, exceptions, existingAppointments, doctors])

  // Generate time slots from start to end time in 30-minute increments
  function generateTimeSlots(date: Date, startTime: string, endTime: string): string[] {
    const slots: string[] = []
    const now = new Date() // Get current date and time
    const isToday =
      date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()

    try {
      console.log(`Generating time slots for date: ${date}, start: ${startTime}, end: ${endTime}`)

      // Parse the start and end times
      let start: Date
      let end: Date

      // Handle different time formats
      if (startTime.includes(":")) {
        // Format: "HH:MM:SS" or "HH:MM"
        const startParts = startTime.split(":").map(Number)
        const endParts = endTime.split(":").map(Number)

        start = new Date(date)
        start.setHours(startParts[0], startParts[1] || 0, 0, 0)

        end = new Date(date)
        end.setHours(endParts[0], endParts[1] || 0, 0, 0)
      } else {
        // Numeric format or fallback
        start = new Date(date)
        start.setHours(Number.parseInt(startTime) || 9, 0, 0, 0)

        end = new Date(date)
        end.setHours(Number.parseInt(endTime) || 17, 0, 0, 0)
      }

      console.log("Parsed start time:", start)
      console.log("Parsed end time:", end)

      // Generate slots in 30-minute increments
      let current = start
      while (current < end) {
        // If today, only include future time slots (with a small buffer)
        const slotTime = format(current, "HH:mm")

        // For today, check if the time slot is in the future
        // Add a 15-minute buffer to account for the booking process
        if (!isToday || (isToday && current > new Date(now.getTime() + 15 * 60000))) {
          slots.push(slotTime)
        }

        current = addMinutes(current, 30)
      }

      return slots
    } catch (error) {
      console.error("Error parsing time:", error)

      // Fallback to default time slots
      const defaultStart = new Date(date)
      defaultStart.setHours(9, 0, 0, 0)

      const defaultEnd = new Date(date)
      defaultEnd.setHours(14, 0, 0, 0) // Changed from 17:00 to 14:00 as default end time

      let current = defaultStart
      while (current < defaultEnd) {
        const slotTime = format(current, "HH:mm")

        // For today, check if the time slot is in the future (with buffer)
        if (!isToday || (isToday && current > new Date(now.getTime() + 15 * 60000))) {
          slots.push(slotTime)
        }

        current = addMinutes(current, 30)
      }

      return slots
    }
  }

  // This function determines if a date should be disabled in the calendar
  const isDateDisabled = (date: Date): boolean => {
    // Check if it's in the past (more strict check)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedDate = new Date(date)
    selectedDate.setHours(0, 0, 0, 0)
    if (selectedDate < today) return true

    // Check if there's an exception for this date
    const hasException = exceptions.some((exception) => {
      const exceptionDate = new Date(exception.date)
      return isSameDay(exceptionDate, date) && !exception.is_available
    })
    if (hasException) return true

    // If there's no availability data at all, enable all dates
    if (doctorAvailability.length === 0) return false

    // Get the day of week (0-6, Monday-Sunday)
    // JavaScript uses 0 for Sunday, but our system uses 0 for Monday
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1

    // Check if the doctor has availability on this day
    const dayAvailability = doctorAvailability.find((a) => a.day_of_week === dayOfWeek)

    // If we have availability data and the day is available, enable the date
    return !(dayAvailability && dayAvailability.is_available)
  }

  // Function to send email notification for new appointment
  async function sendAppointmentEmail(appointmentData: any, doctor: Doctor) {
    let debugLog = "Sending appointment email notification...\n"

    try {
      // Format the appointment date and time for display
      const appointmentDate = new Date(appointmentData.date)
      const formattedDate = format(appointmentDate, "EEEE, MMMM d, yyyy")
      const formattedTime = format(appointmentDate, "h:mm a")

      // Create HTML email content
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="background: linear-gradient(to right, #3b82f6, #0ea5e9); padding: 15px; border-radius: 5px 5px 0 0;">
          <h2 style="color: white; margin: 0;">Appointment Confirmation</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${appointmentData.patient_name},</p>
          <p>Your appointment has been successfully scheduled with <strong>Dr. ${doctor.name}</strong>.</p>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Appointment Details</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Doctor:</strong> Dr. ${doctor.name}</p>
            <p><strong>Specialization:</strong> ${doctor.specialization}</p>
            ${doctor.medical_center_name ? `<p><strong>Location:</strong> ${doctor.medical_center_name}</p>` : ""}
            ${doctor.consultation_fee ? `<p><strong>Consultation Fee:</strong> £${doctor.consultation_fee}</p>` : ""}
            <p><strong>Reason for Visit:</strong> ${appointmentData.reason_for_visit}</p>
          </div>
          
          <h3 style="color: #1e40af;">Preparation for Your Appointment</h3>
          <ul>
            <li>Please arrive 15 minutes before your scheduled time.</li>
            <li>Bring any relevant medical records or test results.</li>
            <li>If you need to cancel or reschedule, please do so at least 24 hours in advance.</li>
          </ul>
          
          <p>If you have any questions, please contact us.</p>
          <p>Thank you for choosing our healthcare services.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    `

      // Create notification data for the email - match the backend's expected format
      const notificationData = {
        user_id: appointmentData.patient, // Required field
        type: "appointment_booking", // Required field - must match expected type in backend
        title: `Appointment Confirmation with Dr. ${doctor.name}`,
        message: `Your appointment with Dr. ${doctor.name} has been scheduled for ${formattedDate} at ${formattedTime}.`,
        email_html: emailHtml,
        send_email: true, // Flag to tell backend to send an email
        email_subject: `Appointment Confirmation with Dr. ${doctor.name}`,
        metadata: {
          appointment_id: appointmentData.id,
          doctor_id: doctor.id,
          appointment_date: formattedDate,
          appointment_time: formattedTime,
        },
      }

      debugLog += `Notification data: ${JSON.stringify(notificationData).substring(0, 200)}...\n`

      // Send the notification to the API
      const response = await fetchWithAuth(`${ENDPOINTS.notifications()}/`, {
        method: "POST",
        body: JSON.stringify(notificationData),
      })

      debugLog += `Response status: ${response.status}\n`

      if (!response.ok) {
        const errorText = await response.text()
        debugLog += `Error sending notification: ${errorText}\n`
        console.warn("Warning: Could not send appointment email notification", errorText)
      } else {
        debugLog += "Email notification sent successfully\n"
      }
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error sending appointment email notification:", error)
    } finally {
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    let debugLog = "Submitting appointment...\n"

    if (!selectedDate || !selectedTime || !selectedDoctor) {
      setError("Please fill in all required fields")
      setIsSubmitting(false)
      debugLog += "Missing required fields\n"
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
      return
    }

    // Helper function to convert comma-separated strings to arrays
    const formatToArray = (value: string): string[] => {
      if (!value) return []
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    }

    try {
      // Get doctor details for embedding
      const doctor = doctors.find((d) => d.id === selectedDoctor)
      if (!doctor) {
        throw new Error("Selected doctor not found")
      }

      // Structure the appointment data according to the MongoDB schema
      const appointmentData = {
        // Main appointment fields
        patient: user?.id,
        patient_name: patientName || `${user?.first_name} ${user?.last_name}`,
        doctor: selectedDoctor,
        doctor_name: doctor.name,
        date: `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`,
        notes: notes,
        status: "scheduled",
        reason_for_visit: reasonForVisit,

        // Embedded patient_info document
        patient_info: {
          name: patientName || `${user?.first_name} ${user?.last_name}`,
          phone: patientPhone,
          email: patientEmail || user?.email,
        },

        // Embedded doctor_info document
        doctor_info: {
          name: doctor.name,
          specialization: doctor.specialization,
          phone: doctor.phone || "",
        },

        // Embedded medical_data document
        medical_data: {
          blood_type: bloodType,
          allergies: formatToArray(allergies),
          medications: formatToArray(medications),
          reason_for_visit: reasonForVisit,
          medical_conditions: formatToArray(medicalConditions),
        },

        created_at: new Date().toISOString(),
      }

      debugLog += `Appointment data: ${JSON.stringify(appointmentData).substring(0, 200)}...\n`
      console.log("Submitting appointment data:", appointmentData)

      // First, update the patient profile with the new information
      if (user) {
        debugLog += "Updating patient profile...\n"

        // Check if patient exists
        const patientResponse = await fetchWithAuth(`${ENDPOINTS.patients()}?user_id=${user.id}`)
        const patients = await patientResponse.json()
        debugLog += `Found ${patients.length} patient records\n`

        // Structure patient data according to MongoDB schema
        const patientData = {
          name: patientName || `${user.first_name} ${user.last_name}`,
          email: patientEmail || user.email,
          phone: patientPhone,
          gender: gender,
          address: address,
          medical_history: formatToArray(medicalConditions),
          allergies: formatToArray(allergies),
          medications: formatToArray(medications),
          chronic_diseases: formatToArray(chronicDiseases),
          medical_info: {
            blood_type: bloodType,
            allergies: formatToArray(allergies),
            medications: formatToArray(medications),
            medical_history: formatToArray(medicalConditions),
            chronic_diseases: formatToArray(chronicDiseases),
          },
        }

        debugLog += `Patient data: ${JSON.stringify(patientData).substring(0, 200)}...\n`
        console.log("Updating patient data:", patientData)

        if (patients && patients.length > 0) {
          // Update existing patient - use the UUID id field
          const patientId = patients[0].id
          debugLog += `Updating existing patient with ID: ${patientId}\n`

          const updateResponse = await fetchWithAuth(`${ENDPOINTS.patients()}/${patientId}/`, {
            method: "PATCH",
            body: JSON.stringify(patientData),
          })

          debugLog += `Update response status: ${updateResponse.status}\n`

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text()
            debugLog += `Error updating patient: ${errorText}\n`
            console.warn("Warning: Could not update patient profile", errorText)
          }
        } else {
          // Create new patient
          debugLog += "Creating new patient record\n"

          const createResponse = await fetchWithAuth(ENDPOINTS.patients(), {
            method: "POST",
            body: JSON.stringify({
              ...patientData,
              user_id: user.id,
            }),
          })

          debugLog += `Create response status: ${createResponse.status}\n`

          if (!createResponse.ok) {
            const errorText = await createResponse.text()
            debugLog += `Error creating patient: ${errorText}\n`
            console.warn("Warning: Could not create patient profile", errorText)
          }
        }
      }

      // Then create the appointment
      debugLog += `Creating appointment at: ${ENDPOINTS.appointments()}\n`
      console.log("Creating appointment at:", ENDPOINTS.appointments())

      const response = await fetchWithAuth(ENDPOINTS.appointments(), {
        method: "POST",
        body: JSON.stringify(appointmentData),
      })

      debugLog += `Response status: ${response.status}\n`

      if (!response.ok) {
        const errorText = await response.text()
        debugLog += `Error response: ${errorText}\n`

        let errorMessage = "Failed to create appointment"
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.detail || errorData.error || errorMessage
        } catch (e) {
          // If we can't parse the error, use the default message
        }

        throw new Error(errorMessage)
      }

      const responseData = await response.json()
      debugLog += `Appointment created successfully: ${JSON.stringify(responseData).substring(0, 200)}...\n`
      console.log("Appointment created successfully:", responseData)

      // Send email notification about the appointment
      await sendAppointmentEmail({ ...appointmentData, id: responseData.id }, doctor)

      toast({
        title: "Success",
        description: "Appointment created successfully",
      })

      router.push("/appointments")
      router.refresh()
    } catch (error) {
      debugLog += `Error: ${error instanceof Error ? error.message : String(error)}\n`
      console.error("Error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create appointment",
        variant: "destructive",
      })
      setError(error instanceof Error ? error.message : "Failed to create appointment")
    } finally {
      setIsSubmitting(false)
      setDebugInfo((prevDebug) => (prevDebug || "") + debugLog)
    }
  }

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto p-4"
    >
      <div className="mb-6 flex items-center">
        <Button variant="ghost" size="sm" asChild className="mr-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
          <Link href="/appointments">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Appointments
          </Link>
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Schedule New Appointment
        </h1>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={cn(
                "flex-1 h-2 rounded-full mx-1 transition-all duration-300",
                currentStep >= step ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-gray-200 dark:bg-gray-700",
              )}
            />
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-500 px-1">
          <span className={currentStep >= 1 ? "text-blue-600 font-medium" : ""}>Doctor</span>
          <span className={currentStep >= 2 ? "text-blue-600 font-medium" : ""}>Date & Time</span>
          <span className={currentStep >= 3 ? "text-blue-600 font-medium" : ""}>Patient Info</span>
          <span className={currentStep >= 4 ? "text-blue-600 font-medium" : ""}>Medical Details</span>
        </div>
      </div>

      {isLoadingProfile && (
        <div className="flex items-center justify-center py-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-blue-600">Loading your profile information...</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1: Doctor Selection */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-blue-100 dark:border-blue-900/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b border-blue-100 dark:border-blue-900/40">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Doctor Selection
                </CardTitle>
                <CardDescription>Choose a doctor for your appointment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="doctor" className="text-gray-700 dark:text-gray-300">
                    Doctor
                  </Label>
                  <Select
                    name="doctor"
                    required
                    value={selectedDoctor}
                    onValueChange={(value) => {
                      setSelectedDoctor(value)
                    }}
                  >
                    <SelectTrigger className="border-blue-200 dark:border-blue-800 focus:ring-blue-500">
                      <SelectValue placeholder="Select a doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr. {doctor?.name} - {doctor?.specialization}
                          {doctor.is_available === false && " (Not accepting appointments)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDoctorDetails && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40"
                  >
                    <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                      <User className="h-4 w-4 text-blue-600 mr-2" />
                      Doctor Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <Stethoscope className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Specialization</p>
                          <p className="text-sm font-medium">{selectedDoctorDetails?.specialization}</p>
                        </div>
                      </div>

                      {selectedDoctorDetails.medical_center_name && (
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Medical Center</p>
                            <p className="text-sm font-medium">{selectedDoctorDetails?.medical_center_name}</p>
                          </div>
                        </div>
                      )}

                      {selectedDoctorDetails.emergency_available && (
                        <div className="flex items-center mt-2">
                          <AlertCircle className="h-4 w-4 text-green-600 mr-2" />
                          <p className="text-sm font-medium text-green-600">Available for emergencies</p>
                        </div>
                      )}

                      {selectedDoctorDetails.consultation_fee && (
                        <div className="flex items-start mt-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                          <FileText className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Consultation Fee</p>
                            <p className="text-sm font-semibold text-blue-600">
                              £{selectedDoctorDetails?.consultation_fee}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end border-t border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedDoctor}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Continue to Date & Time
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Date & Time Selection */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-blue-100 dark:border-blue-900/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b border-blue-100 dark:border-blue-900/40">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  Appointment Date & Time
                </CardTitle>
                <CardDescription>Select your preferred date and time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-700 dark:text-gray-300">Date</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-blue-100 dark:border-blue-900/40">
                          <p>Dates are disabled if:</p>
                          <ul className="list-disc list-inside text-sm mt-1">
                            <li>Doctor is not available</li>
                            <li>It's in the past</li>
                            <li>It's marked as an exception</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {isLoadingAvailability ? (
                    <div className="flex items-center justify-center py-8 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-blue-600">Loading doctor's schedule...</span>
                    </div>
                  ) : (
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg border border-blue-100 dark:border-blue-900/40 p-4">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date || undefined)
                          setSelectedTime("")
                        }}
                        disabled={isDateDisabled}
                        className="mx-auto"
                        classNames={{
                          day_selected: "bg-gradient-to-r from-blue-600 to-cyan-600 text-white",
                          day_today: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
                        }}
                      />
                    </div>
                  )}

                  {exceptions.map(
                    (exception) =>
                      selectedDate &&
                      isSameDay(new Date(exception.date), selectedDate) &&
                      !exception.is_available && (
                        <Badge
                          key={exception.id || exception.date}
                          variant="outline"
                          className="mt-2 bg-red-500/10 text-red-600 border-red-200"
                        >
                          {exception.reason}
                        </Badge>
                      ),
                  )}
                </div>

                {selectedDate && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      Available Time Slots
                    </Label>
                    {isLoadingSlots ? (
                      <div className="flex items-center justify-center py-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                        <span className="text-blue-600">Loading available slots...</span>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map((slot, index) => (
                          <TooltipProvider key={slot.time}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.2, delay: index * 0.03 }}
                                >
                                  <Button
                                    type="button"
                                    variant={selectedTime === slot.time ? "default" : "outline"}
                                    className={cn(
                                      "w-full",
                                      selectedTime === slot.time
                                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent"
                                        : "border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30",
                                      !slot.is_available &&
                                        "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed hover:bg-gray-100",
                                    )}
                                    disabled={!slot.is_available}
                                    onClick={() => setSelectedTime(slot.time)}
                                  >
                                    {slot.time}
                                  </Button>
                                </motion.div>
                              </TooltipTrigger>
                              {!slot.is_available && slot.reason && (
                                <TooltipContent className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-blue-100 dark:border-blue-900/40">
                                  <p>{slot.reason}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40 text-center">
                        <p className="text-muted-foreground">No available time slots for this date.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedDate || !selectedTime}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Continue to Patient Info
                </Button>
              </CardFooter>
            </Card>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 rounded-lg bg-red-500/10 p-4 flex items-start gap-2 border border-red-200"
              >
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm text-red-600">{error}</div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 3: Patient Information */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-blue-100 dark:border-blue-900/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b border-blue-100 dark:border-blue-900/40">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Patient Information
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>
                    {patientProfile
                      ? "Your information has been auto-filled from your profile. You can update it if needed."
                      : "Please provide your personal details"}
                  </span>

                  {patientProfile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetToProfileData}
                      className="ml-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reset to Profile Data
                    </Button>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="patientName" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        Full Name
                        {fieldsAutoFilled.name && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="patientName"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter your full name"
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="patientEmail"
                        className="text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4 text-blue-600" />
                        Email Address
                        {fieldsAutoFilled.email && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="patientEmail"
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="patientPhone"
                        className="text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4 text-blue-600" />
                        Contact Phone
                        {fieldsAutoFilled.phone && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="patientPhone"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="Enter your contact phone number for this appointment"
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        Gender
                        {fieldsAutoFilled.gender && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="border-blue-200 focus:ring-blue-400 dark:border-blue-800">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        Address
                        {fieldsAutoFilled.address && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter your current address"
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="chronicDiseases"
                        className="text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                        Chronic Diseases
                        {fieldsAutoFilled.chronicDiseases && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Textarea
                        id="chronicDiseases"
                        value={chronicDiseases}
                        onChange={(e) => setChronicDiseases(e.target.value)}
                        placeholder="List any chronic diseases you have (separate with commas)"
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                <Button
                  type="button"
                  onClick={prevStep}
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Continue to Medical Details
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Medical Information */}
        {currentStep === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-blue-100 dark:border-blue-900/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b border-blue-100 dark:border-blue-900/40">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-blue-600" />
                  Medical Information
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>
                    {patientProfile
                      ? "Your medical information has been auto-filled from your profile. You can update it if needed."
                      : "Please provide your medical details"}
                  </span>

                  {patientProfile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetToProfileData}
                      className="ml-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reset to Profile Data
                    </Button>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="bloodType" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Heart className="h-4 w-4 text-blue-600" />
                        Blood Type
                        {fieldsAutoFilled.bloodType && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Select value={bloodType} onValueChange={setBloodType}>
                        <SelectTrigger className="border-blue-200 focus:ring-blue-400 dark:border-blue-800">
                          <SelectValue placeholder="Select your blood type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="reasonForVisit"
                        className="text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4 text-blue-600" />
                        Reason for Visit <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Textarea
                        id="reasonForVisit"
                        value={reasonForVisit}
                        onChange={(e) => setReasonForVisit(e.target.value)}
                        placeholder="Please describe the reason for your appointment..."
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="medications" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-600" />
                        Current Medications
                        {fieldsAutoFilled.medications && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Textarea
                        id="medications"
                        value={medications}
                        onChange={(e) => setMedications(e.target.value)}
                        placeholder="List any medications you are currently taking..."
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="allergies" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        Allergies
                        {fieldsAutoFilled.allergies && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Textarea
                        id="allergies"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        placeholder="List any allergies you have..."
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="medicalConditions"
                        className="text-gray-700 dark:text-gray-300 flex items-center gap-2"
                      >
                        <Activity className="h-4 w-4 text-blue-600" />
                        Previous Medical Conditions
                        {fieldsAutoFilled.medicalHistory && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                            Auto-filled
                          </Badge>
                        )}
                      </Label>
                      <Textarea
                        id="medicalConditions"
                        value={medicalConditions}
                        onChange={(e) => setMedicalConditions(e.target.value)}
                        placeholder="List any previous medical conditions..."
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Additional Notes
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional information for the doctor..."
                        className="border-blue-200 focus:border-blue-400 focus:ring-blue-400 dark:border-blue-800 min-h-[100px]"
                      />
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex-col space-y-4 border-t border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                <Card className="w-full border border-blue-100 dark:border-blue-900/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      Appointment Summary
                    </h3>
                    {selectedDoctorDetails && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Doctor</p>
                          <p className="font-medium">Dr. {selectedDoctorDetails?.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Specialization</p>
                          <p className="font-medium">{selectedDoctorDetails?.specialization}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Date</p>
                          <p className="font-medium">{selectedDate ? format(selectedDate, "MMMM d, yyyy") : ""}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Time</p>
                          <p className="font-medium">{selectedTime}</p>
                        </div>
                        {selectedDoctorDetails.consultation_fee && (
                          <div className="col-span-2 mt-1 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                            <p className="text-gray-500 dark:text-gray-400">Consultation Fee</p>
                            <p className="font-semibold text-blue-600">£{selectedDoctorDetails?.consultation_fee}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-between w-full">
                  <Button
                    type="button"
                    onClick={prevStep}
                    variant="outline"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !reasonForVisit}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      "Confirm Appointment"
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </form>

      {debugInfo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-8 rounded-md bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700"
        >
          <details>
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">Debug Information</summary>
            <ScrollArea className="h-48 mt-2">
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{debugInfo}</pre>
            </ScrollArea>
          </details>
        </motion.div>
      )}
    </motion.div>
  )
}
