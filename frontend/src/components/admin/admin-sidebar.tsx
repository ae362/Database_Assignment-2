"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  Users,
  UserPlus,
  LayoutDashboard,
  Calendar,
  Settings,
  ClipboardList,
  UserCog,
  LogOut,
  Moon,
  Sun,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    color: "from-blue-500 to-cyan-400",
  },
  {
    name: "Patient Management",
    href: "/admin/patients",
    icon: Users,
    color: "from-cyan-500 to-teal-400",
  },
  {
    name: "Doctor Management",
    href: "/admin/doctors",
    icon: UserCog,
    color: "from-indigo-500 to-purple-400",
  },
  {
    name: "Create Doctor",
    href: "/admin/doctors/create",
    icon: UserPlus,
    color: "from-emerald-500 to-teal-400",
  },
  {
    name: "Appointments",
    href: "/admin/appointments",
    icon: Calendar,
    color: "from-amber-500 to-orange-400",
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: ClipboardList,
    color: "from-rose-500 to-pink-400",
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    color: "from-violet-500 to-purple-400",
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [adminName, setAdminName] = useState("Admin User")
  const [isHovered, setIsHovered] = useState<string | null>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
    // You could fetch the admin name from localStorage or an API here
    const storedName = localStorage.getItem("userName") || "Admin User"
    setAdminName(storedName)
  }, [])

  const handleLogout = () => {
    // Clear auth tokens
    localStorage.removeItem("token")
    localStorage.removeItem("userName")
    localStorage.removeItem("userRole")

    // Redirect to login page
    window.location.href = "/login"
  }

  // Generate initials for the avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const initials = getInitials(adminName)

  return (
    <Sidebar className="border-r border-blue-400/20 bg-blue-600/40 backdrop-blur-lg z-50 shadow-lg shadow-blue-500/10">
      <SidebarHeader className="border-b border-blue-400/20 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin" className="space-x-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.1,
                  }}
                  className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 text-white"
                >
                  <Activity className="size-4" />
                </motion.div>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.2,
                  }}
                  className="flex flex-col gap-0.5 leading-none"
                >
                  <span className="font-semibold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    City Health Clinic
                  </span>
                  <span className="text-xs text-blue-200">Admin Panel</span>
                </motion.div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigation.map((item, index) => (
            <SidebarMenuItem key={item.name}>
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.1 + index * 0.05,
                }}
                onMouseEnter={() => setIsHovered(item.name)}
                onMouseLeave={() => setIsHovered(null)}
                className="w-full"
              >
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.name}
                  className={
                    pathname === item.href
                      ? `bg-gradient-to-r ${item.color} text-white`
                      : `hover:bg-blue-500/30 ${isHovered === item.name ? "text-white" : "text-blue-50"}`
                  }
                >
                  <Link href={item.href} className="space-x-2 relative overflow-hidden">
                    {isHovered === item.name && pathname !== item.href && (
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-20`}
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                      />
                    )}
                    <item.icon
                      className={`size-4 ${
                        pathname === item.href ? "text-white" : isHovered === item.name ? "text-white" : "text-blue-100"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </motion.div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-blue-400/20 py-2">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.5,
          }}
          className="px-2 mb-2"
        >
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full justify-start px-2 hover:bg-blue-500/30 text-blue-50 hover:text-white"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 mr-2 text-amber-300" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2 text-blue-200" />
                  <span>Dark Mode</span>
                </>
              )}
            </Button>
          )}
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.6,
          }}
          className="px-4 py-2 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 flex items-center justify-center text-slate-900 text-sm font-medium"
            >
              {initials}
            </motion.div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">{adminName}</span>
              <span className="text-xs text-blue-200">Administrator</span>
            </div>
          </div>
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
              className="hover:bg-red-500/20 text-blue-100 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
