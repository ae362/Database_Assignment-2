"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ENDPOINTS } from "@/config/api"
import type { User, LoginCredentials, RegisterData, AuthResponse } from "@/types"
import { fetchApi } from "@/utils/api"
import { useToast } from "@/hooks/use-toast"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  register: (userData: RegisterData) => Promise<void>
  checkAuth: () => Promise<boolean>
  getToken: () => string | null
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  // Check if user is authenticated on mount, but don't redirect
  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log("Initial auth check on mount")
      await checkAuth()
    }

    checkAuthStatus()
  }, [])

  // Update the checkAuth function to skip token validation with backend
  const checkAuth = async (): Promise<boolean> => {
    try {
      console.log("Checking auth state from context...")
      setIsLoading(true)

      const token = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")
      const justLoggedIn = localStorage.getItem("justLoggedIn") === "true"

      console.log("Auth check:", {
        hasToken: !!token,
        hasStoredUser: !!storedUser,
        justLoggedIn,
        currentPath: pathname,
      })

      // If user just logged in, trust the stored data without further checks
      if (justLoggedIn) {
        console.log("User just logged in, accepting stored credentials")

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser)
            setUser(parsedUser)
            setIsAuthenticated(true)
            setIsLoading(false)
            return true
          } catch (error) {
            console.error("Failed to parse stored user data:", error)
          }
        }
      }

      // If no token or user, clear auth state
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

        // Skip token validation with backend for now
        // Just trust the local storage data
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

  // Update the login function to use MongoDB authentication
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

      // Use direct fetch for login
      const response = await fetch(ENDPOINTS.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        credentials: "include", // Include cookies for cross-origin requests
        mode: "cors", // Add CORS mode explicitly
      })

      console.log("Login response status:", response.status)

      if (!response.ok) {
        let errorMessage = "Login failed"
        try {
          const errorData = await response.json()
          console.error("Login error data:", errorData)
          errorMessage = errorData.error || errorData.detail || errorData.message || "Login failed"
        } catch (e) {
          console.error("Could not parse error response:", e)
        }
        throw new Error(errorMessage)
      }

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

      // Force direct navigation instead of using router
      const destination =
        credentials.role === "admin" ? "/admin" : credentials.role === "doctor" ? "/doctor-panel" : "/appointments"

      console.log(`Redirecting to ${destination} using window.location`)
      window.location.href = destination

      toast({
        title: "Success",
        description: `Logged in successfully as ${credentials.role}`,
      })
    } catch (error) {
      console.error("Login error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function with direct navigation
  const logout = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("token")

      if (token) {
        await fetchApi(ENDPOINTS.logout, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // Updated to Bearer for MongoDB
          },
        })
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      localStorage.removeItem("intendedRole")
      localStorage.removeItem("justLoggedIn")
      sessionStorage.removeItem("unauthorizedCount")
      setUser(null)
      setIsAuthenticated(false)

      // Direct navigation instead of router
      window.location.href = "/login"
    }
  }

  // Register function with direct navigation
  const register = async (userData: RegisterData): Promise<void> => {
    setIsLoading(true)

    try {
      console.log("Registering with:", { ...userData, password: "***" })

      const response = await fetchApi(ENDPOINTS.patientRegister, {
        method: "POST",
        body: JSON.stringify(userData),
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

      // Direct navigation instead of router
      window.location.href = "/appointments"

      toast({
        title: "Success",
        description: "Registered successfully",
      })
    } catch (error) {
      console.error("Registration error:", error)
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

  const value = {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
