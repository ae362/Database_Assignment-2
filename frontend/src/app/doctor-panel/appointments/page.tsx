"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RequireAuth } from "@/components/auth/require-auth"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth } from "@/utils/api"
import { format, isSameDay, parseISO } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  Calendar,
  Clock,
  ClipboardList,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Eye,
  CheckCircle,
  Info,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Patient {
  id?: string
  _id?: string
  name?: string
  phone?: string
  email?: string
  gender?: string
  address?: string
  blood_type?: string
  medical_conditions?: string[] | string
  chronic_diseases?: string[] | string
  medications?: string[] | string
  allergies?: string[] | string
  user_id?: string
  medical_info?: {
    blood_type?: string
    conditions?: string[] | string
  }
  medical_history?: string[] | string
}

interface Appointment {
  id: number
  patient_name: string
  date: string
  notes: string
  status: string
  reason_for_visit?: string
  doctor?: number | string
  patient?: Patient | string | number
  patient_id?: string | number
}

export default function DoctorAppointmentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState("upcoming")
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [rawPatientData, setRawPatientData] = useState<any>(null)

  const filteredAppointments = appointments.filter((appointment) => {
    console.log(`Filtering appointment: ${appointment.id}, status: ${appointment.status}, tab: ${activeTab}`)

    if (activeTab === "upcoming") {
      return appointment.status === "scheduled"
    } else if (activeTab === "today") {
      try {
        const appointmentDate = parseISO(appointment.date)
        const today = new Date()
        return isSameDay(appointmentDate, today) && appointment.status === "scheduled"
      } catch (error) {
        console.error("Error parsing date:", error, appointment.date)
        return false
      }
    } else if (activeTab === "completed") {
      return appointment.status === "completed"
    } else if (activeTab === "cancelled") {
      return appointment.status === "cancelled"
    }
    return true
  })

  // Update the useEffect to first fetch the doctor's profile to get the actual doctor ID
  useEffect(() => {
    async function fetchDoctorId() {
      try {
        // Get user ID from localStorage
        const userStr = localStorage.getItem("user")
        if (!userStr) {
          throw new Error("No user data found in localStorage")
        }

        const user = JSON.parse(userStr)
        if (!user || !user.id) {
          throw new Error("No user ID found in localStorage")
        }

        const userId = user.id
        console.log("User ID from localStorage:", userId)

        // First, fetch the doctor profile to get the doctor's actual ID
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const profileUrl = `${apiBaseUrl}/api/api/doctors/`
        console.log("Fetching doctors list from:", profileUrl)

        const response = await fetchWithAuth(profileUrl)

        if (!response.ok) {
          throw new Error(`Failed to fetch doctors list: ${response.status}`)
        }

        const doctors = await response.json()
        console.log("Doctors list:", doctors)

        // Find the doctor with matching user_id
        const doctorProfile = doctors.find((doc: any) => doc.user_id === userId)

        if (!doctorProfile) {
          throw new Error("Doctor profile not found for current user")
        }

        console.log("Found doctor profile:", doctorProfile)

        // Use the doctor's actual ID, not the user_id
        const actualDoctorId = doctorProfile.id
        console.log("Using actual doctor ID:", actualDoctorId)

        setDoctorId(actualDoctorId)

        // Now fetch appointments using the actual doctor ID
        fetchAppointments(actualDoctorId)
      } catch (error) {
        console.error("Error getting doctor ID:", error)
        setError(error instanceof Error ? error.message : "Could not determine doctor ID")
        toast({
          title: "Error",
          description: "Could not determine doctor ID. Please try again later.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchDoctorId()
  }, [toast])

  // Fetch doctor appointments
  async function fetchAppointments(id: string) {
    setIsLoading(true)
    setError(null)
    try {
      console.log("Fetching appointments for doctor ID:", id)

      // Try the appointments endpoint with doctor query parameter
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/appointments/?doctor=${id}`
      console.log("Fetching appointments from:", url)

      // Collect debug info
      let debugText = `Appointments request to: ${url}\n`

      const response = await fetchWithAuth(url)
      debugText += `Response status: ${response.status}\n`

      if (!response.ok) {
        const errorText = await response.text()
        debugText += `Error response: ${errorText}\n`
        console.error("Error response:", errorText)
        setDebugInfo(debugText)
        throw new Error(`Failed to fetch appointments: ${response.status}`)
      }

      const data = await response.json()
      debugText += `Response data: ${JSON.stringify(data).substring(0, 200)}...\n`
      console.log("Fetched appointments data:", data)
      setDebugInfo(debugText)

      // Set appointments without any additional filtering
      setAppointments(data)

      // Log each appointment for debugging
      data.forEach((apt: any) => {
        console.log(
          `Appointment: ID=${apt.id}, Patient=${apt.patient_name}, Doctor=${apt.doctor}, Date=${apt.date}, Status=${apt.status}`,
        )
      })
    } catch (error) {
      console.error("Error fetching appointments:", error)
      setError(error instanceof Error ? error.message : "Failed to load appointments")
      toast({
        title: "Error",
        description: "Failed to load appointments. Please try refreshing the page.",
        variant: "destructive",
      })
      // Set empty array to avoid undefined errors
      setAppointments([])
    } finally {
      setIsLoading(false)
    }
  }

  // Extract patient ID from appointment
  function getPatientIdFromAppointment(appointment: Appointment): string | null {
    if (typeof appointment.patient === "string") {
      return appointment.patient
    } else if (typeof appointment.patient === "object" && appointment.patient && appointment.patient.id) {
      return appointment.patient.id.toString()
    } else if (appointment.patient_id) {
      return appointment.patient_id.toString()
    }
    return null
  }

  // Fetch patient data
  async function fetchPatientData(patientId: string): Promise<Patient | null> {
    try {
      console.log(`Fetching patient data for ID: ${patientId}`)

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/patients/${patientId}/`
      console.log("Fetching patient data from:", url)

      const response = await fetchWithAuth(url)
      console.log(`Patient data response status: ${response.status}`)

      if (!response.ok) {
        console.error(`Failed to fetch patient data: ${response.status}`)
        return null
      }

      const patientData = await response.json()
      console.log("Patient data:", patientData)

      // Store the raw patient data for debugging
      setRawPatientData(patientData)

      return patientData
    } catch (error) {
      console.error("Error fetching patient data:", error)
      return null
    }
  }

  // View appointment details - UPDATED to focus on patient data
  async function viewAppointmentDetails(appointment: Appointment) {
    setSelectedAppointment(appointment)
    setSelectedPatient(null)
    setRawPatientData(null)
    setDetailsError(null)
    setIsLoadingDetails(true)

    try {
      console.log("Original appointment data:", appointment)

      // Get patient ID from appointment
      const patientId = getPatientIdFromAppointment(appointment)
      console.log("Extracted patient ID:", patientId)

      if (patientId) {
        // Fetch patient data
        const patientData = await fetchPatientData(patientId)
        console.log("Fetched patient data:", patientData)

        if (patientData) {
          setSelectedPatient(patientData)
        } else {
          console.warn("Could not load patient data for ID:", patientId)
        }
      } else {
        console.warn("No patient ID found for appointment:", appointment.id)
      }
    } catch (error) {
      console.error("Error viewing appointment details:", error)
      setDetailsError("Failed to load complete appointment details.")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Count today's appointments - fixed to use isSameDay for accurate date comparison
  const todayAppointments = appointments.filter((appointment) => {
    try {
      const appointmentDate = parseISO(appointment.date)
      const today = new Date()
      return isSameDay(appointmentDate, today) && appointment.status === "scheduled"
    } catch (error) {
      console.error("Error parsing date:", error)
      return false
    }
  })

  // Get next appointment
  const nextAppointment = appointments
    .filter((appointment) => {
      try {
        const appointmentDate = parseISO(appointment.date)
        const now = new Date()
        return appointmentDate > now && appointment.status === "scheduled"
      } catch (error) {
        console.error("Error parsing date:", error)
        return false
      }
    })
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[0]

  // Mark appointment as completed - UPDATED to use our new API route
  async function markAsCompleted(appointmentId: number) {
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Doctor ID not available. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      console.log(`Marking appointment ${appointmentId} as completed...`)

      // Get the auth token
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Use our custom API route with enhanced error handling
      const response = await fetch("/api/appointments/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          appointmentId,
          status: "completed",
        }),
      })

      console.log(`Response status: ${response.status}`)
      const data = await response.json()
      console.log("Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to update appointment status")
      }

      // Update the appointments array with the new status
      setAppointments(appointments.map((apt) => (apt.id === appointmentId ? { ...apt, status: "completed" } : apt)))

      // If the selected appointment is the one being updated, update it too
      if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, status: "completed" })
      }

      toast({
        title: "Success",
        description: "Appointment marked as completed",
      })

      // Refresh the appointments list to ensure we have the latest data
      fetchAppointments(doctorId)
    } catch (error) {
      console.error("Error updating appointment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update appointment status",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Get field value with proper handling of different data structures
  function getFieldValue(field: string): string {
    // Check if we have raw patient data
    if (rawPatientData) {
      // Handle array fields
      if (field === "medications" && Array.isArray(rawPatientData.medications)) {
        return rawPatientData.medications.join(", ")
      }
      if (field === "allergies" && Array.isArray(rawPatientData.allergies)) {
        return rawPatientData.allergies.join(", ")
      }
      if (field === "chronic_diseases" && Array.isArray(rawPatientData.chronic_diseases)) {
        return rawPatientData.chronic_diseases.join(", ")
      }
      if (field === "medical_history" && Array.isArray(rawPatientData.medical_history)) {
        return rawPatientData.medical_history.join(", ")
      }

      // Handle nested fields
      if (field === "blood_type" && rawPatientData.medical_info && rawPatientData.medical_info.blood_type) {
        return rawPatientData.medical_info.blood_type
      }

      // Handle medical_conditions - check both top level and medical_info
      if (field === "medical_conditions") {
        if (rawPatientData.medical_conditions) {
          return Array.isArray(rawPatientData.medical_conditions)
            ? rawPatientData.medical_conditions.join(", ")
            : rawPatientData.medical_conditions
        }
        if (rawPatientData.medical_info && rawPatientData.medical_info.conditions) {
          return Array.isArray(rawPatientData.medical_info.conditions)
            ? rawPatientData.medical_info.conditions.join(", ")
            : rawPatientData.medical_info.conditions
        }
      }

      // Direct fields
      if (rawPatientData[field] !== undefined && rawPatientData[field] !== null) {
        if (typeof rawPatientData[field] === "object") {
          return JSON.stringify(rawPatientData[field])
        }
        return rawPatientData[field].toString()
      }
    }

    // Check if there's data in the appointment for reason_for_visit
    if (field === "reason_for_visit" && selectedAppointment?.reason_for_visit) {
      return selectedAppointment.reason_for_visit
    }

    // Check if there's data in the appointment for notes
    if (field === "notes" && selectedAppointment?.notes) {
      return selectedAppointment.notes
    }

    // If we have a selected patient
    if (selectedPatient) {
      // Handle array fields
      if (field === "medications" && Array.isArray(selectedPatient.medications)) {
        return selectedPatient.medications.join(", ")
      }
      if (field === "allergies" && Array.isArray(selectedPatient.allergies)) {
        return selectedPatient.allergies.join(", ")
      }
      if (field === "chronic_diseases" && Array.isArray(selectedPatient.chronic_diseases)) {
        return selectedPatient.chronic_diseases.join(", ")
      }
      if (field === "medical_history" && Array.isArray(selectedPatient.medical_history)) {
        return selectedPatient.medical_history.join(", ")
      }

      // Handle nested fields
      if (field === "blood_type" && selectedPatient.medical_info && selectedPatient.medical_info.blood_type) {
        return selectedPatient.medical_info.blood_type
      }

      // Handle medical_conditions - check both top level and medical_info
      if (field === "medical_conditions") {
        if (selectedPatient.medical_conditions) {
          return Array.isArray(selectedPatient.medical_conditions)
            ? selectedPatient.medical_conditions.join(", ")
            : selectedPatient.medical_conditions
        }
        if (selectedPatient.medical_info && selectedPatient.medical_info.conditions) {
          return Array.isArray(selectedPatient.medical_info.conditions)
            ? selectedPatient.medical_info.conditions.join(", ")
            : selectedPatient.medical_info.conditions
        }
      }

      // Direct fields
      if (selectedPatient[field as keyof Patient] !== undefined && selectedPatient[field as keyof Patient] !== null) {
        const value = selectedPatient[field as keyof Patient]
        if (typeof value === "object" && value !== null) {
          return JSON.stringify(value)
        }
        return value?.toString() || ""
      }
    }

    // Field-specific fallbacks
    switch (field) {
      case "blood_type":
        return "Not provided"
      case "medical_conditions":
        return "None reported"
      case "chronic_diseases":
        return "None reported"
      case "medications":
        return "None reported"
      case "allergies":
        return "None reported"
      case "gender":
        return "Not specified"
      case "address":
        return "No address provided"
      case "phone":
        return "No phone provided"
      case "medical_history":
        return "No history reported"
      case "reason_for_visit":
        return "No reason provided"
      case "notes":
        return "No additional notes"
      default:
        return ""
    }
  }

  return (
    <RequireAuth allowedRoles={["doctor"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            My Appointments
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => doctorId && fetchAppointments(doctorId)}
              className="border-blue-700/50 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => router.push("/doctor-panel")}
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <Alert className="bg-blue-900/20 border border-blue-700/30 text-blue-200">
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-medium">Debug Information</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-blue-300/90">{debugInfo}</pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg hover:shadow-blue-900/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-200">Today's Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{todayAppointments.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg hover:shadow-blue-900/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-200">Next Appointment</CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              {nextAppointment ? (
                <>
                  <div className="text-2xl font-bold text-white">
                    {format(parseISO(nextAppointment.date), "h:mm a")}
                  </div>
                  <p className="text-xs text-blue-300/80">{nextAppointment.patient_name}</p>
                </>
              ) : (
                <div className="text-sm text-blue-300/80">No upcoming appointments</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg hover:shadow-blue-900/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-200">Completed Appointments</CardTitle>
              <ClipboardList className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {appointments.filter((apt) => apt.status === "completed").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-100">Appointments</CardTitle>
            <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-800/70">
                <TabsTrigger
                  value="upcoming"
                  className="data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                >
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="today" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                >
                  Completed
                </TabsTrigger>
                <TabsTrigger
                  value="cancelled"
                  className="data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                >
                  Cancelled
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-8 text-blue-300/80">No appointments found.</div>
            ) : (
              <div className="rounded-md overflow-hidden border border-gray-800/50">
                <Table>
                  <TableHeader className="bg-gray-800/70">
                    <TableRow>
                      <TableHead className="text-gray-300">Patient</TableHead>
                      <TableHead className="text-gray-300">Date</TableHead>
                      <TableHead className="text-gray-300">Time</TableHead>
                      <TableHead className="text-gray-300">Reason</TableHead>
                      <TableHead className="text-gray-300">Status</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id} className="hover:bg-gray-800/40 border-b border-gray-800/50">
                        <TableCell className="text-white">{appointment.patient_name}</TableCell>
                        <TableCell className="text-gray-300">
                          {format(parseISO(appointment.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-gray-300">{format(parseISO(appointment.date), "h:mm a")}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-gray-300">
                          {appointment.reason_for_visit || appointment.notes || "No reason provided"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              appointment.status === "scheduled"
                                ? "default"
                                : appointment.status === "completed"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className={
                              appointment.status === "scheduled"
                                ? "bg-blue-600 hover:bg-blue-700"
                                : appointment.status === "completed"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                            }
                          >
                            {appointment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewAppointmentDetails(appointment)}
                              className="border-blue-700/50 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            {appointment.status === "scheduled" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => markAsCompleted(appointment.id)}
                                disabled={isUpdating}
                                className="bg-green-600/80 hover:bg-green-700 text-white flex items-center gap-1"
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Complete
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={selectedAppointment !== null} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="max-w-5xl bg-gray-900/90 backdrop-blur-lg border border-gray-800/50 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-300">Appointment Details</DialogTitle>
            <DialogDescription className="text-gray-300">
              Appointment with {selectedAppointment?.patient_name} on{" "}
              {selectedAppointment && format(parseISO(selectedAppointment.date), "MMMM d, yyyy")} at{" "}
              {selectedAppointment && format(parseISO(selectedAppointment.date), "h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : detailsError ? (
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{detailsError}</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 p-1">
                {/* Debug info for development */}
                {process.env.NODE_ENV === "development" && (
                  <details className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 mb-4">
                    <summary className="text-xs text-blue-300 cursor-pointer">Debug: Data Structure</summary>
                    <div className="mt-2">
                      <h4 className="text-xs text-blue-300">Selected Appointment:</h4>
                      <pre className="text-xs text-gray-400 overflow-auto max-h-32">
                        {JSON.stringify(selectedAppointment, null, 2)}
                      </pre>
                      <h4 className="text-xs text-blue-300 mt-2">Selected Patient:</h4>
                      <pre className="text-xs text-gray-400 overflow-auto max-h-32">
                        {JSON.stringify(selectedPatient, null, 2)}
                      </pre>
                      <h4 className="text-xs text-blue-300 mt-2">Raw Patient Data:</h4>
                      <pre className="text-xs text-gray-400 overflow-auto max-h-32">
                        {JSON.stringify(rawPatientData, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}

                {!selectedPatient && !rawPatientData && (
                  <Alert className="bg-blue-900/20 border border-blue-700/30 text-blue-200 mb-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Limited information available. Some patient details may not be displayed.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Patient</h3>
                    <p className="text-sm text-white">{selectedAppointment?.patient_name || "Unknown"}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Status</h3>
                    <Badge
                      variant={
                        selectedAppointment?.status === "scheduled"
                          ? "default"
                          : selectedAppointment?.status === "completed"
                            ? "secondary"
                            : "destructive"
                      }
                      className={
                        selectedAppointment?.status === "scheduled"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : selectedAppointment?.status === "completed"
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                      }
                    >
                      {selectedAppointment?.status || "Unknown"}
                    </Badge>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Email</h3>
                    <p className="text-sm text-white">{getFieldValue("email")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Contact Phone</h3>
                    <p className="text-sm text-white">{getFieldValue("phone")}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Gender</h3>
                    <p className="text-sm text-white">{getFieldValue("gender")}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Address</h3>
                    <p className="text-sm text-white">{getFieldValue("address")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Blood Type</h3>
                    <p className="text-sm text-white">{getFieldValue("blood_type")}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Medical Conditions</h3>
                    <p className="text-sm text-white max-h-24 overflow-auto custom-scrollbar">
                      {getFieldValue("medical_conditions")}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Reason for Visit</h3>
                    <p className="text-sm text-white">{getFieldValue("reason_for_visit")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Chronic Diseases</h3>
                    <p className="text-sm text-white max-h-32 overflow-auto custom-scrollbar">
                      {getFieldValue("chronic_diseases")}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Current Medications</h3>
                    <p className="text-sm text-white max-h-32 overflow-auto custom-scrollbar">
                      {getFieldValue("medications")}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Allergies</h3>
                    <p className="text-sm text-white max-h-32 overflow-auto custom-scrollbar">
                      {getFieldValue("allergies")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Medical History</h3>
                    <p className="text-sm text-white max-h-32 overflow-auto custom-scrollbar">
                      {getFieldValue("medical_history")}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <h3 className="text-sm font-medium text-blue-300 mb-1">Additional Notes</h3>
                    <p className="text-sm text-white max-h-32 overflow-auto custom-scrollbar">
                      {getFieldValue("notes")}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {selectedAppointment && selectedAppointment.status === "scheduled" && (
              <Button
                variant="secondary"
                onClick={() => {
                  markAsCompleted(selectedAppointment.id)
                  setSelectedAppointment(null)
                }}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Mark as Completed"
                )}
              </Button>
            )}
            <Button onClick={() => setSelectedAppointment(null)} className="bg-gray-700 hover:bg-gray-600 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuth>
  )
}
