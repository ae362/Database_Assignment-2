"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  Pill,
  AlertTriangle,
  FileText,
  Stethoscope,
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { API_BASE_URL } from "@/config/api"
import { fetchWithAuth } from "@/utils/api-helpers"

interface PatientProfile {
  id?: string
  user_id?: string
  name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  address: string
  medical_history: string | string[]
  allergies: string | string[]
  medications: string | string[]
  blood_type: string
  chronic_diseases: string | string[]
  medical_info?: {
    blood_type?: string
  }
}

export default function PatientProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isAuthenticated, isLoading } = useAuth()

  const [profile, setProfile] = useState<PatientProfile>({
    name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    medical_history: "",
    allergies: "",
    medications: "",
    blood_type: "",
    chronic_diseases: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("personal")
  const [needsAdminHelp, setNeedsAdminHelp] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  // Fetch patient profile data
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPatientProfile()
    }
  }, [isAuthenticated, user])

  async function fetchPatientProfile() {
    setIsFetching(true)
    setError(null)
    setNeedsAdminHelp(false)

    try {
      console.log("Fetching patient profile for user:", user?.id)

      if (!user?.id) {
        throw new Error("User ID not found")
      }

      // First check if patient record exists by user_id
      const response = await fetchWithAuth(`${API_BASE_URL}/api/api/patients/?user_id=${user.id}`)

      console.log("Patient lookup response status:", response.status)

      if (!response.ok) {
        // If we get a 403 or 404, the patient record might not exist yet
        if (response.status === 403 || response.status === 404) {
          console.log("No existing patient record found, will need admin to create one")
          // Set profile with user data but no patient-specific data
          setProfile({
            user_id: user.id,
            name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            email: user.email || "",
            phone: user.phone || "",
            date_of_birth: "",
            gender: "",
            address: "",
            medical_history: "",
            allergies: "",
            medications: "",
            blood_type: "",
            chronic_diseases: "",
          })
          setNeedsAdminHelp(true)
          setIsFetching(false)
          return
        }

        throw new Error(`API error: ${response.status}`)
      }

      const patients = await response.json()

      if (patients && patients.length > 0) {
        // Patient record exists
        const patientData = patients[0]
        console.log("Found existing patient record:", patientData)

        // Handle different data formats (string vs array)
        const formatField = (field: string | string[] | undefined): string => {
          if (Array.isArray(field)) {
            return field.join(", ")
          }
          return field || ""
        }

        // Extract blood_type from medical_info if available
        const bloodType = patientData.medical_info?.blood_type || patientData.blood_type || ""

        setProfile({
          id: patientData.id,
          user_id: patientData.user_id || user.id,
          name: patientData.name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: patientData.email || user.email || "",
          phone: patientData.phone || user.phone || "",
          date_of_birth: patientData.date_of_birth || "",
          gender: patientData.gender || "",
          address: patientData.address || "",
          medical_history: formatField(patientData.medical_history),
          allergies: formatField(patientData.allergies),
          medications: formatField(patientData.medications),
          blood_type: bloodType,
          chronic_diseases: formatField(patientData.chronic_diseases),
        })
      } else {
        // No patient record yet, use user data
        console.log("No patient records found, will need admin to create one")
        setProfile({
          user_id: user.id,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email || "",
          phone: user.phone || "",
          date_of_birth: "",
          gender: "",
          address: "",
          medical_history: "",
          allergies: "",
          medications: "",
          blood_type: "",
          chronic_diseases: "",
        })
        setNeedsAdminHelp(true)
      }
    } catch (error) {
      console.error("Error fetching patient profile:", error)
      setError("Failed to load your profile. Please try again later.")
    } finally {
      setIsFetching(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("Submitting patient profile...")

      if (!user?.id) {
        throw new Error("User ID not found")
      }

      // If we don't have a patient ID, we can't update - only admins can create
      if (!profile.id) {
        console.log("No patient ID found - cannot update without admin privileges")
        setError("Your patient profile needs to be created by an administrator first. Please contact support.")
        setNeedsAdminHelp(true)
        setIsSubmitting(false)
        return
      }

      // Format data for the API - convert comma-separated strings to arrays
      const formatForApi = (value: string): string[] => {
        if (!value) return []
        return value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item !== "")
      }

      // Create a properly formatted data object for the API
      const formattedData = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        address: profile.address,
        user_id: user.id,
        // Format string fields as arrays for the API
        medical_history: formatForApi(profile.medical_history as string),
        allergies: formatForApi(profile.allergies as string),
        medications: formatForApi(profile.medications as string),
        chronic_diseases: formatForApi(profile.chronic_diseases as string),
        // Set blood_type in medical_info
        medical_info: {
          blood_type: profile.blood_type,
        },
      }

      console.log("Updating patient profile with ID:", profile.id)
      console.log("Formatted data for API:", JSON.stringify(formattedData, null, 2))

      // Use the fetchWithAuth helper with explicit content type
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Make a direct fetch call with detailed logging
      const url = `${API_BASE_URL}/api/api/patients/${profile.id}/`
      console.log("Sending PATCH request to:", url)

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formattedData),
      })

      console.log("Save response status:", response.status)

      // Log the full response for debugging
      const responseText = await response.text()
      console.log("Response text:", responseText)

      if (!response.ok) {
        let errorMessage = "Failed to update profile"
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.detail || errorData.error || `Failed to update profile (${response.status})`

          // Check if this is a permissions error
          if (response.status === 403 && errorMessage.includes("Admin privileges required")) {
            setNeedsAdminHelp(true)
            errorMessage = "Your patient profile can only be updated by an administrator. Please contact support."
          }
        } catch (e) {
          console.error("Could not parse error response:", e)
        }
        throw new Error(errorMessage)
      }

      // Parse the response JSON
      let updatedProfile
      try {
        updatedProfile = JSON.parse(responseText)
        console.log("Profile updated successfully:", updatedProfile)
      } catch (e) {
        console.error("Error parsing response JSON:", e)
        throw new Error("Invalid response from server")
      }

      // Format the data back for display
      const formatField = (field: string | string[] | undefined): string => {
        if (Array.isArray(field)) {
          return field.join(", ")
        }
        return field || ""
      }

      // Extract blood_type from medical_info if available
      const bloodType = updatedProfile.medical_info?.blood_type || updatedProfile.blood_type || profile.blood_type

      // Update the profile state with the new data
      setProfile({
        ...profile, // Keep existing data as fallback
        id: updatedProfile.id || profile.id,
        user_id: updatedProfile.user_id || profile.user_id,
        name: updatedProfile.name || profile.name,
        email: updatedProfile.email || profile.email,
        phone: updatedProfile.phone || profile.phone,
        date_of_birth: updatedProfile.date_of_birth || profile.date_of_birth,
        gender: updatedProfile.gender || profile.gender,
        address: updatedProfile.address || profile.address,
        medical_history: formatField(updatedProfile.medical_history),
        allergies: formatField(updatedProfile.allergies),
        medications: formatField(updatedProfile.medications),
        blood_type: bloodType,
        chronic_diseases: formatField(updatedProfile.chronic_diseases),
      })

      setSuccess("Your profile has been updated successfully!")

      toast({
        title: "Success",
        description: "Your profile has been updated successfully!",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      setError(error instanceof Error ? error.message : "Failed to update profile")

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof PatientProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear success message when user starts editing
    if (success) {
      setSuccess(null)
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          My Health Profile
        </h1>
        <p className="text-muted-foreground mt-2">
          Keep your health information up to date to help your healthcare providers give you the best care.
        </p>
      </div>

      {needsAdminHelp && (
        <Alert className="mb-6 border-amber-200 text-amber-800 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertTitle>Administrator Assistance Required</AlertTitle>
          <AlertDescription>
            Your patient profile needs to be created by an administrator first. Please contact the clinic staff or
            administrator to set up your patient record. Once created, you'll be able to update your information here.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchPatientProfile} className="ml-4" disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 text-green-800 bg-green-50 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {isFetching ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-blue-600">Loading your profile...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="personal" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-8">
              <TabsTrigger
                value="personal"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/50"
              >
                <User className="h-4 w-4 mr-2" />
                Personal Information
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/50"
              >
                <Phone className="h-4 w-4 mr-2" />
                Contact Details
              </TabsTrigger>
              <TabsTrigger
                value="medical"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/50"
              >
                <Heart className="h-4 w-4 mr-2" />
                Medical Information
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Your basic personal information that helps us identify you.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Your full name"
                      required
                      disabled={needsAdminHelp}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={profile.date_of_birth}
                        onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                        placeholder="YYYY-MM-DD"
                        disabled={needsAdminHelp}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={profile.gender}
                      onValueChange={(value) => handleInputChange("gender", value)}
                      disabled={needsAdminHelp}
                    >
                      <SelectTrigger id="gender">
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
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("contact")}>
                    Next: Contact Details
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || needsAdminHelp}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Phone className="h-5 w-5 mr-2 text-blue-600" />
                    Contact Details
                  </CardTitle>
                  <CardDescription>Your contact information for appointments and notifications.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-blue-600" />
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="your.email@example.com"
                        required
                        disabled={needsAdminHelp}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-blue-600" />
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="Your contact phone number"
                        disabled={needsAdminHelp}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 mt-2.5 text-blue-600" />
                      <Textarea
                        id="address"
                        value={profile.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        placeholder="Your current address"
                        className="min-h-[100px]"
                        disabled={needsAdminHelp}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setActiveTab("personal")}>
                      Previous: Personal Info
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setActiveTab("medical")}>
                      Next: Medical Info
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || needsAdminHelp}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="medical">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Heart className="h-5 w-5 mr-2 text-blue-600" />
                    Medical Information
                  </CardTitle>
                  <CardDescription>
                    Your medical information helps doctors provide better care during appointments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="blood_type">Blood Type</Label>
                    <Select
                      value={profile.blood_type}
                      onValueChange={(value) => handleInputChange("blood_type", value)}
                      disabled={needsAdminHelp}
                    >
                      <SelectTrigger id="blood_type">
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
                    <Label htmlFor="chronic_diseases">Chronic Diseases</Label>
                    <div className="flex items-start">
                      <Stethoscope className="h-4 w-4 mr-2 mt-2.5 text-blue-600" />
                      <Textarea
                        id="chronic_diseases"
                        value={profile.chronic_diseases as string}
                        onChange={(e) => handleInputChange("chronic_diseases", e.target.value)}
                        placeholder="List any chronic diseases you have (e.g., Diabetes, Hypertension)"
                        className="min-h-[80px]"
                        disabled={needsAdminHelp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 mr-2 mt-2.5 text-blue-600" />
                      <Textarea
                        id="allergies"
                        value={profile.allergies as string}
                        onChange={(e) => handleInputChange("allergies", e.target.value)}
                        placeholder="List any allergies you have (e.g., Penicillin, Peanuts)"
                        className="min-h-[80px]"
                        disabled={needsAdminHelp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medications">Current Medications</Label>
                    <div className="flex items-start">
                      <Pill className="h-4 w-4 mr-2 mt-2.5 text-blue-600" />
                      <Textarea
                        id="medications"
                        value={profile.medications as string}
                        onChange={(e) => handleInputChange("medications", e.target.value)}
                        placeholder="List any medications you are currently taking"
                        className="min-h-[80px]"
                        disabled={needsAdminHelp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medical_history">Medical History</Label>
                    <div className="flex items-start">
                      <FileText className="h-4 w-4 mr-2 mt-2.5 text-blue-600" />
                      <Textarea
                        id="medical_history"
                        value={profile.medical_history as string}
                        onChange={(e) => handleInputChange("medical_history", e.target.value)}
                        placeholder="Provide a brief summary of your medical history"
                        className="min-h-[120px]"
                        disabled={needsAdminHelp}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Separate multiple entries with commas</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("contact")}>
                    Previous: Contact Details
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || needsAdminHelp}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      )}

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
        <h3 className="text-sm font-medium flex items-center text-blue-700 dark:text-blue-400">
          <InfoIcon className="h-4 w-4 mr-2" />
          Why we collect this information
        </h3>
        <p className="mt-2 text-sm text-blue-600/80 dark:text-blue-400/80">
          Your health information helps doctors provide better care during appointments. This information will be used
          to auto-fill appointment forms and provide your healthcare providers with important details about your health.
        </p>
      </div>
    </div>
  )
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
