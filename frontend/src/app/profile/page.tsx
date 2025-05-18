"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Heart, Calendar, Settings, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  // Check if user is authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and health information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Summary Card */}
        <Card className="md:col-span-3">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="h-24 w-24 border-2 border-blue-100">
                <AvatarImage src="/placeholder.svg" alt={user?.first_name} />
                <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                  {user?.first_name?.[0]}
                  {user?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold">
                  {user?.first_name} {user?.last_name}
                </h2>
                <p className="text-muted-foreground">{user?.email}</p>

                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {user?.role || "Patient"}
                  </Badge>
                  {user?.is_active && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Active Account
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <Link href="/profile/patient">
                    <Heart className="h-4 w-4 text-blue-600" />
                    <span>Health Profile</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <Link href="/settings">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <span>Account Settings</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="md:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <QuickLinkCard
              title="Health Profile"
              description="Update your medical information"
              icon={<Heart className="h-5 w-5 text-blue-600" />}
              href="/profile/patient"
            />
            <QuickLinkCard
              title="Appointments"
              description="View and manage your appointments"
              icon={<Calendar className="h-5 w-5 text-blue-600" />}
              href="/appointments"
            />
            <QuickLinkCard
              title="Account Settings"
              description="Update your account preferences"
              icon={<Settings className="h-5 w-5 text-blue-600" />}
              href="/settings"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface QuickLinkCardProps {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}

function QuickLinkCard({ title, description, icon, href }: QuickLinkCardProps) {
  return (
    <Card className="hover:border-blue-300 hover:shadow-md transition-all duration-200">
      <Link href={href} className="block h-full">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="rounded-full bg-blue-50 p-3">{icon}</div>
          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode
  className?: string
  variant?: "default" | "outline"
}) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
