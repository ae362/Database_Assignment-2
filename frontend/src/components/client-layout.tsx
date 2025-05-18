"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { MainNav } from "@/components/main-nav"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith("/admin")
  const isDoctorRoute = pathname.startsWith("/doctor-panel")
  const isHomePage = pathname === "/"

  // For admin routes, just render the children directly
  if (isAdminRoute) {
    return <>{children}</>
  }

  // For doctor routes, use a specialized layout
  if (isDoctorRoute) {
    return (
      <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
        {/* Doctor sidebar is rendered by the doctor-panel layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto p-6 bg-gray-950">{children}</main>
        </div>
      </div>
    )
  }

  // For the home page, don't add any layout
  if (isHomePage) {
    return <>{children}</>
  }

  // For regular routes, wrap with MainNav
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container mx-auto py-6 px-4">{children}</main>
    </div>
  )
}
