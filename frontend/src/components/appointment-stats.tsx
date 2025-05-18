"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, CalendarClock } from "lucide-react"
import { fetchAppointmentStats } from "@/utils/dashboard-api"
import { motion } from "framer-motion"

interface AppointmentStats {
  total: number
  completed: number
  pending: number
  today: number
  completion_rate: number
}

export default function AppointmentStatsCard() {
  const [stats, setStats] = useState<AppointmentStats>({
    total: 0,
    completed: 0,
    pending: 0,
    today: 0,
    completion_rate: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getStats = async () => {
      try {
        setIsLoading(true)
        const data = await fetchAppointmentStats()

        if (data) {
          setStats({
            total: data.total || 0,
            completed: data.completed || 0,
            pending: data.pending || 0,
            today: data.today || 0,
            completion_rate: data.completion_rate || 0,
          })
          setError(null)
        } else {
          setError("Failed to fetch appointment statistics")
        }
      } catch (err) {
        console.error("Error fetching appointment stats:", err)
        setError("An error occurred while fetching appointment statistics")
      } finally {
        setIsLoading(false)
      }
    }

    getStats()
  }, [])

  return (
    <Card className="border-none shadow-md bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <CardHeader>
        <CardTitle>Appointment Completion Rate</CardTitle>
        <p className="text-slate-300">{stats.completion_rate}% of all appointments have been completed</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
            <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm py-2">{error}. Please try refreshing the page.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mr-1.5" />
                <span>Completed</span>
              </div>
              <span className="font-medium">{stats.completed.toLocaleString()}</span>
            </div>

            <div className="relative pt-1">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.completion_rate}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{ width: `${stats.completion_rate}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-emerald-500 to-teal-400"
                ></motion.div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-amber-400 mr-1.5" />
                <span>Pending</span>
              </div>
              <span className="font-medium">{stats.pending.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700 mt-2">
              <div className="flex items-center">
                <CalendarClock className="h-4 w-4 text-blue-400 mr-1.5" />
                <span>Today's Appointments</span>
              </div>
              <span className="font-medium">{stats.today.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700 mt-2">
              <div className="flex items-center">
                <span>Total Appointments</span>
              </div>
              <span className="font-medium">{stats.total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
