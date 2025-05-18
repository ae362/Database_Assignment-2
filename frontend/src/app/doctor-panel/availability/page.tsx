"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { fetchWithAuth } from "@/utils/api"
import { format } from "date-fns"
import { Loader2, AlertCircle, RefreshCw, ArrowLeft, Clock, CalendarDays, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

interface TimeSlot {
  start_time: string
  end_time: string
  is_available: boolean
}

interface DayAvailability {
  id?: number
  day_of_week: number
  day_name: string
  start_time: string
  end_time: string
  is_available: boolean
}

interface Exception {
  id?: number
  date: string
  is_available: boolean
  reason: string
}

interface DoctorAvailabilityData {
  doctor_id: string
  doctor_name: string
  available_days: string[] | string
  day_specific_data?: Record<string, { start_time: string; end_time: string }>
  exceptions: Exception[]
  appointments: any[]
  emergency_available?: boolean
  daily_patient_limit?: number
  is_available?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
]

const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9
  const minute = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minute}`
})

export default function DoctorAvailabilityPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [availabilities, setAvailabilities] = useState<DayAvailability[]>(
    DAYS_OF_WEEK.map((day) => ({
      day_of_week: day.value,
      day_name: day.label,
      start_time: "09:00",
      end_time: "17:00",
      is_available: false,
    })),
  )
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [exceptionReason, setExceptionReason] = useState("")
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [originalAvailabilityData, setOriginalAvailabilityData] = useState<DoctorAvailabilityData | null>(null)

  // Get the doctor ID from localStorage
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

        // Now fetch availability using the actual doctor ID
        fetchAvailabilities(actualDoctorId)
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

  // Fetch doctor availability
  async function fetchAvailabilities(id: string) {
    try {
      console.log("Fetching availabilities for doctor ID:", id)
      setIsLoadingAvailability(true)
      setError(null)

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const availabilityUrl = `${apiBaseUrl}/api/api/doctors/${id}/availability/`
      console.log("Fetching availability from:", availabilityUrl)

      // Collect debug info
      let debugText = `Availability request to: ${availabilityUrl}\n`

      const response = await fetchWithAuth(availabilityUrl)
      debugText += `Response status: ${response.status}\n`

      if (!response.ok) {
        const errorText = await response.text()
        debugText += `Error response: ${errorText}\n`
        console.error("Error response:", errorText)
        setDebugInfo(debugText)
        throw new Error(`Failed to fetch availabilities: ${response.status}`)
      }

      const data = await response.json()
      debugText += `Response data: ${JSON.stringify(data).substring(0, 200)}...\n`
      console.log("Fetched availability data:", data)
      setDebugInfo(debugText)

      // Store the original data for reference
      setOriginalAvailabilityData(data)

      // Process the available_days array
      let availableDays: string[] = []
      if (data.available_days) {
        if (typeof data.available_days === "string") {
          availableDays = data.available_days
            .split(",")
            .map((day: string) => day.trim())
            .filter(Boolean)
        } else if (Array.isArray(data.available_days)) {
          availableDays = data.available_days
        }
      }

      // Get day-specific data if available
      const daySpecificData = data.day_specific_data || {}

      // Create availability data based on available_days
      const updatedAvailabilities = DAYS_OF_WEEK.map((day) => {
        const dayName = day.label
        const isAvailable = availableDays.some((availableDay) => availableDay.toLowerCase() === dayName.toLowerCase())

        // Check if we have specific time data for this day
        const dayData = daySpecificData[dayName.toLowerCase()] || {}

        return {
          day_of_week: day.value,
          day_name: dayName,
          start_time: dayData.start_time || "09:00",
          end_time: dayData.end_time || "17:00",
          is_available: isAvailable,
        }
      })

      setAvailabilities(updatedAvailabilities)

      // Also set exceptions if they exist in the response
      if (data.exceptions && Array.isArray(data.exceptions)) {
        setExceptions(data.exceptions)
      } else {
        // Fetch exceptions separately if not included
        await fetchExceptions(id)
      }
    } catch (error) {
      console.error("Error fetching availabilities:", error)
      setError(error instanceof Error ? error.message : "Failed to load availabilities")
      toast({
        title: "Error",
        description: "Failed to load availabilities",
        variant: "destructive",
      })
    } finally {
      setIsLoadingAvailability(false)
    }
  }

  // Fetch doctor exceptions
  async function fetchExceptions(id: string) {
    try {
      console.log("Fetching exceptions for doctor ID:", id)

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const exceptionsUrl = `${apiBaseUrl}/api/api/doctors/${id}/exceptions/`
      console.log("Fetching exceptions from:", exceptionsUrl)

      const response = await fetchWithAuth(exceptionsUrl)
      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error("Failed to fetch exceptions")
      }

      const data = await response.json()
      console.log("Fetched exceptions data:", data)
      setExceptions(data)
    } catch (error) {
      console.error("Error fetching exceptions:", error)
      toast({
        title: "Error",
        description: "Failed to load availability exceptions",
        variant: "destructive",
      })
    }
  }

  // Update day availability
  const handleDayToggle = async (dayValue: number, checked: boolean) => {
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Doctor ID not available. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    const dayName = DAYS_OF_WEEK.find((d) => d.value === dayValue)?.label || ""

    try {
      console.log("Updating availability for doctor ID:", doctorId)

      // Update local state first for immediate feedback
      setAvailabilities((current) =>
        current.map((a) => (a.day_of_week === dayValue ? { ...a, is_available: checked } : a)),
      )

      // Get the current available days from state
      const updatedAvailableDays = availabilities
        .map((a) => {
          // Include this day if it's being toggled on, or if it's already on and not the one being toggled
          if ((a.day_of_week === dayValue && checked) || (a.day_of_week !== dayValue && a.is_available)) {
            return a.day_name
          }
          return null
        })
        .filter(Boolean) as string[]

      // Create day-specific data with start and end times
      const daySpecificData: Record<string, { start_time: string; end_time: string }> = {}

      availabilities.forEach((a) => {
        if ((a.day_of_week === dayValue && checked) || (a.day_of_week !== dayValue && a.is_available)) {
          const dayName = a.day_name.toLowerCase()
          daySpecificData[dayName] = {
            start_time: a.start_time,
            end_time: a.end_time,
          }
        }
      })

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/doctors/${doctorId}/availability/`
      console.log("Updating availability at:", url)

      // Create the request payload
      const updatedAvailabilityData = {
        available_days: updatedAvailableDays,
        day_specific_data: daySpecificData,
      }

      console.log("Sending data:", updatedAvailabilityData)

      const response = await fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(updatedAvailabilityData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error("Failed to update availability")
      }

      // Refresh the data to ensure we have the latest state
      await fetchAvailabilities(doctorId)

      toast({
        title: "Success",
        description: `${checked ? "Enabled" : "Disabled"} availability for ${dayName}`,
      })
    } catch (error) {
      console.error("Error updating availability:", error)
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      })

      // Revert the local state change on error
      if (doctorId) {
        fetchAvailabilities(doctorId)
      }
    }
  }

  // Update availability time slots
  async function handleAvailabilityUpdate(dayValue: number, updates: Partial<DayAvailability>) {
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Doctor ID not available. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Updating availability time for doctor ID:", doctorId)

      // Update local state first for immediate feedback
      setAvailabilities((current) => current.map((a) => (a.day_of_week === dayValue ? { ...a, ...updates } : a)))

      // Get the current available days
      const availableDays = availabilities
        .filter((a) => a.is_available || (a.day_of_week === dayValue && updates.is_available === true))
        .map((a) => a.day_name)
        .filter(Boolean) as string[]

      // Create day-specific data with start and end times
      const daySpecificData: Record<string, { start_time: string; end_time: string }> = {}

      availabilities.forEach((a) => {
        if ((a.is_available || (a.day_of_week === dayValue && updates.is_available === true)) && a.day_name) {
          const dayName = a.day_name.toLowerCase()
          // Use the updated times for the current day being modified
          if (a.day_of_week === dayValue) {
            daySpecificData[dayName] = {
              start_time: updates.start_time || a.start_time,
              end_time: updates.end_time || a.end_time,
            }
          } else {
            daySpecificData[dayName] = {
              start_time: a.start_time,
              end_time: a.end_time,
            }
          }
        }
      })

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/doctors/${doctorId}/availability/`

      // Create the request payload
      const updatedAvailabilityData = {
        available_days: availableDays,
        day_specific_data: daySpecificData,
      }

      console.log("Updating availability at:", url)
      console.log("Sending data:", updatedAvailabilityData)

      const response = await fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(updatedAvailabilityData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error("Failed to update availability")
      }

      toast({
        title: "Success",
        description: "Availability time updated successfully",
      })
    } catch (error) {
      console.error("Error updating availability time:", error)
      toast({
        title: "Error",
        description: "Failed to update availability time",
        variant: "destructive",
      })

      // Revert the local state change on error
      if (doctorId) {
        fetchAvailabilities(doctorId)
      }
    }
  }

  // Add exception
  async function handleExceptionSubmit() {
    if (!selectedDate) return
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Doctor ID not available. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      console.log("Adding exception for doctor ID:", doctorId)

      const exceptionData = {
        date: format(selectedDate, "yyyy-MM-dd"),
        is_available: false,
        reason: exceptionReason,
      }

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/doctors/${doctorId}/exceptions/`
      console.log("Adding exception at:", url)

      const response = await fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(exceptionData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error("Failed to create exception")
      }

      const data = await response.json()
      setExceptions((current) => [...current, data])
      setSelectedDate(undefined)
      setExceptionReason("")

      toast({
        title: "Success",
        description: "Exception added successfully",
      })
    } catch (error) {
      console.error("Error adding exception:", error)
      toast({
        title: "Error",
        description: "Failed to add exception",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete exception
  async function handleExceptionDelete(id: number) {
    if (!doctorId) {
      toast({
        title: "Error",
        description: "Doctor ID not available. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Deleting exception for doctor ID:", doctorId)

      // Use the correct endpoint structure
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const url = `${apiBaseUrl}/api/api/doctors/${doctorId}/exceptions/${id}/`
      console.log("Deleting exception at:", url)

      const response = await fetchWithAuth(url, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error("Failed to delete exception")
      }

      setExceptions((current) => current.filter((e) => e.id !== id))

      toast({
        title: "Success",
        description: "Exception removed successfully",
      })
    } catch (error) {
      console.error("Error deleting exception:", error)
      toast({
        title: "Error",
        description: "Failed to remove exception",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
          Manage Availability
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => doctorId && fetchAvailabilities(doctorId)}
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
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {debugInfo && (
        <Alert className="bg-blue-900/20 border border-blue-700/30 text-blue-200 mb-6">
          <AlertDescription>
            <details>
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-blue-300/90">{debugInfo}</pre>
            </details>
          </AlertDescription>
        </Alert>
      )}

      {isLoadingAvailability ? (
        <div className="flex items-center justify-center h-64 bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mr-2" />
          <span className="text-blue-300">Loading doctor's schedule...</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg">
            <CardHeader className="border-b border-gray-800/50">
              <CardTitle className="flex items-center gap-2 text-gray-100">
                <Clock className="h-5 w-5 text-blue-400" />
                Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <Label className="text-lg font-medium text-white">{day.label}</Label>
                    <Switch
                      checked={availabilities.find((a) => a.day_of_week === day.value)?.is_available || false}
                      onCheckedChange={(checked) => handleDayToggle(day.value, checked)}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>

                  {availabilities.some((a) => a.day_of_week === day.value && a.is_available) && (
                    <div className="grid grid-cols-2 gap-4 bg-gray-800/20 p-4 rounded-lg border border-gray-700/30">
                      <div className="space-y-2">
                        <Label className="text-blue-300">Start Time</Label>
                        <Select
                          value={availabilities.find((a) => a.day_of_week === day.value)?.start_time}
                          onValueChange={(value) => handleAvailabilityUpdate(day.value, { start_time: value })}
                        >
                          <SelectTrigger className="w-full bg-gray-800/70 border-gray-700/50 text-white">
                            <SelectValue placeholder="Select time">
                              {availabilities.find((a) => a.day_of_week === day.value)?.start_time || "Select time"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            {TIME_SLOTS.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-blue-300">End Time</Label>
                        <Select
                          value={availabilities.find((a) => a.day_of_week === day.value)?.end_time}
                          onValueChange={(value) => handleAvailabilityUpdate(day.value, { end_time: value })}
                        >
                          <SelectTrigger className="w-full bg-gray-800/70 border-gray-700/50 text-white">
                            <SelectValue placeholder="Select time">
                              {availabilities.find((a) => a.day_of_week === day.value)?.end_time || "Select time"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700 text-white">
                            {TIME_SLOTS.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {day.value < DAYS_OF_WEEK.length - 1 && <Separator className="bg-gray-800/50" />}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 backdrop-blur-lg border border-gray-800/50 shadow-lg">
            <CardHeader className="border-b border-gray-800/50">
              <CardTitle className="flex items-center gap-2 text-gray-100">
                <CalendarDays className="h-5 w-5 text-blue-400" />
                Exceptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <Label className="text-blue-300">Select Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border border-gray-700/50 bg-gray-800/30 p-3"
                  classNames={{
                    day_selected: "bg-blue-600 text-white hover:bg-blue-700",
                    day_today: "bg-gray-800 text-blue-300",
                    day: "text-gray-300 hover:bg-gray-800",
                  }}
                />
              </div>

              {selectedDate && (
                <div className="space-y-4 bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
                  <div className="space-y-2">
                    <Label className="text-blue-300">Reason for Exception</Label>
                    <Textarea
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      placeholder="e.g., Out of office, Holiday, etc."
                      className="bg-gray-800/70 border-gray-700/50 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <Button
                    onClick={handleExceptionSubmit}
                    disabled={isLoading || !exceptionReason}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Exception...
                      </>
                    ) : (
                      "Add Exception"
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                <Label className="text-blue-300">Current Exceptions</Label>
                {exceptions.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-auto custom-scrollbar pr-2">
                    {exceptions.map((exception) => (
                      <div
                        key={exception.id}
                        className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/40 p-3 hover:bg-gray-800/60 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-white">{format(new Date(exception.date), "MMMM d, yyyy")}</p>
                          <p className="text-sm text-blue-300/80">{exception.reason}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => exception.id && handleExceptionDelete(exception.id)}
                          className="bg-red-600/80 hover:bg-red-700 text-white flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-800/20 rounded-lg border border-gray-700/30 text-blue-300/80">
                    No exceptions set
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
