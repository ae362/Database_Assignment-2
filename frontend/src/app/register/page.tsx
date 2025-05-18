"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, User, Phone, Calendar, MapPin, Activity, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { API_BASE_URL } from "@/config/api"
import { motion } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [birthday, setBirthday] = useState("")
  const [gender, setGender] = useState("")
  const [address, setAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    title: string
    message: string
    type: "success" | "error" | "info"
  } | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setDebugInfo(null)

    try {
      // Format request data for MongoDB
      const requestData = {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        username: email.split("@")[0], // Generate username from email
        role: "patient", // Explicitly set role as patient
        phone: phone || undefined,
        birthday: birthday || undefined,
        gender: gender || undefined,
        address: address || undefined,
      }

      console.log("Sending registration data:", { ...requestData, password: "***" })

      // MongoDB registration endpoint with double /api/api/ prefix
      const registrationEndpoint = `${API_BASE_URL}/api/api/register/patient/`

      console.log("Using MongoDB registration endpoint:", registrationEndpoint)

      // Collect debug info
      let debugLog = "Registration attempt debug log:\n"
      debugLog += `MongoDB registration endpoint: ${registrationEndpoint}\n`
      debugLog += `Request data: ${JSON.stringify({ ...requestData, password: "***" })}\n\n`

      // Make the registration request
      const response = await fetch(registrationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        credentials: "include", // Include cookies for cross-origin requests
      })

      debugLog += `Response status: ${response.status} ${response.statusText}\n`
      console.log("Registration response status:", response.status)

      if (!response.ok) {
        let errorMessage = "Registration failed"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json()
            console.error("Registration error data:", errorData)
            errorMessage = errorData.error || errorData.message || "Registration failed"
            debugLog += `Error data: ${JSON.stringify(errorData)}\n`
          } else {
            const errorText = await response.text()
            console.error("Registration error text:", errorText)
            debugLog += `Error text: ${errorText}\n`
          }
        } catch (e) {
          console.error("Could not parse error response:", e)
          debugLog += `Error parsing response: ${e instanceof Error ? e.message : String(e)}\n`
        }

        // Set debug info for display
        setDebugInfo(debugLog)
        throw new Error(errorMessage)
      }

      // Try to parse the response
      try {
        const data = await response.json()
        console.log("Registration success, received data:", data)
        debugLog += `Success data: ${JSON.stringify(data)}\n`

        // Store authentication data
        if (data.token && data.user) {
          // Log the token for debugging (first 10 chars only for security)
          console.log(`Received token: ${data.token.substring(0, 10)}...`)

          localStorage.setItem("token", data.token)
          localStorage.setItem("user", JSON.stringify(data.user))
          localStorage.setItem("justLoggedIn", "true")

          // Add this code to create a patient record
          try {
            console.log("Creating patient record for user:", data.user._id || data.user.id)

            // Create patient record using the token we just received
            const patientData = {
              name: `${firstName} ${lastName}`.trim(),
              email: email,
              phone: phone || "",
              user_id: data.user._id || data.user.id,
              date_of_birth: birthday || "",
              gender: gender || "",
              address: address || "",
              // Initialize empty arrays for MongoDB best practices
              allergies: [],
              medications: [],
              medical_history: [],
              chronic_diseases: [],
              medical_info: {
                blood_type: "",
              },
            }

            // Use the token we just received to authenticate this request
            const patientResponse = await fetch(`${API_BASE_URL}/api/api/patients/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${data.token}`,
              },
              body: JSON.stringify(patientData),
              credentials: "include",
            })

            if (!patientResponse.ok) {
              console.error("Failed to create patient record:", await patientResponse.text())
              debugLog += "Warning: User created but patient record creation failed\n"
            } else {
              const patientResult = await patientResponse.json()
              console.log("Patient record created:", patientResult)
              debugLog += `Patient record created: ${JSON.stringify(patientResult)}\n`
            }
          } catch (patientError) {
            console.error("Error creating patient record:", patientError)
            debugLog += `Error creating patient record: ${patientError instanceof Error ? patientError.message : String(patientError)}\n`
            // We don't throw here because we still want to proceed with login even if patient record creation fails
          }

          setNotification({
            title: "Success",
            message: "Registered successfully",
            type: "success",
          })

          // Redirect to medical info onboarding page
          setTimeout(() => {
            window.location.href = "/appointments"
          }, 1500)
        } else {
          debugLog += "Missing token or user data in response\n"
          throw new Error("Invalid response from server")
        }
      } catch (parseError) {
        console.error("Error parsing response:", parseError)
        debugLog += `Error parsing success response: ${parseError instanceof Error ? parseError.message : String(parseError)}\n`

        // Set debug info for display
        setDebugInfo(debugLog)
        throw new Error("Invalid response format from server")
      }
    } catch (error) {
      console.error("Registration error:", error)
      setError(error instanceof Error ? error.message : "Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 2) setCurrentStep(currentStep + 1)
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-950 p-4">
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="w-full max-w-md">
        <motion.div variants={itemVariants} className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-2 bg-blue-600/10 backdrop-blur-md rounded-xl mb-4">
            <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
              <Activity className="size-6" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            City Health Clinic
          </h1>
          <p className="text-blue-600/70 dark:text-blue-400/70">Healthcare Management System</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-blue-200/30 dark:border-blue-700/30 bg-white/80 dark:bg-gray-900/50 backdrop-blur-lg shadow-xl shadow-blue-500/10">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Create Your Account
              </CardTitle>
              <CardDescription className="text-blue-600/70 dark:text-blue-400/70">
                Register as a patient to book appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert
                  variant="destructive"
                  className="mb-6 bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/30"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {notification && (
                <Alert
                  className={`mb-6 ${
                    notification.type === "success"
                      ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900/30"
                      : notification.type === "error"
                        ? "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/30"
                        : "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900/30"
                  }`}
                >
                  <AlertDescription>{notification.message}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <Tabs defaultValue="step1" value={`step${currentStep}`} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-blue-100/50 dark:bg-blue-900/20">
                    <TabsTrigger
                      value="step1"
                      onClick={() => setCurrentStep(1)}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Basic Info
                    </TabsTrigger>
                    <TabsTrigger
                      value="step2"
                      onClick={() => setCurrentStep(2)}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Additional Info
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="step1" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-blue-700 dark:text-blue-300">
                        First Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          disabled={isLoading}
                          placeholder="John"
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-blue-700 dark:text-blue-300">
                        Last Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          disabled={isLoading}
                          placeholder="Doe"
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-blue-700 dark:text-blue-300">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          placeholder="your.email@example.com"
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-blue-700 dark:text-blue-300">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          minLength={8}
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                    >
                      Next Step
                    </Button>
                  </TabsContent>

                  <TabsContent value="step2" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-blue-700 dark:text-blue-300">
                        Phone Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={isLoading}
                          placeholder="Optional"
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthday" className="text-blue-700 dark:text-blue-300">
                        Date of Birth
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="birthday"
                          type="date"
                          value={birthday}
                          onChange={(e) => setBirthday(e.target.value)}
                          disabled={isLoading}
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-blue-700 dark:text-blue-300">
                        Gender
                      </Label>
                      <Select value={gender} onValueChange={setGender} disabled={isLoading}>
                        <SelectTrigger className="border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-blue-200 dark:border-blue-800">
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-blue-700 dark:text-blue-300">
                        Address
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                        <Input
                          id="address"
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          disabled={isLoading}
                          placeholder="Optional"
                          className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        onClick={prevStep}
                        variant="outline"
                        className="flex-1 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Registering...
                          </>
                        ) : (
                          "Register"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-0">
              <div className="text-center w-full">
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    Login here
                  </Link>
                </p>
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

              <div className="text-center w-full">
                <Link href="/api-debug" className="text-xs text-blue-600/50 dark:text-blue-400/50 hover:underline">
                  Debug API Endpoints
                </Link>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
