"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string
  redirectTo?: string
}

export function AuthGuard({ children, requiredRole, redirectTo = "/login" }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth()
      setIsChecking(false)
    }

    verifyAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isChecking && !isLoading) {
      if (!isAuthenticated) {
        router.push(redirectTo)
      } else if (requiredRole && user?.role !== requiredRole) {
        router.push("/unauthorized")
      }
    }
  }, [isAuthenticated, isLoading, isChecking, user, requiredRole, router, redirectTo])

  if (isLoading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null
  }

  return <>{children}</>
}
