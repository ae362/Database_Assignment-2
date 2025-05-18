"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, UserCircle, Activity } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ENDPOINTS, API_BASE_URL } from "@/config/api"
import { motion } from "framer-motion"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<string>("patient")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    title: string
    message: string
    type: "success" | "error" | "info"
  } | null>(null)

  // Check if we're already authenticated
  useEffect(() => {
    // Clear any "just logged in" flags when the login page loads
    localStorage.removeItem("justLoggedIn")

    // Check if we're already authenticated
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")

    if (token && user) {
      try {
        const userData = JSON.parse(user)
        // If already authenticated, redirect to appropriate page
        if (userData.role === "admin") {
          router.push("/admin")
        } else if (userData.role === "doctor") {
          router.push("/doctor-panel")
        } else {
          router.push("/appointments")
        }
      } catch (e) {
        // If parsing fails, clear invalid data
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      }
    }
  }, [router])

  // Clear any redirect flags when the login page loads
  useEffect(() => {
    sessionStorage.removeItem("isRedirecting")
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    setDebugInfo(null)

    try {
      console.log("Login attempt with:", { email, role })

      // Create the request body for MongoDB authentication
      const requestBody = {
        email: email,
        password: password,
        role: role,
      }

      // Collect debug info
      let debugLog = "Login attempt debug log:\n"
      debugLog += `Endpoint: ${ENDPOINTS.login}\n`
      debugLog += `Request data: ${JSON.stringify({ ...requestBody, password: "***" })}\n\n`

      // MongoDB login endpoint - ensure we're using the double /api/api/ prefix
      const loginEndpoint = `${API_BASE_URL}/api/api/login/`

      debugLog += `Using MongoDB login endpoint: ${loginEndpoint}\n`

      // Direct fetch without any middleware or helper functions
      const response = await fetch(loginEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        credentials: "include", // Include cookies for cross-origin requests
        mode: "cors", // Add CORS mode explicitly
      })

      debugLog += `Response status: ${response.status} ${response.statusText}\n`
      console.log("Login response status:", response.status)

      if (!response.ok) {
        let errorMessage = "Login failed"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json()
            console.error("Login error data:", errorData)
            errorMessage = errorData.error || errorData.detail || errorData.message || "Login failed"
            debugLog += `Error data: ${JSON.stringify(errorData)}\n`
          } else {
            const errorText = await response.text()
            console.error("Login error text:", errorText)
            debugLog += `Error text: ${errorText}\n`
          }
        } catch (e) {
          console.error("Could not parse error response:", e)
          debugLog += `Error parsing response: ${e instanceof Error ? e.message : String(e)}\n`
        }

        setDebugInfo(debugLog)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log("Login success, received data:", data)
      debugLog += `Success data: ${JSON.stringify(data)}\n`

      // Check if we have the expected data structure
      if (!data.token || !data.user) {
        console.error("Invalid response format:", data)
        debugLog += "Missing token or user data in response\n"
        setDebugInfo(debugLog)
        throw new Error("Invalid response from server")
      }

      // Log the token for debugging (first 10 chars only for security)
      console.log(`Received token: ${data.token.substring(0, 10)}...`)

      // Store authentication data
      localStorage.setItem("token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("justLoggedIn", "true")

      // Store intended role if provided
      if (role) {
        localStorage.setItem("intendedRole", role)
      }

      // Reset any unauthorized counters
      sessionStorage.removeItem("unauthorizedCount")

      // Set the authentication state
      console.log("Authentication state updated:", {
        user: data.user,
        isAuthenticated: true,
      })

      setNotification({
        title: "Success",
        message: `Logged in successfully as ${role}`,
        type: "success",
      })

      // Force direct navigation instead of using router
      const destination = role === "admin" ? "/admin" : role === "doctor" ? "/doctor-panel" : "/appointments"

      console.log(`Redirecting to ${destination} using window.location`)

      // Delay redirect to show success message
      setTimeout(() => {
        window.location.href = destination
      }, 1000)
    } catch (error) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "Login failed. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
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
                Welcome Back
              </CardTitle>
              <CardDescription className="text-blue-600/70 dark:text-blue-400/70">
                Enter your credentials to access your account
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

              <form onSubmit={handleLogin} className="space-y-4">
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
                      className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>
                  <div className="text-sm text-right">
                    <Link href="/forgot-password" className="text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-blue-700 dark:text-blue-300">
                    Login As
                  </Label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500/50" />
                    <Select value={role} onValueChange={setRole} disabled={isLoading}>
                      <SelectTrigger className="pl-10 border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-gray-800/50 focus:border-blue-400 focus:ring-blue-400">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-blue-200 dark:border-blue-800">
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-0">
              <div className="text-center w-full">
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
                  Don't have an account?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    Register here
                  </Link>
                </p>
                <p className="mt-2 text-xs text-blue-600/50 dark:text-blue-400/50">
                  <Link href="/forgot-password" className="hover:underline">
                    Forgot your password?
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
                <Link href="/auth-debug" className="text-xs text-blue-600/50 dark:text-blue-400/50 hover:underline">
                  Authentication Debug Tool
                </Link>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
