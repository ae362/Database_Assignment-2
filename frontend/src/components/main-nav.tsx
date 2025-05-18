"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Settings, User, LogOut, Stethoscope, UserCog, UserCheck } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    roles: ["admin", "doctor"],
  },
  {
    name: "Appointments",
    href: "/appointments",
    roles: ["admin", "doctor", "patient"],
  },
  {
    name: "Doctors",
    href: "/doctors",
    roles: ["admin"],
  },
]

interface UserData {
  id: number | string // Updated to accept both number and string
  username: string
  email: string
  first_name: string
  last_name: string
  avatar?: string
  role?: string
}

// Function to generate a consistent color based on name
const getAvatarColor = (name: string) => {
  const colors = [
    "from-blue-500 to-cyan-400", // Doctor
    "from-emerald-500 to-teal-400", // Patient
    "from-violet-500 to-purple-400", // Admin
    "from-rose-500 to-pink-400", // Default
  ]

  if (!name) return colors[3]

  // Assign colors based on role if available
  if (name.toLowerCase().includes("doctor")) return colors[0]
  if (name.toLowerCase().includes("patient")) return colors[1]
  if (name.toLowerCase().includes("admin")) return colors[2]

  // Otherwise use hash of name to pick a consistent color
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

// Function to get role-specific icon
const getRoleIcon = (role?: string) => {
  switch (role?.toLowerCase()) {
    case "doctor":
      return <Stethoscope className="h-4 w-4" />
    case "admin":
      return <UserCog className="h-4 w-4" />
    case "patient":
      return <UserCheck className="h-4 w-4" />
    default:
      return <User className="h-4 w-4" />
  }
}

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  // Handle scroll effect for transparent to solid background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Update the useEffect to be more robust in checking auth status
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const storedUser = localStorage.getItem("user")
        const token = localStorage.getItem("token")

        console.log("MainNav checking auth status:", {
          hasStoredUser: !!storedUser,
          hasToken: !!token,
        })

        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser)
          // Ensure role is set
          if (!parsedUser.role) {
            parsedUser.role = "patient"
            localStorage.setItem("user", JSON.stringify(parsedUser))
          }
          setUserData(parsedUser)
        } else {
          console.log("No valid auth data found in localStorage")
          setUserData(null)
        }
      } catch (error) {
        console.error("Error checking auth status:", error)
        // Clear invalid data
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        setUserData(null)
      }
    }

    checkAuthStatus()

    // Listen for storage changes
    window.addEventListener("storage", checkAuthStatus)
    return () => window.removeEventListener("storage", checkAuthStatus)
  }, [])

  // Update userData when auth state changes
  useEffect(() => {
    if (user) {
      // Convert user to UserData format, ensuring id type compatibility
      const convertedUser: UserData = {
        ...user,
        id: user.id, // This will work with either string or number
      }
      setUserData(convertedUser)
    } else if (!isLoading && !isAuthenticated) {
      setUserData(null)
    }
  }, [user, isLoading, isAuthenticated])

  const getInitials = (user: UserData) => {
    return (
      `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      "U"
    )
  }

  // Filter navigation items based on user role
  const authorizedNavItems = navigation.filter((item) => {
    if (!isAuthenticated || !userData?.role) return false
    return item.roles.includes(userData.role)
  })

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/95 backdrop-blur-sm shadow-sm dark:bg-gray-900/95" : "bg-transparent"}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link
              href={isAuthenticated ? (userData?.role === "patient" ? "/appointments" : "/") : "/"}
              className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent"
            >
             City Health Clinic
            </Link>
            {isAuthenticated && !isLoading && (
              <div className="ml-10 hidden md:flex items-center space-x-1">
                {authorizedNavItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? "bg-purple-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && userData ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden">
                    <Avatar className="h-10 w-10 bg-gradient-to-br border-2 border-white shadow-sm dark:border-gray-800">
                      <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(userData.role || "")}`}>
                        {getInitials(userData)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {`${userData.first_name} ${userData.last_name}`}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{userData.email}</p>
                      <div className="flex items-center text-xs leading-none text-muted-foreground mt-1">
                        {getRoleIcon(userData.role)}
                        <span className="ml-1 capitalize">{userData.role || "patient"}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 focus:text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              !isLoading && (
                <>
                  <Link href="/login" passHref>
                    <Button
                      variant="ghost"
                      className="rounded-full hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/register" passHref>
                    <Button className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-0 text-white shadow-md hover:shadow-lg transition-all">
                      Register
                    </Button>
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
