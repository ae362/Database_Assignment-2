"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle, AlertCircle, Info } from "lucide-react"

export type NotificationType = "success" | "error" | "info"

interface NotificationProps {
  type: NotificationType
  title: string
  message: string
  duration?: number
  onClose: () => void
}

export const Notification = ({ type, title, message, duration = 5000, onClose }: NotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-emerald-400" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-rose-400" />
      case "info":
        return <Info className="h-5 w-5 text-blue-400" />
    }
  }

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-emerald-950 border-l-4 border-emerald-500"
      case "error":
        return "bg-rose-950 border-l-4 border-rose-500"
      case "info":
        return "bg-blue-950 border-l-4 border-blue-500"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`${getBgColor()} text-white p-4 rounded-md shadow-lg max-w-sm w-full`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-sm text-gray-300">{message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button className="inline-flex text-gray-400 hover:text-gray-200 focus:outline-none" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
}

export const NotificationContainer = ({
  notifications,
  removeNotification,
}: {
  notifications: NotificationItem[]
  removeNotification: (id: string) => void
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
