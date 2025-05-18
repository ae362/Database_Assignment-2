"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"

interface RequireAdminProps {
  children: ReactNode
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const checkAdminAccess = () => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push("/login")
          return
        }

        const storedUser = localStorage.getItem("user")
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          if (userData.role !== "admin") {
            toast({
              title: "Access Denied",
              description: "You do not have permission to access this page.",
              variant: "destructive",
            })
            router.push("/appointments")
          }
        } else {
          router.push("/login")
        }
      }
    }

    checkAdminAccess()
  }, [isAuthenticated, isLoading, router, toast])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated || (user && user.role !== "admin")) {
    return null
  }

  return <>{children}</>
}

