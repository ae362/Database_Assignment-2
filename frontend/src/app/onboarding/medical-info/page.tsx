"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { X, Plus, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { API_BASE_URL } from "@/config/api"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"

export default function MedicalInfoOnboarding() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [patientId, setPatientId] = useState<string | null>(null)

  // Form state
  const [bloodType, setBloodType] = useState("")
  const [allergies, setAllergies] = useState<string[]>([])
  const [newAllergy, setNewAllergy] = useState("")
  const [medications, setMedications] = useState<string[]>([])
  const [newMedication, setNewMedication] = useState("")
  const [medicalHistory, setMedicalHistory] = useState<string[]>([])
  const [newMedicalCondition, setNewMedicalCondition] = useState("")
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([])
  const [newChronicDisease, setNewChronicDisease] = useState("")

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")

    if (!token || !user) {
      router.push("/login")
      return
    }

    // Get patient ID
    const fetchPatientId = async () => {
      try {
        const userData = JSON.parse(user)
        const userId = userData._id || userData.id

        const response = await fetch(`${API_BASE_URL}/api/api/patients?user_id=${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const patients = await response.json()
          if (patients && patients.length > 0) {
            setPatientId(patients[0]._id || patients[0].id)
          } else {
            setError("Patient record not found. Please contact support.")
          }
        } else {
          setError("Failed to fetch patient information")
        }
      } catch (err) {
        console.error("Error fetching patient ID:", err)
        setError("An error occurred while loading your information")
      }
    }

    fetchPatientId()
  }, [router])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!patientId) {
      setError("Patient ID not found. Please try again later.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("Authentication token not found")
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

      // Update patient record
      const response = await fetch(`${API_BASE_URL}/api/api/patients/${patientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(medicalData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to update medical information (${response.status})`)
      }

      setSuccess(true)
      toast({
        title: "Success",
        description: "Your medical information has been saved",
      })

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/appointments")
      }, 2000)
    } catch (err) {
      console.error("Error updating medical information:", err)
      setError(err instanceof Error ? err.message : "Failed to update medical information")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update medical information",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-950 p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-full max-w-md text-center"
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Medical Information Saved!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for providing your medical information. This will help us provide better care during your
              appointments.
            </p>
            <Button
              onClick={() => router.push("/appointments")}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
            >
              Continue to Appointments
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-950 p-4">
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full max-w-3xl">
        <motion.div variants={itemVariants} className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Complete Your Health Profile
          </h1>
          <p className="text-blue-600/70 dark:text-blue-400/70">
            This information helps us provide better care during your appointments
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-blue-200/30 dark:border-blue-700/30 bg-white/80 dark:bg-gray-900/50 backdrop-blur-lg shadow-xl shadow-blue-500/10">
            <CardHeader className="pb-4">
              <CardTitle>Medical Information</CardTitle>
              <CardDescription>
                Please provide your medical information to help us better understand your health needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
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

                    <div className="pt-4 flex justify-end">
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
                        disabled={isLoading}
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                      >
                        {isLoading ? (
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
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
