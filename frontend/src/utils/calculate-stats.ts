// This utility function calculates appointment statistics from the appointments list
// when the direct stats endpoint is not available

export function calculateAppointmentStats(appointments: any[]) {
    if (!Array.isArray(appointments)) {
      console.error("Cannot calculate stats: appointments is not an array")
      return {
        total: 0,
        completed: 0,
        pending: 0,
        today: 0,
        completion_rate: 0,
      }
    }
  
    const today = new Date().toISOString().split("T")[0]
  
    const total = appointments.length
    const completed = appointments.filter((app) => app.status === "completed").length
    const pending = appointments.filter((app) => app.status === "scheduled" || app.status === "pending").length
  
    const todayAppointments = appointments.filter((app) => {
      if (!app.date) return false
  
      // Handle different date formats
      if (typeof app.date === "string") {
        return app.date === today || app.date.startsWith(today)
      }
  
      return false
    }).length
  
    // Calculate completion rate
    const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0
  
    return {
      total,
      completed,
      pending,
      today: todayAppointments,
      completion_rate,
    }
  }
  