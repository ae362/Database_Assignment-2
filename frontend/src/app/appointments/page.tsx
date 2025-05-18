"use client"

import type React from "react"

import { Suspense, useEffect, useState } from "react"
import { AppointmentList } from "./appointment-list"
import { Loading } from "@/components/loading"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Calendar, X, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { API_BASE_URL } from "@/config/api"

export default function AppointmentsPage() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Medical form state
  const [showMedicalForm, setShowMedicalForm] = useState(true) // Default to showing the form
  const [isMedicalFormLoading, setIsMedicalFormLoading] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  // Form fields
  const [bloodType, setBloodType] = useState("")
  const [allergies, setAllergies] = useState<string[]>([])
  const [newAllergy, setNewAllergy] = useState("")
  const [medications, setMedications] = useState<string[]>([])
  const [newMedication, setNewMedication] = useState("")
  const [medicalHistory, setMedicalHistory] = useState<string[]>([])
  const [newMedicalCondition, setNewMedicalCondition] = useState("")
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([])
  const [newChronicDisease, setNewChronicDisease] = useState("")

  // Add a debug effect to log API configuration
  useEffect(() => {
    console.log("API_BASE_URL:", API_BASE_URL)
  }, [])

  useEffect(() => {
    // Check if we have a token and user in localStorage
    const token = localStorage.getItem("token")
    const userStr = localStorage.getItem("user")

    // If we have both, we can consider the user authenticated without validation
    const hasLocalAuth = !!token && !!userStr

    // Only redirect if we don't have local auth data and auth check is complete
    if (!isLoading && !isAuthenticated && !hasLocalAuth) {
      console.log("Not authenticated, redirecting from appointments page")
      router.push("/login")
      return
    }

    // Check if patient has medical information
    const checkMedicalInfo = async () => {
      try {
        if (!token || !userStr) return

        let userData
        try {
          userData = JSON.parse(userStr)
        } catch (e) {
          console.error("Error parsing user data:", e)
          return
        }

        const userId = userData._id || userData.id
        console.log("Checking medical info for user ID:", userId)

        let debugLog = "Medical info check debug log:\n"
        debugLog += `User ID: ${userId}\n`
        debugLog += `Token (first 10 chars): ${token.substring(0, 10)}...\n\n`
        debugLog += `User data: ${JSON.stringify(userData, null, 2)}\n\n`

        if (!userId) {
          debugLog += "ERROR: User ID is missing in user data\n"
          setFormError("User ID is missing. Please try logging out and logging in again.")
          setDebugInfo(debugLog)
          setIsMedicalFormLoading(false)
          return
        }

        // Get patient record using the ID in the URL
        try {
          // Use the user ID in the URL path
          const patientUrl = `${API_BASE_URL}/api/api/patients/${userId}/`
          debugLog += `Fetching from URL: ${patientUrl}\n`

          console.log("Fetching patient record from:", patientUrl)

          const response = await fetch(patientUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          debugLog += `Response status: ${response.status}\n`

          if (response.ok) {
            const patient = await response.json()
            debugLog += `Patient data received: ${JSON.stringify(patient, null, 2)}\n`

            if (patient) {
              setPatientId(patient._id || patient.id || userId)
              debugLog += `Patient ID: ${patient._id || patient.id || userId}\n`

              // Check if medical information is missing
              const hasMedicalInfo =
                (patient.medical_info && patient.medical_info.blood_type) ||
                (patient.allergies && patient.allergies.length > 0) ||
                (patient.medications && patient.medications.length > 0) ||
                (patient.medical_history && patient.medical_history.length > 0)

              debugLog += `Has medical info: ${hasMedicalInfo}\n`
              debugLog += `Medical info: ${JSON.stringify(patient.medical_info, null, 2)}\n`
              debugLog += `Allergies: ${JSON.stringify(patient.allergies, null, 2)}\n`
              debugLog += `Medications: ${JSON.stringify(patient.medications, null, 2)}\n`
              debugLog += `Medical history: ${JSON.stringify(patient.medical_history, null, 2)}\n`

              // If medical info is missing, show the form
              setShowMedicalForm(!hasMedicalInfo)

              // Pre-populate form with existing data if available
              if (patient.medical_info && patient.medical_info.blood_type) {
                setBloodType(patient.medical_info.blood_type)
              }
              if (patient.allergies && Array.isArray(patient.allergies)) {
                setAllergies(patient.allergies)
              }
              if (patient.medications && Array.isArray(patient.medications)) {
                setMedications(patient.medications)
              }
              if (patient.medical_history && Array.isArray(patient.medical_history)) {
                setMedicalHistory(patient.medical_history)
              }
              if (patient.chronic_diseases && Array.isArray(patient.chronic_diseases)) {
                setChronicDiseases(patient.chronic_diseases)
              }
            }
          } else {
            // If patient record not found, try to create one
            debugLog += `Patient record not found. Attempting to create one.\n`

            // Create a new patient record
            const createUrl = `${API_BASE_URL}/api/api/patients/`
            debugLog += `Creating patient record at: ${createUrl}\n`

            const createData = {
              user_id: userId,
              name:
                `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
                userData.email?.split("@")[0] ||
                "Patient",
              email: userData.email || "",
              phone: userData.phone || "",
              date_of_birth: userData.birthday || userData.date_of_birth || "",
              gender: userData.gender || "",
              address: userData.address || "",
            }

            const createResponse = await fetch(createUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(createData),
            })

            if (createResponse.ok) {
              const newPatient = await createResponse.json()
              debugLog += `New patient record created: ${JSON.stringify(newPatient, null, 2)}\n`
              setPatientId(newPatient._id || newPatient.id || userId)
              setShowMedicalForm(true) // Show form for new patient
            } else {
              const errorText = await createResponse.text()
              debugLog += `Error creating patient record: ${errorText}\n`
              console.error("Error creating patient record:", errorText)
              setShowMedicalForm(true)
            }
          }
        } catch (error) {
          debugLog += `Exception during patient fetch: ${error}\n`
          console.error("Error checking medical info:", error)
          setShowMedicalForm(true)
        }

        setDebugInfo(debugLog)
      } catch (error) {
        console.error("Error in checkMedicalInfo:", error)
        setShowMedicalForm(true)
      } finally {
        setIsMedicalFormLoading(false)
      }
    }

    checkMedicalInfo()
  }, [isAuthenticated, isLoading, router])

  // Medical form functions
  const addItem = (
    item: string,
    items: string[],
    setItems: React.Dispatch<React.SetStateAction<string[]>>,
    setNewItem: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (item.trim() === "") return
    if (items.includes(item.trim())) {
      toast({
        title: "Already added",
        description: "This item is already in the list",
        variant: "destructive",
      })
      return
    }
    setItems([...items, item.trim()])
    setNewItem("")
  }

  const removeItem = (index: number, items: string[], setItems: React.Dispatch<React.SetStateAction<string[]>>) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  const handleMedicalFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsMedicalFormLoading(true)
    setFormError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Get user data for ID
      const userStr = localStorage.getItem("user")
      if (!userStr) {
        throw new Error("User data not found")
      }

      let userData
      try {
        userData = JSON.parse(userStr)
      } catch (e) {
        throw new Error("Invalid user data")
      }

      const userId = userData._id || userData.id
      if (!userId) {
        throw new Error("User ID not found")
      }

      // Format data for MongoDB
      const medicalData = {
        medical_info: {
          blood_type: bloodType,
        },
        allergies: allergies,
        medications: medications,
        medical_history: medicalHistory,
        chronic_diseases: chronicDiseases,
      }

      // Use the patient ID in the URL path
      const updateUrl = `${API_BASE_URL}/api/api/patients/${userId}/`

      console.log("Updating patient medical info:", medicalData)
      console.log("Sending to URL:", updateUrl)

      const response = await fetch(updateUrl, {
        method: "PATCH", // Use PATCH to update existing record
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(medicalData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error response:", errorText)
        throw new Error(`Failed to update medical information: ${response.status} - ${errorText}`)
      }

      setFormSuccess(true)
      toast({
        title: "Success",
        description: "Your medical information has been saved",
      })

      // Hide the form after a short delay
      setTimeout(() => {
        setShowMedicalForm(false)
        setFormSuccess(false)
      }, 2000)
    } catch (err) {
      console.error("Error updating medical information:", err)
      setFormError(err instanceof Error ? err.message : "Failed to update medical information")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update medical information",
        variant: "destructive",
      })
    } finally {
      setIsMedicalFormLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  // Skip the medical form for testing/debugging
  const skipMedicalForm = () => {
    setShowMedicalForm(false)
  }

  // Show loading state while checking authentication
  if (isLoading || isMedicalFormLoading) {
    return <Loading />
  }

  // Try to get user from localStorage as a fallback
  const hasLocalAuth = !!localStorage.getItem("token") && !!localStorage.getItem("user")

  // Don't render anything if not authenticated (by context or localStorage)
  if (!isAuthenticated && !hasLocalAuth) {
    return null
  }

  // If we need to show the medical form
  if (showMedicalForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Complete Your Health Profile
            </h1>
            <p className="text-blue-600/70 dark:text-blue-400/70">
              This information helps us provide better care during your appointments
            </p>
          </div>

          <Card className="border-blue-200/30 dark:border-blue-700/30 bg-white/80 dark:bg-gray-900/50 backdrop-blur-lg shadow-xl shadow-blue-500/10">
            <CardHeader className="pb-4">
              <CardTitle>Medical Information</CardTitle>
              <CardDescription>
                Please provide your medical information to help us better understand your health needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {formError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              {formSuccess && (
                <Alert className="mb-6 bg-green-500/10 text-green-600 border-green-200 dark:border-green-900/30">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>Your medical information has been saved successfully!</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleMedicalFormSubmit}>
                <Tabs defaultValue="step1" value={`step${currentStep}`} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger
                      value="step1"
                      onClick={() => setCurrentStep(1)}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800"
                    >
                      Basic Info
                    </TabsTrigger>
                    <TabsTrigger
                      value="step2"
                      onClick={() => setCurrentStep(2)}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800"
                    >
                      Allergies & Medications
                    </TabsTrigger>
                    <TabsTrigger
                      value="step3"
                      onClick={() => setCurrentStep(3)}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800"
                    >
                      Medical History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="step1" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bloodType">Blood Type</Label>
                      <Select value={bloodType} onValueChange={setBloodType}>
                        <SelectTrigger id="bloodType">
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
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        If you don't know your blood type, select "Unknown"
                      </p>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button type="button" onClick={skipMedicalForm} variant="outline" className="text-gray-500">
                        Skip for Now
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                      >
                        Next Step
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="step2" className="space-y-6">
                    <div className="space-y-4">
                      <Label>Allergies</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={newAllergy}
                          onChange={(e) => setNewAllergy(e.target.value)}
                          placeholder="Add an allergy (e.g., Penicillin)"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() => addItem(newAllergy, allergies, setAllergies, setNewAllergy)}
                          variant="outline"
                          size="icon"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {allergies.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No allergies added</p>
                        )}
                        {allergies.map((allergy, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {allergy}
                            <button
                              type="button"
                              onClick={() => removeItem(index, allergies, setAllergies)}
                              className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Current Medications</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={newMedication}
                          onChange={(e) => setNewMedication(e.target.value)}
                          placeholder="Add a medication (e.g., Aspirin)"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() => addItem(newMedication, medications, setMedications, setNewMedication)}
                          variant="outline"
                          size="icon"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {medications.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No medications added</p>
                        )}
                        {medications.map((medication, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {medication}
                            <button
                              type="button"
                              onClick={() => removeItem(index, medications, setMedications)}
                              className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button type="button" onClick={prevStep} variant="outline">
                        Previous Step
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                      >
                        Next Step
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="step3" className="space-y-6">
                    <div className="space-y-4">
                      <Label>Medical History</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={newMedicalCondition}
                          onChange={(e) => setNewMedicalCondition(e.target.value)}
                          placeholder="Add a medical condition (e.g., Asthma)"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() =>
                            addItem(newMedicalCondition, medicalHistory, setMedicalHistory, setNewMedicalCondition)
                          }
                          variant="outline"
                          size="icon"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {medicalHistory.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No medical conditions added</p>
                        )}
                        {medicalHistory.map((condition, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {condition}
                            <button
                              type="button"
                              onClick={() => removeItem(index, medicalHistory, setMedicalHistory)}
                              className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Chronic Diseases</Label>
                      <div className="flex space-x-2">
                        <Input
                          value={newChronicDisease}
                          onChange={(e) => setNewChronicDisease(e.target.value)}
                          placeholder="Add a chronic disease (e.g., Diabetes)"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() =>
                            addItem(newChronicDisease, chronicDiseases, setChronicDiseases, setNewChronicDisease)
                          }
                          variant="outline"
                          size="icon"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {chronicDiseases.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No chronic diseases added</p>
                        )}
                        {chronicDiseases.map((disease, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {disease}
                            <button
                              type="button"
                              onClick={() => removeItem(index, chronicDiseases, setChronicDiseases)}
                              className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button type="button" onClick={prevStep} variant="outline">
                        Previous Step
                      </Button>
                      <Button
                        type="submit"
                        disabled={isMedicalFormLoading}
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                      >
                        {isMedicalFormLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Medical Information"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-0 border-t border-gray-200 dark:border-gray-800 mt-4 px-6 py-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>
                  Your medical information is kept private and secure. It will only be shared with your healthcare
                  providers.
                </p>
                <p className="mt-2">You can update this information at any time from your profile settings.</p>
              </div>

              {/* Debug info section */}
              {debugInfo && (
                <div className="mt-6 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-md w-full">
                  <p className="text-xs font-medium mb-2 text-blue-700 dark:text-blue-300">Debug Information:</p>
                  <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap text-blue-600 dark:text-blue-400">
                    {debugInfo}
                  </pre>
                </div>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Regular appointments page
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Appointments
          </h1>
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Link href="/appointments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Loading />}>
        <AppointmentList />
      </Suspense>
    </motion.div>
  )
}
