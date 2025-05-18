"use client"

import { useState, useEffect } from "react"
import { ENDPOINTS } from "@/config/api"
import type { User, LoginCredentials, RegisterData, AuthResponse } from "@/types"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Check if user is authenticated on mount - but don't redirect
  useEffect(() => {
    checkAuth()
  }, [])

  // Modified to not redirect, just check auth status
  const checkAuth = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")

      console.log("Checking auth state:", {
        hasToken: !!token,
        hasStoredUser: !!storedUser,
      })

      if (!token || !storedUser) {
        console.log("No token or user found in localStorage")
        setIsAuthenticated(false)
        setUser(null)
        setIsLoading(false)
        return false
      }

      // Try to parse the stored user
      try {
        const parsedUser = JSON.parse(storedUser) as User
        console.log("User found in localStorage:", parsedUser)

        // Trust the local storage data without backend validation
        setUser(parsedUser)
        setIsAuthenticated(true)
        setIsLoading(false)
        return true
      } catch (parseError) {
        console.error("Failed to parse stored user:", parseError)
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        setIsAuthenticated(false)
        setUser(null)
        setIsLoading(false)
        return false
      }
    } catch (error) {
      console.error("Auth check error:", error)
      setIsAuthenticated(false)
      setUser(null)
      setIsLoading(false)
      return false
    }
  }

  // Login function - modified to use direct window location for redirect
  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true)

    try {
      console.log("Logging in with:", { email: credentials.email, password: "***", role: credentials.role })

      // Create the request body
      const requestBody = {
        username: credentials.email, // MongoDB auth uses username for authentication
        email: credentials.email,
        password: credentials.password,
        role: credentials.role || "patient", // Use default role if not provided
      }

      console.log("Sending login request with:", { ...requestBody, password: "***" })
      console.log("Login URL:", ENDPOINTS.login)

      // Use direct fetch for login to bypass any middleware
      const response = await fetch(ENDPOINTS.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        credentials: "include", // Include cookies for cross-origin requests
      })

      console.log("Login response status:", response.status)

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = "Login failed"
        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json()
            console.error("Login error data:", errorData)
            errorMessage = errorData.error || errorData.detail || errorData.message || "Login failed"
          } else {
            // If not JSON, get text
            const errorText = await response.text()
            console.error("Login error text:", errorText)
            errorMessage = "Login failed. Please check your credentials."
          }
        } catch (e) {
          console.error("Could not parse error response:", e)
        }
        throw new Error(errorMessage)
      }

      // Try to parse the response
      try {
        const data = await response.json()
        console.log("Login success, received data:", data)

        // Check if we have the expected data structure
        if (!data.token || !data.user) {
          console.error("Invalid response format:", data)
          throw new Error("Invalid response from server")
        }

        // IMPORTANT: Store authentication data in localStorage BEFORE updating state
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))

        // Add flag to prevent redirect loops
        localStorage.setItem("justLoggedIn", "true")

        // Reset any unauthorized counters
        sessionStorage.removeItem("unauthorizedCount")

        // Set the authentication state
        setUser(data.user)
        setIsAuthenticated(true)

        // Store intended role if provided
        if (credentials.role) {
          localStorage.setItem("intendedRole", credentials.role)
        }

        console.log("Authentication state updated:", {
          user: data.user,
          isAuthenticated: true,
        })

        // Show success message
        toast({
          title: "Success",
          description: `Logged in successfully as ${credentials.role}`,
        })

        // Use direct window.location for more reliable redirect
        if (credentials.role === "admin") {
          window.location.href = "/admin"
        } else if (credentials.role === "doctor") {
          window.location.href = "/doctor-panel"
        } else {
          window.location.href = "/appointments"
        }
      } catch (parseError) {
        console.error("Error parsing login response:", parseError)
        throw new Error("Invalid response format from server")
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Login failed. Please check your credentials.",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function - modified to use direct window location
  const logout = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("token")

      if (token) {
        // Try to call logout endpoint
        try {
          await fetch(ENDPOINTS.logout, {
            method: "POST",
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          })
        } catch (error) {
          console.error("Logout API error:", error)
          // Continue with local logout even if API call fails
        }
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      // Always clear local storage
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      localStorage.removeItem("intendedRole")
      localStorage.removeItem("justLoggedIn")
      sessionStorage.removeItem("unauthorizedCount")

      // Update state
      setUser(null)
      setIsAuthenticated(false)

      // Use direct window.location for more reliable redirect
      window.location.href = "/login"
    }
  }

  // Register function
  const register = async (userData: RegisterData): Promise<void> => {
    setIsLoading(true)

    try {
      console.log("Registering with:", { ...userData, password: "***" })

      // Use direct fetch for registration
      const response = await fetch(ENDPOINTS.patientRegister, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
        credentials: "include",
      })

      console.log("Register response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Registration failed" }))
        console.error("Registration error data:", errorData)
        throw new Error(errorData.error || "Registration failed")
      }

      const data = (await response.json()) as AuthResponse
      console.log("Registration success, received token and user data")

      localStorage.setItem("token", data.token)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("justLoggedIn", "true")

      setUser(data.user)
      setIsAuthenticated(true)

      toast({
        title: "Success",
        description: "Registration successful! Welcome to the Medical App.",
      })

      // Use direct window.location for more reliable redirect
      window.location.href = "/appointments"
    } catch (error) {
      console.error("Registration error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Registration failed. Please try again.",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Function to get the authentication token
  const getToken = (): string | null => {
    return localStorage.getItem("token")
  }

  // Function to check if user has a specific role
  const hasRole = (role: string): boolean => {
    return user?.role === role
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    checkAuth,
    getToken,
    hasRole,
  }
}
