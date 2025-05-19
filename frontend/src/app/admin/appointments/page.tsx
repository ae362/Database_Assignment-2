"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ENDPOINTS, API_BASE_URL } from "@/config/api"
import { fetchWithAuth } from "@/utils/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, CalendarIcon, Clock, AlertCircle } from "lucide-react"
import { RequireAuth } from "@/components/auth/require-auth"

interface Appointment {
  id: number
  patient_name: string
  doctor_name: string
  date: string
  status: "scheduled" | "completed" | "cancelled"
  notes: string
  blood_type?: string
  medications?: string
  allergies?: string
  medical_conditions?: string
  reason_for_visit?: string
  patient_phone?: string
  gender?: string
  address?: string
  chronic_diseases?: string
}

export default function AdminAppointmentsPage() {
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isViewingDetails, setIsViewingDetails] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchAppointments()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = appointments.filter(
        (appointment) =>
          appointment.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          appointment.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredAppointments(filtered)
    } else {
      setFilteredAppointments(appointments)
    }
  }, [searchTerm, appointments])

  // Update the fetchAppointments function to use fetchWithAuth consistently
  async function fetchAppointments() {
    setIsLoading(true)
    try {
      console.log("Fetching all appointments for admin...")

      // Use fetchWithAuth helper instead of direct fetch
      const response = await fetchWithAuth(`${API_BASE_URL}/api/api/appointments/?admin=true`)

      console.log("Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error(`Failed to fetch appointments: ${response.status}`)
      }

      const data = await response.json()
      console.log("Fetched appointments data:", data)

      // Check if data is an array and has items
      if (Array.isArray(data)) {
        console.log(`Found ${data.length} appointments`)

        // Log each appointment for debugging
        data.forEach((apt, index) => {
          console.log(`Appointment ${index + 1}:`, {
            id: apt.id,
            patient: apt.patient_name,
            doctor: apt.doctor_name,
            date: apt.date,
            status: apt.status,
          })
        })

        setAppointments(data)
        setFilteredAppointments(data)
      } else {
        console.error("Unexpected data format:", data)
        throw new Error("Received invalid data format from API")
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
      setError(error instanceof Error ? error.message : "Failed to load appointments")
      toast({
        title: "Error",
        description: "Failed to load appointments. Please check the console for details.",
        variant: "destructive",
      })
      // Set empty arrays to avoid undefined errors
      setAppointments([])
      setFilteredAppointments([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedAppointment || !selectedDate || !selectedTime) return

    setIsSubmitting(true)
    try {
      const response = await fetchWithAuth(`${ENDPOINTS.appointments(selectedAppointment.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: `${format(selectedDate, "yyyy-MM-dd")}T${selectedTime}:00`,
        }),
      })

      if (!response.ok) throw new Error("Failed to reschedule appointment")

      const updatedAppointment = await response.json()
      setAppointments(
        appointments.map((apt) => (apt.id === selectedAppointment.id ? { ...apt, ...updatedAppointment } : apt)),
      )

      setIsRescheduling(false)
      setSelectedAppointment(null)
      setSelectedDate(undefined)
      setSelectedTime("")

      toast({
        title: "Success",
        description: "Appointment rescheduled successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reschedule appointment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async (appointmentId: number) => {
    try {
      const response = await fetchWithAuth(`${ENDPOINTS.appointments(appointmentId)}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to cancel appointment")

      setAppointments(appointments.map((apt) => (apt.id === appointmentId ? { ...apt, status: "cancelled" } : apt)))

      toast({
        title: "Success",
        description: "Appointment cancelled successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel appointment",
        variant: "destructive",
      })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default"
      case "completed":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "default"
    }
  }

  const timeSlots = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
  ]

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold">Appointment Overview</h1>

        <div className="flex items-center justify-between space-x-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                // Force fetch ALL appointments without filtering
                const fetchAllAppointments = async () => {
                  try {
                    const token = localStorage.getItem("token")

                    // Try multiple endpoints to ensure we get all appointments
                    const endpoints = [
                      `${API_BASE_URL}/admin/appointments/`,
                      `${API_BASE_URL}/appointments/?admin=true`,
                      `${API_BASE_URL}/appointments/all/`,
                      `${API_BASE_URL}/appointments/`,
                    ]

                    let allAppointments = []
                    let successfulEndpoint = null

                    for (const endpoint of endpoints) {
                      try {
                        console.log(`Trying endpoint: ${endpoint}`)
                        const response = await fetch(endpoint, {
                          headers: {
                            Authorization: `Token ${token}`,
                            "Content-Type": "application/json",
                          },
                        })

                        if (response.ok) {
                          const data = await response.json()
                          if (Array.isArray(data) && data.length > 0) {
                            allAppointments = data
                            successfulEndpoint = endpoint
                            console.log(`Success with endpoint: ${endpoint}, found ${data.length} appointments`)
                            break
                          }
                        }
                      } catch (err) {
                        console.log(`Failed with endpoint: ${endpoint}`)
                      }
                    }

                    if (allAppointments.length > 0) {
                      console.log(`ALL SYSTEM APPOINTMENTS (from ${successfulEndpoint}):`, allAppointments)
                      setAppointments(allAppointments)
                      setFilteredAppointments(allAppointments)

                      toast({
                        title: "Debug",
                        description: `Loaded ${allAppointments.length} appointments from system`,
                      })
                    } else {
                      throw new Error("Could not find appointments with any endpoint")
                    }
                  } catch (error) {
                    console.error("Error:", error)
                    toast({
                      title: "Error",
                      description: "Failed to load appointments",
                      variant: "destructive",
                    })
                  }
                }

                fetchAllAppointments()
              }}
            >
              Debug: Load All
            </Button>
            <Button variant="outline" onClick={fetchAppointments}>
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center p-4 text-sm rounded-md bg-destructive/15 text-destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No appointments found. Appointments created by patients will appear here.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>{appointment.patient_name}</TableCell>
                      <TableCell>{appointment.doctor_name}</TableCell>
                      <TableCell>{format(new Date(appointment.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(new Date(appointment.date), "h:mm a")}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(appointment.status)}>{appointment.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {appointment.reason_for_visit || appointment.notes || "No notes"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAppointment(appointment)
                              setIsViewingDetails(true)
                            }}
                          >
                            View
                          </Button>
                          {appointment.status === "scheduled" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAppointment(appointment)
                                  setIsRescheduling(true)
                                }}
                              >
                                Reschedule
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to cancel this appointment? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No, keep appointment</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancel(appointment.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, cancel appointment
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Appointment Details Dialog */}
        <Dialog open={isViewingDetails} onOpenChange={(open) => !open && setIsViewingDetails(false)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
              <DialogDescription>
                Appointment #{selectedAppointment?.id} with {selectedAppointment?.doctor_name} on{" "}
                {selectedAppointment && format(new Date(selectedAppointment.date), "MMMM d, yyyy")} at{" "}
                {selectedAppointment && format(new Date(selectedAppointment.date), "h:mm a")}
              </DialogDescription>
            </DialogHeader>

            {selectedAppointment && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 p-1 pr-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium">Patient</h3>
                      <p className="text-sm">{selectedAppointment.patient_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Doctor</h3>
                      <p className="text-sm">{selectedAppointment.doctor_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Status</h3>
                      <Badge
                        variant={
                          selectedAppointment.status === "scheduled"
                            ? "default"
                            : selectedAppointment.status === "completed"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {selectedAppointment.status}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Date & Time</h3>
                      <p className="text-sm">
                        {format(new Date(selectedAppointment.date), "MMMM d, yyyy")} at{" "}
                        {format(new Date(selectedAppointment.date), "h:mm a")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Contact Phone</h3>
                    <p className="text-sm p-3 bg-muted rounded-md">
                      {selectedAppointment.patient_phone || "No phone provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Gender</h3>
                    <p className="text-sm p-3 bg-muted rounded-md">{selectedAppointment.gender || "Not specified"}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Address</h3>
                    <p className="text-sm p-3 bg-muted rounded-md">
                      {selectedAppointment.address || "No address provided"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Reason for Visit</h3>
                    <p className="text-sm p-3 bg-muted rounded-md">
                      {selectedAppointment.reason_for_visit || "No reason provided"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-1">Blood Type</h3>
                      <p className="text-sm p-2 bg-muted rounded-md">
                        {selectedAppointment.blood_type || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">Medical Conditions</h3>
                      <p className="text-sm p-2 bg-muted rounded-md max-h-24 overflow-auto">
                        {selectedAppointment.medical_conditions || "None reported"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Chronic Diseases</h3>
                    <p className="text-sm p-3 bg-muted rounded-md max-h-32 overflow-auto">
                      {selectedAppointment.chronic_diseases || "None reported"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Current Medications</h3>
                    <p className="text-sm p-3 bg-muted rounded-md max-h-32 overflow-auto">
                      {selectedAppointment.medications || "None reported"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Allergies</h3>
                    <p className="text-sm p-3 bg-muted rounded-md max-h-32 overflow-auto">
                      {selectedAppointment.allergies || "None reported"}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-1">Additional Notes</h3>
                    <p className="text-sm p-3 bg-muted rounded-md max-h-32 overflow-auto">
                      {selectedAppointment.notes || "No additional notes"}
                    </p>
                  </div>
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              {selectedAppointment && selectedAppointment.status === "scheduled" && (
                <div className="flex space-x-2 mr-auto">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewingDetails(false)
                      setIsRescheduling(true)
                    }}
                  >
                    Reschedule
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Cancel Appointment</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this appointment? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, keep appointment</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleCancel(selectedAppointment.id)
                            setIsViewingDetails(false)
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Yes, cancel appointment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              <Button onClick={() => setIsViewingDetails(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog
          open={isRescheduling}
          onOpenChange={(open) => {
            if (!open) {
              setIsRescheduling(false)
              setSelectedAppointment(null)
              setSelectedDate(undefined)
              setSelectedTime("")
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reschedule Appointment</DialogTitle>
              <DialogDescription>Select a new date and time for this appointment.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Appointment</Label>
                <p className="text-sm">
                  {selectedAppointment && (
                    <>
                      {format(new Date(selectedAppointment.date), "PPP")} at{" "}
                      {format(new Date(selectedAppointment.date), "h:mm a")}
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label>New Date</Label>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                    className="rounded-md border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>New Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 opacity-50" />
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRescheduling(false)
                  setSelectedAppointment(null)
                  setSelectedDate(undefined)
                  setSelectedTime("")
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleReschedule} disabled={!selectedDate || !selectedTime || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  "Confirm Reschedule"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAuth>
  )
}
