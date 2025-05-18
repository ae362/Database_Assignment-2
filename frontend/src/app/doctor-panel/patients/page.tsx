"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RequireAuth } from "@/components/auth/require-auth"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth } from "@/utils/api"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Search,
  ArrowLeft,
  Eye,
  Edit,
  Save,
  AlertCircle,
  RefreshCw,
  UserCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Activity,
  Pill,
  AlertTriangle,
  FileText,
  Heart,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

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
  last_visit?: string
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

export default function DoctorPatientsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedNotes, setEditedNotes] = useState<string[]>([])
  const [editedMedicalConditions, setEditedMedicalConditions] = useState<string>("")
  const [editedChronicDiseases, setEditedChronicDiseases] = useState<string>("")
  const [editedMedications, setEditedMedications] = useState<string>("")
  const [editedAllergies, setEditedAllergies] = useState<string>("")

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

        // Now fetch patients who have visited this doctor
        fetchPatients(actualDoctorId)
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

  // Fetch patients who have visited this doctor
  async function fetchPatients(doctorId: string) {
    setIsLoading(true)
    setError(null)
    try {
      console.log("Fetching patients for doctor ID:", doctorId)

      // First, get all appointments for this doctor
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const appointmentsUrl = `${apiBaseUrl}/api/api/appointments/?doctor=${doctorId}`
      console.log("Fetching appointments from:", appointmentsUrl)

      const appointmentsResponse = await fetchWithAuth(appointmentsUrl)

      if (!appointmentsResponse.ok) {
        throw new Error(`Failed to fetch appointments: ${appointmentsResponse.status}`)
      }

      const appointments = await appointmentsResponse.json()
      console.log("Appointments:", appointments)

      // Extract unique patient IDs from appointments
      const patientIds = new Set<string>()
      const patientNames = new Map<string, string>() // Map patient ID to name
      const lastVisits = new Map<string, string>() // Map patient ID to last visit date

      appointments.forEach((apt: Appointment) => {
        let patientId: string | null = null

        // Extract patient ID based on the structure
        if (typeof apt.patient === "string") {
          patientId = apt.patient
        } else if (typeof apt.patient === "object" && apt.patient && apt.patient.id) {
          patientId = apt.patient.id.toString()
        } else if (apt.patient_id) {
          patientId = apt.patient_id.toString()
        }

        if (patientId) {
          patientIds.add(patientId)
          patientNames.set(patientId, apt.patient_name)

          // Track last visit date
          const visitDate = new Date(apt.date)
          const currentLastVisit = lastVisits.get(patientId)
          if (!currentLastVisit || new Date(currentLastVisit) < visitDate) {
            lastVisits.set(patientId, apt.date)
          }
        }
      })

      console.log("Unique patient IDs:", Array.from(patientIds))

      // Fetch details for each patient
      const patientDetailsPromises = Array.from(patientIds).map(async (patientId) => {
        const patientUrl = `${apiBaseUrl}/api/api/patients/${patientId}/`
        console.log("Fetching patient details from:", patientUrl)

        const patientResponse = await fetchWithAuth(patientUrl)

        if (!patientResponse.ok) {
          console.error(`Failed to fetch patient ${patientId}: ${patientResponse.status}`)
          return null
        }

        const patientData = await patientResponse.json()

        // Add last visit date to patient data
        patientData.last_visit = lastVisits.get(patientId) || ""

        return patientData
      })

      const patientDetails = await Promise.all(patientDetailsPromises)
      const validPatients = patientDetails.filter((p): p is Patient => p !== null)

      console.log("Patient details:", validPatients)
      setPatients(validPatients)
      setFilteredPatients(validPatients)
    } catch (error) {
      console.error("Error fetching patients:", error)
      setError(error instanceof Error ? error.message : "Failed to load patients")
      toast({
        title: "Error",
        description: "Failed to load patients. Please try refreshing the page.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPatients(patients)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = patients.filter(
        (patient) =>
          patient.name?.toLowerCase().includes(query) ||
          patient.email?.toLowerCase().includes(query) ||
          patient.phone?.toLowerCase().includes(query),
      )
      setFilteredPatients(filtered)
    }
  }, [searchQuery, patients])

  // View patient details
  async function viewPatientDetails(patient: Patient) {
    setSelectedPatient(patient)
    setIsLoadingDetails(true)
    setEditMode(false)

    // Initialize edited values
    setEditedMedicalConditions(formatArrayOrString(patient.medical_conditions) || "")
    setEditedChronicDiseases(formatArrayOrString(patient.chronic_diseases) || "")
    setEditedMedications(formatArrayOrString(patient.medications) || "")
    setEditedAllergies(formatArrayOrString(patient.allergies) || "")
    setEditedNotes(Array.isArray(patient.medical_history) ? [...patient.medical_history] : [])

    try {
      // Fetch patient's appointments with this doctor
      if (doctorId && patient.id) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const url = `${apiBaseUrl}/api/api/appointments/?doctor=${doctorId}&patient=${patient.id}`
        console.log("Fetching patient appointments from:", url)

        const response = await fetchWithAuth(url)

        if (!response.ok) {
          throw new Error(`Failed to fetch patient appointments: ${response.status}`)
        }

        const appointments = await response.json()
        console.log("Patient appointments:", appointments)
        setPatientAppointments(appointments)
      }
    } catch (error) {
      console.error("Error fetching patient appointments:", error)
      toast({
        title: "Warning",
        description: "Could not load all patient appointment history.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Format array or string for display
  function formatArrayOrString(value: string[] | string | undefined): string {
    if (!value) return ""
    if (Array.isArray(value)) return value.join(", ")
    return value
  }

  // Parse string to array
  function parseStringToArray(value: string): string[] {
    if (!value.trim()) return []
    return value.split(",").map((item) => item.trim())
  }

  // Save patient updates
  async function savePatientUpdates() {
    if (!selectedPatient || !selectedPatient.id) {
      toast({
        title: "Error",
        description: "No patient selected or patient ID missing.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/patients/${selectedPatient.id}/`
      console.log("Updating patient at:", url)

      // Prepare update data
      const updateData = {
        medical_conditions: parseStringToArray(editedMedicalConditions),
        chronic_diseases: parseStringToArray(editedChronicDiseases),
        medications: parseStringToArray(editedMedications),
        allergies: parseStringToArray(editedAllergies),
        medical_history: editedNotes,
      }

      console.log("Update data:", updateData)

      const response = await fetchWithAuth(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update patient: ${response.status} - ${errorText}`)
      }

      const updatedPatient = await response.json()
      console.log("Updated patient:", updatedPatient)

      // Update local state
      setSelectedPatient(updatedPatient)
      setPatients(patients.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)))
      setFilteredPatients(filteredPatients.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)))

      setEditMode(false)
      toast({
        title: "Success",
        description: "Patient information updated successfully.",
      })
    } catch (error) {
      console.error("Error updating patient:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update patient information",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Add new medical note
  function addNewNote() {
    setEditedNotes([...editedNotes, ""])
  }

  // Update a specific note
  function updateNote(index: number, value: string) {
    const newNotes = [...editedNotes]
    newNotes[index] = value
    setEditedNotes(newNotes)
  }

  // Remove a note
  function removeNote(index: number) {
    const newNotes = [...editedNotes]
    newNotes.splice(index, 1)
    setEditedNotes(newNotes)
  }

  return (
    <RequireAuth allowedRoles={["doctor"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            My Patients
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => doctorId && fetchPatients(doctorId)}
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

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              type="search"
              placeholder="Search patients by name, email or phone..."
              className="pl-8 bg-gray-900/50 border-gray-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-gray-100">Patient List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8 text-blue-300/80">
                {searchQuery ? "No patients match your search." : "No patients found."}
              </div>
            ) : (
              <div className="rounded-md overflow-hidden border border-gray-800/50">
                <Table>
                  <TableHeader className="bg-gray-800/70">
                    <TableRow>
                      <TableHead className="text-gray-300">Name</TableHead>
                      <TableHead className="text-gray-300">Contact</TableHead>
                      <TableHead className="text-gray-300">Last Visit</TableHead>
                      <TableHead className="text-gray-300">Medical Conditions</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id} className="hover:bg-gray-800/40 border-b border-gray-800/50">
                        <TableCell className="text-white font-medium">{patient.name}</TableCell>
                        <TableCell className="text-gray-300">
                          <div className="flex flex-col">
                            <span>{patient.email}</span>
                            <span className="text-sm text-gray-400">{patient.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {patient.last_visit ? format(new Date(patient.last_visit), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-300 max-w-[200px] truncate">
                          {formatArrayOrString(patient.medical_conditions) || "None reported"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewPatientDetails(patient)}
                            className="border-blue-700/50 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Button>
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

      {/* Patient Details Dialog */}
      <Dialog open={selectedPatient !== null} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-5xl bg-gray-900/90 backdrop-blur-lg border border-gray-800/50 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl text-blue-300">
              {editMode ? "Edit Patient Information" : "Patient Details"}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {selectedPatient?.name} - {selectedPatient?.gender || "Gender not specified"}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-800/70">
                <TabsTrigger value="info" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">
                  Patient Info
                </TabsTrigger>
                <TabsTrigger value="medical" className="data-[state=active]:bg-blue-700 data-[state=active]:text-white">
                  Medical History
                </TabsTrigger>
                <TabsTrigger
                  value="appointments"
                  className="data-[state=active]:bg-blue-700 data-[state=active]:text-white"
                >
                  Appointments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 p-1">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Full Name</h3>
                        </div>
                        <p className="text-sm text-white mt-1">{selectedPatient?.name || "Not provided"}</p>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Email</h3>
                        </div>
                        <p className="text-sm text-white mt-1">{selectedPatient?.email || "Not provided"}</p>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Phone</h3>
                        </div>
                        <p className="text-sm text-white mt-1">{selectedPatient?.phone || "Not provided"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Last Visit</h3>
                        </div>
                        <p className="text-sm text-white mt-1">
                          {selectedPatient?.last_visit
                            ? format(new Date(selectedPatient.last_visit), "MMMM d, yyyy")
                            : "No visits recorded"}
                        </p>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Address</h3>
                        </div>
                        <p className="text-sm text-white mt-1">{selectedPatient?.address || "Not provided"}</p>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-blue-400" />
                          <h3 className="text-sm font-medium text-blue-300">Blood Type</h3>
                        </div>
                        <p className="text-sm text-white mt-1">
                          {selectedPatient?.blood_type ||
                            (selectedPatient?.medical_info?.blood_type
                              ? selectedPatient.medical_info.blood_type
                              : "Not provided")}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="medical" className="mt-4">
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 p-1">
                    {!editMode ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Medical Conditions</h3>
                            </div>
                            <p className="text-sm text-white mt-1">
                              {formatArrayOrString(selectedPatient?.medical_conditions) || "None reported"}
                            </p>
                          </div>

                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Chronic Diseases</h3>
                            </div>
                            <p className="text-sm text-white mt-1">
                              {formatArrayOrString(selectedPatient?.chronic_diseases) || "None reported"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Current Medications</h3>
                            </div>
                            <p className="text-sm text-white mt-1">
                              {formatArrayOrString(selectedPatient?.medications) || "None reported"}
                            </p>
                          </div>

                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Allergies</h3>
                            </div>
                            <p className="text-sm text-white mt-1">
                              {formatArrayOrString(selectedPatient?.allergies) || "None reported"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-400" />
                            <h3 className="text-sm font-medium text-blue-300">Medical Notes</h3>
                          </div>
                          {selectedPatient?.medical_history && selectedPatient.medical_history.length > 0 ? (
                            <div className="space-y-2 mt-2">
                              {Array.isArray(selectedPatient.medical_history) &&
                                selectedPatient.medical_history.map((note, index) => (
                                  <div key={index} className="bg-gray-800/70 p-2 rounded text-sm text-white">
                                    {note}
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm text-white mt-1">No medical notes recorded</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Medical Conditions</h3>
                            </div>
                            <Textarea
                              value={editedMedicalConditions}
                              onChange={(e) => setEditedMedicalConditions(e.target.value)}
                              placeholder="Enter medical conditions, separated by commas"
                              className="bg-gray-800 border-gray-700 text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">Separate multiple conditions with commas</p>
                          </div>

                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Chronic Diseases</h3>
                            </div>
                            <Textarea
                              value={editedChronicDiseases}
                              onChange={(e) => setEditedChronicDiseases(e.target.value)}
                              placeholder="Enter chronic diseases, separated by commas"
                              className="bg-gray-800 border-gray-700 text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">Separate multiple diseases with commas</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Pill className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Current Medications</h3>
                            </div>
                            <Textarea
                              value={editedMedications}
                              onChange={(e) => setEditedMedications(e.target.value)}
                              placeholder="Enter medications, separated by commas"
                              className="bg-gray-800 border-gray-700 text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">Separate multiple medications with commas</p>
                          </div>

                          <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Allergies</h3>
                            </div>
                            <Textarea
                              value={editedAllergies}
                              onChange={(e) => setEditedAllergies(e.target.value)}
                              placeholder="Enter allergies, separated by commas"
                              className="bg-gray-800 border-gray-700 text-white"
                            />
                            <p className="text-xs text-gray-400 mt-1">Separate multiple allergies with commas</p>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">Medical Notes</h3>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addNewNote}
                              className="border-blue-700/50 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300"
                            >
                              Add Note
                            </Button>
                          </div>

                          {editedNotes.length > 0 ? (
                            <div className="space-y-3 mt-2">
                              {editedNotes.map((note, index) => (
                                <div key={index} className="flex gap-2">
                                  <Textarea
                                    value={note}
                                    onChange={(e) => updateNote(index, e.target.value)}
                                    placeholder="Enter medical note"
                                    className="bg-gray-800 border-gray-700 text-white flex-1"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeNote(index)}
                                    className="h-10"
                                  >
                                    &times;
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 mt-1">
                              No medical notes. Click "Add Note" to create one.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="appointments" className="mt-4">
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-4 p-1">
                    {patientAppointments.length > 0 ? (
                      patientAppointments.map((appointment) => (
                        <div key={appointment.id} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-400" />
                              <h3 className="text-sm font-medium text-blue-300">
                                {format(new Date(appointment.date), "MMMM d, yyyy")} at{" "}
                                {format(new Date(appointment.date), "h:mm a")}
                              </h3>
                            </div>
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
                          </div>
                          <div className="mt-2">
                            <h4 className="text-xs font-medium text-blue-300/80">Reason for Visit</h4>
                            <p className="text-sm text-white">{appointment.reason_for_visit || "No reason provided"}</p>
                          </div>
                          {appointment.notes && (
                            <div className="mt-2">
                              <h4 className="text-xs font-medium text-blue-300/80">Notes</h4>
                              <p className="text-sm text-white">{appointment.notes}</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">No appointment history found</div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            {!editMode ? (
              <Button
                onClick={() => setEditMode(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Medical Info
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setEditMode(false)}
                  variant="outline"
                  className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={savePatientUpdates}
                  disabled={isUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            )}
            <Button onClick={() => setSelectedPatient(null)} className="bg-gray-700 hover:bg-gray-600 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireAuth>
  )
}
