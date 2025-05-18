"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Calendar, Clock, Users, FileText, User, Settings, ChevronRight, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/context/auth-context"

export function DoctorSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const navItems = [
    {
      name: "Dashboard",
      href: "/doctor-panel",
      icon: LayoutDashboard,
    },
    {
      name: "My Appointments",
      href: "/doctor-panel/appointments",
      icon: Calendar,
    },
    {
      name: "Availability",
      href: "/doctor-panel/availability",
      icon: Clock,
    },
    {
      name: "My Patients",
      href: "/doctor-panel/patients",
      icon: Users,
    },
    {
      name: "Medical Records",
      href: "/doctor-panel/records",
      icon: FileText,
    },
    {
      name: "Profile",
      href: "/doctor-panel/profile",
      icon: User,
    },
    {
      name: "Settings",
      href: "/doctor-panel/settings",
      icon: Settings,
    },
  ]

  if (!isMounted) {
    return null
  }

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-[#0a1022] border-r border-[#1a2542] transition-all duration-300 flex flex-col h-screen sticky top-0",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#1a2542]">
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Link href="/doctor-panel" className="flex items-center gap-2">
                <div className="bg-blue-500 text-white p-1 rounded">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
                <span className="font-semibold text-white">City Health Clinic</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={toggleSidebar}>
          <motion.div animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
            <ChevronRight size={20} />
          </motion.div>
        </Button>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200",
                pathname === item.href
                  ? "bg-blue-500/20 text-blue-500"
                  : "text-gray-400 hover:bg-[#1a2542] hover:text-white",
                isCollapsed && "justify-center px-2",
              )}
            >
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <item.icon size={20} />
              </motion.div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-[#1a2542] mt-auto">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white"
          >
            D
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="font-medium text-white">Dr. Smith</div>
                <div className="text-xs text-gray-400">Cardiologist</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300",
            isCollapsed && "justify-center px-2",
          )}
        >
          <LogOut size={20} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  )
}
