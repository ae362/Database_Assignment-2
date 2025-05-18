"use client"

import { useEffect, type ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface RequireAuthProps {
  children: ReactNode
  allowedRoles: string[]
  redirectTo?: string
}

export function RequireAuth({ children, allowedRoles, redirectTo = "/appointments" }: RequireAuthProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { toast } = useToast()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      // Don't do anything while still loading
      if (isLoading) {
        console.log("Still loading auth state, waiting...")
        return
      }

      setIsCheckingAuth(true)

      console.log("RequireAuth checking access:", {
        isAuthenticated,
        user,
        allowedRoles,
        currentPath: window.location.pathname,
      })

      // Check if bypass flag is set for debug pages
      const bypassAuth = localStorage.getItem("bypassAuth") === "true"
      if (bypassAuth) {
        console.log("Auth bypass detected, allowing access")
        setIsCheckingAuth(false)
        return
      }

      // First try to get authentication from local storage directly
      const storedToken = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")
      const justLoggedIn = localStorage.getItem("justLoggedIn") === "true"

      // If we just logged in or have both token and user, we consider as authenticated
      if (justLoggedIn || (storedToken && storedUser)) {
        try {
          let userData = user

          // If no user in context but we have in localStorage, parse it
          if (!userData && storedUser) {
            userData = JSON.parse(storedUser)
          }

          // Check role access
          if (userData && allowedRoles.includes(userData.role)) {
            console.log("User has correct role, allowing access")
            setIsCheckingAuth(false)
            return
          }

          // If we have user data but not the right role
          if (userData) {
            console.log("User doesn't have required role:", userData.role, "Allowed roles:", allowedRoles)
            toast({
              title: "Access Denied",
              description: "You do not have permission to access this page.",
              variant: "destructive",
            })
            router.push(redirectTo)
            return
          }
        } catch (error) {
          console.error("Error parsing stored user data:", error)
        }
      }

      // If not authenticated or no user data
      if (!isAuthenticated && !justLoggedIn && (!storedToken || !storedUser)) {
        console.log("Not authenticated, redirecting to login")
        router.push("/login")
      } else {
        // Allow access, we'll check roles from localStorage
        setIsCheckingAuth(false)
      }
    }

    checkAccess()

    // Cleanup just logged in flag after 10 seconds
    const timer = setTimeout(() => {
      localStorage.removeItem("justLoggedIn")
    }, 10000)

    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, router, toast, allowedRoles, redirectTo, user])

  // Show loading state while checking auth or loading
  if (isLoading || isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  // Check for bypass auth flag for debug pages
  if (localStorage.getItem("bypassAuth") === "true") {
    return <>{children}</>
  }

  // Check user role from localStorage directly to avoid race conditions
  const storedUser = localStorage.getItem("user")
  if (!storedUser) {
    return null
  }

  try {
    const userData = JSON.parse(storedUser)
    if (!userData.role || !allowedRoles.includes(userData.role)) {
      return null
    }
  } catch (error) {
    return null
  }

  return <>{children}</>
}
