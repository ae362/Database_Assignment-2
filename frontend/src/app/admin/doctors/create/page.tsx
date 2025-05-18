"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Form validation schema
const doctorSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  specialization: z.string().min(2, "Specialization is required"),
  qualification: z.string().min(2, "Qualification is required"),
  experience_years: z.string().min(1, "Years of experience is required"),
  bio: z.string().min(10, "Brief bio is required"),
  consultation_fee: z.string().min(1, "Consultation fee is required"),
  available_days: z.array(z.string()).min(1, "At least one available day is required"),
  emergency_available: z.boolean().default(false),
  daily_patient_limit: z.string().min(1, "Daily patient limit is required"),
  is_available: z.boolean().default(true),
  username: z.string().optional(),
})

type FormData = z.infer<typeof doctorSchema>

// Define a proper type for debug info
interface DebugInfo {
  authInfo?: {
    tokenPreview?: string
    endpoint?: string
    requestMethod?: string
    userRole?: string
    usedUrl?: string
  }
  responseInfo?: {
    status?: number
    statusText?: string
    data?: any
    text?: string
  }
}

const specializations = [
  "General Medicine",
  "Pediatrics",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Neurology",
  "Psychiatry",
  "Gynecology",
  "Ophthalmology",
  "ENT",
  "Other",
]

const weekDays = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
]

export default function CreateDoctorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [selectedDays, setSelectedDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      consultation_fee: "20.00",
      experience_years: "0",
      available_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      emergency_available: false,
      daily_patient_limit: "20",
      is_available: true,
    },
  })

  const formValues = watch()

  useEffect(() => {
    const checkAdminAccess = () => {
      const token = localStorage.getItem("token")
      const user = localStorage.getItem("user")

      if (!token || !user) {
        toast({
          title: "Access Denied",
          description: "You must be logged in to access this page",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      try {
        const userData = JSON.parse(user)
        if (userData.role !== "admin") {
          toast({
            title: "Access Denied",
            description: "Only administrators can create doctor accounts",
            variant: "destructive",
          })
          router.push("/")
        }
      } catch (e) {
        console.error("Error parsing user data:", e)
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        router.push("/login")
      }
    }

    checkAdminAccess()
  }, [router, toast])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    setAuthError(null)
    setDebugInfo(null)

    try {
      // Get the admin token
      const token = localStorage.getItem("token")
      if (!token) {
        setAuthError("No authentication token found. Please log in as admin.")
        throw new Error("No authentication token found. Please log in as admin.")
      }

      // Get API base URL from environment variable or use default
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

      // Prepare the doctor data
      const doctorData = {
        // User account details
        username: data.username || data.email.split("@")[0],
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,

        // Doctor profile details
        name: `${data.first_name} ${data.last_name}`,
        specialization: data.specialization,
        qualification: data.qualification,
        experience_years: Number.parseInt(data.experience_years),
        consultation_fee: Number.parseFloat(data.consultation_fee).toFixed(2),
        available_days: data.available_days,
        bio: data.bio,
        emergency_available: data.emergency_available,
        daily_patient_limit: Number.parseInt(data.daily_patient_limit),
        is_available: data.is_available,
      }

      // Debug info for token
      const newDebugInfo: DebugInfo = {
        authInfo: {
          tokenPreview: token.substring(0, 10) + "...",
          endpoint: `${apiBaseUrl}/api/api/doctors`,
          requestMethod: "POST",
        },
      }

      console.log("Sending doctor creation request with token:", token.substring(0, 10) + "...")
      console.log("Doctor data:", doctorData)

      // Send request to the doctors endpoint
      const response = await fetch(`${apiBaseUrl}/api/api/doctors/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(doctorData),
      })

      // Log response status for debugging
      if (response) {
        newDebugInfo.responseInfo = {
          status: response.status,
          statusText: response.statusText,
        }
      }

      console.log("Server response status:", response.status, response.statusText)

      // Try to parse response as JSON
      let responseData
      try {
        responseData = await response.json()
        if (newDebugInfo.responseInfo) {
          newDebugInfo.responseInfo.data = responseData
        }
        console.log("Server response:", responseData)
      } catch (e) {
        const textResponse = await response.text()
        if (newDebugInfo.responseInfo) {
          newDebugInfo.responseInfo.text = textResponse
        }
        console.log("Server text response:", textResponse)
      }

      setDebugInfo(newDebugInfo)

      if (!response.ok) {
        // Handle specific validation errors
        if (responseData && responseData.errors) {
          const errorMessage = Object.entries(responseData.errors)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n")
          throw new Error(errorMessage)
        }

        // Handle authentication errors
        if (response.status === 401) {
          setAuthError("Authentication failed. Please log out and log in again.")
          throw new Error("Authentication failed. Please log out and log in again.")
        }

        throw new Error(
          responseData?.message || responseData?.error || responseData?.detail || "Failed to create doctor account",
        )
      }

      toast({
        title: "Success",
        description: "Doctor account created successfully",
      })

      router.push("/admin/doctors")
      router.refresh()
    } catch (error) {
      console.error("Error creating doctor:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create doctor account",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Function to handle logout and redirect to login
  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  // Helper function to select all weekdays
  const selectWeekdays = () => {
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    setSelectedDays(weekdays)
    setValue("available_days", weekdays)
  }

  // Helper function to select all days
  const selectAllDays = () => {
    const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    setSelectedDays(allDays)
    setValue("available_days", allDays)
  }

  // Function to toggle a day selection
  const toggleDay = (day: string) => {
    const updatedDays = selectedDays.includes(day) ? selectedDays.filter((d) => d !== day) : [...selectedDays, day]

    setSelectedDays(updatedDays)
    setValue("available_days", updatedDays)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/doctors">
                <ArrowLeft className="h-4 w-4" />
                Back to Doctors
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Create Doctor Account</h1>
          <p className="text-muted-foreground">Add a new doctor to the medical system.</p>
        </div>
      </div>

      {authError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <p>{authError}</p>
            <div className="flex gap-2 mt-2">
              <Button onClick={handleLogout} variant="outline" size="sm">
                Log Out and Log In Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {debugInfo && (
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Technical details for troubleshooting</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Doctor Information</CardTitle>
            <CardDescription>Enter the doctor&apos;s personal and professional details.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input id="first_name" {...register("first_name")} placeholder="John" />
                    {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input id="last_name" {...register("last_name")} placeholder="Doe" />
                    {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="doctor@example.com" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register("phone")} placeholder="+1 (555) 000-0000" />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Select
                    onValueChange={(value) => setValue("specialization", value)}
                    defaultValue={formValues.specialization}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select specialization" />
                    </SelectTrigger>
                    <SelectContent>
                      {specializations.map((spec) => (
                        <SelectItem key={spec} value={spec}>
                          {spec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.specialization && <p className="text-sm text-destructive">{errors.specialization.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input id="qualification" {...register("qualification")} placeholder="MD, MBBS, etc." />
                  {errors.qualification && <p className="text-sm text-destructive">{errors.qualification.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    min="0"
                    {...register("experience_years")}
                    placeholder="5"
                  />
                  {errors.experience_years && (
                    <p className="text-sm text-destructive">{errors.experience_years.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consultation_fee">
                    Consultation Fee (£)
                    <span className="text-sm text-muted-foreground ml-2">Minimum: £20.00</span>
                  </Label>
                  <Input
                    id="consultation_fee"
                    type="number"
                    step="0.01"
                    min="20.00"
                    {...register("consultation_fee")}
                    placeholder="20.00"
                  />
                  {errors.consultation_fee && (
                    <p className="text-sm text-destructive">{errors.consultation_fee.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Available Days</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectWeekdays}>
                      Select Weekdays
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={selectAllDays}>
                      Select All Days
                    </Button>
                  </div>
                  <div className="space-y-2 mt-2 border rounded-md p-3">
                    <div className="grid grid-cols-1 gap-2">
                      {weekDays.map((day) => (
                        <div key={day.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={day.id}
                            checked={selectedDays.includes(day.label)}
                            onChange={() => toggleDay(day.label)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <Label htmlFor={day.id} className="cursor-pointer">
                            {day.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {errors.available_days && <p className="text-sm text-destructive">{errors.available_days.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_patient_limit">Daily Patient Limit</Label>
                  <Input
                    id="daily_patient_limit"
                    type="number"
                    min="1"
                    {...register("daily_patient_limit")}
                    placeholder="20"
                  />
                  {errors.daily_patient_limit && (
                    <p className="text-sm text-destructive">{errors.daily_patient_limit.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="emergency_available"
                      {...register("emergency_available")}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="emergency_available">Available for emergencies</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_available"
                      {...register("is_available")}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="is_available">Currently accepting appointments</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio</Label>
                  <Textarea
                    id="bio"
                    {...register("bio")}
                    placeholder="Brief professional background and expertise..."
                    className="min-h-[100px]"
                  />
                  {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting || !!authError}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Doctor Account"
                  )}
                </Button>
              </form>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Preview of the doctor&apos;s profile information.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">
                    Dr. {formValues.first_name || "First"} {formValues.last_name || "Last"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{formValues.specialization || "Specialization"}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Email:</span> {formValues.email || "email@example.com"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span> {formValues.phone || "Not provided"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Qualification:</span> {formValues.qualification || "Not provided"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Experience:</span>{" "}
                    {formValues.experience_years ? `${formValues.experience_years} years` : "Not provided"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Consultation Fee:</span>{" "}
                    {formValues.consultation_fee ? `£${formValues.consultation_fee}` : "Not provided"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Daily Patient Limit:</span> {formValues.daily_patient_limit || "20"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Emergency Available:</span>{" "}
                    {formValues.emergency_available ? "Yes" : "No"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Accepting Appointments:</span>{" "}
                    {formValues.is_available ? "Yes" : "No"}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Available Days</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedDays.map((day) => (
                      <span
                        key={day}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Professional Bio</h4>
                  <p className="text-sm text-muted-foreground">{formValues.bio || "No bio provided yet..."}</p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
