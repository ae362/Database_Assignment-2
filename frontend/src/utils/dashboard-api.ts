// Utility functions for fetching dashboard data

// Define the base URL for API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Helper function to get the authentication token
function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token")
  }
  return null
}

// Helper function to make authenticated requests
export async function fetchWithAuth(url: string, options = {}) {
  try {
    console.log(`Making authenticated request to ${url}`)
    const token = getToken()

    if (!token) {
      console.error("No token found for API request")
      throw new Error("Authentication required")
    }

    // Use Bearer format for MongoDB JWT authentication
    const authHeader = `Bearer ${token}`
    console.log(`Using auth header: ${authHeader.substring(0, 15)}...`)

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        ...(options as any).headers,
      },
      credentials: "include",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error (${response.status}): ${errorText}`)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response
  } catch (error) {
    console.error("Error in fetchWithAuth:", error)
    throw error
  }
}

export async function fetchPatients() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/api/patients/`)
    const data = await response.json()
    return Array.isArray(data) ? data.length : 0
  } catch (error) {
    console.error("Error fetching patients:", error)
    return 0
  }
}

export async function fetchDoctors() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/api/doctors/`)
    const data = await response.json()
    return Array.isArray(data) ? data.length : 0
  } catch (error) {
    console.error("Error fetching doctors:", error)
    return 0
  }
}

export async function fetchAppointments() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/api/appointments/`)
    const data = await response.json()

    // If data is an array, calculate stats
    if (Array.isArray(data)) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const total = data.length
      const completed = data.filter((apt) => apt.status === "completed").length
      const pending = data.filter((apt) => apt.status === "scheduled" || apt.status === "pending").length

      // Calculate today's appointments
      const todayAppts = data.filter((apt) => {
        try {
          const aptDate = new Date(apt.date)
          aptDate.setHours(0, 0, 0, 0)
          return aptDate.getTime() === today.getTime()
        } catch (e) {
          console.error("Error parsing date:", e, apt.date)
          return false
        }
      }).length

      return {
        total,
        completed,
        pending,
        today: todayAppts,
      }
    }

    return {
      total: 0,
      completed: 0,
      pending: 0,
      today: 0,
    }
  } catch (error) {
    console.error("Error fetching appointments:", error)
    return {
      total: 0,
      completed: 0,
      pending: 0,
      today: 0,
    }
  }
}

export async function fetchAppointmentStats() {
  try {
    console.log("Fetching all appointments to calculate stats...")

    // Use the appointments endpoint instead of the stats endpoint
    const appointmentsUrl = `${API_BASE_URL}/api/api/appointments/`
    console.log("Appointments URL:", appointmentsUrl)

    const response = await fetchWithAuth(appointmentsUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch appointments: ${response.status}`)
    }

    // Log the raw response to debug
    const responseText = await response.text()
    console.log("Raw response:", responseText)

    // Try to parse the response as JSON
    let appointments = []
    try {
      appointments = JSON.parse(responseText)
      console.log("Parsed appointments:", appointments)
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError)
      throw new Error(`Failed to parse appointments data: ${parseError.message}`)
    }

    // Check if the response is an array or has a results property (common in Django REST Framework)
    if (Array.isArray(appointments)) {
      console.log(`Fetched ${appointments.length} appointments (array)`)
    } else if (appointments && typeof appointments === "object") {
      if (appointments.results && Array.isArray(appointments.results)) {
        appointments = appointments.results
        console.log(`Fetched ${appointments.length} appointments (from results property)`)
      } else {
        // If it's a single appointment object, wrap it in an array
        if (appointments._id || appointments.id) {
          appointments = [appointments]
          console.log("Fetched a single appointment object")
        } else {
          console.log("Response is an object but not an appointment array:", appointments)
        }
      }
    } else {
      console.log("Unexpected response format:", typeof appointments)
    }

    // Calculate stats from the appointments data
    if (Array.isArray(appointments) && appointments.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      console.log("First appointment sample:", appointments[0])

      const total = appointments.length
      const completed = appointments.filter((apt) => apt.status === "completed").length
      const pending = appointments.filter(
        (apt) => apt.status === "scheduled" || apt.status === "pending" || !apt.status,
      ).length

      // Calculate today's appointments with more flexible date parsing
      const todayAppts = appointments.filter((apt) => {
        try {
          let aptDate
          if (apt.date) {
            // Try to parse the date in various formats
            if (typeof apt.date === "string") {
              aptDate = new Date(apt.date)
            } else if (apt.date.$date) {
              // MongoDB extended JSON format
              aptDate = new Date(apt.date.$date)
            }
          } else if (apt.appointment_date) {
            aptDate = new Date(apt.appointment_date)
          } else if (apt.created_at) {
            aptDate = new Date(apt.created_at)
          }

          if (aptDate && !isNaN(aptDate.getTime())) {
            aptDate.setHours(0, 0, 0, 0)
            return aptDate.getTime() === today.getTime()
          }
          return false
        } catch (e) {
          console.error("Error parsing date:", e, apt.date)
          return false
        }
      }).length

      // Calculate completion rate
      const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0

      const stats = {
        total,
        completed,
        pending,
        today: todayAppts,
        completion_rate,
      }

      console.log("Calculated appointment stats:", stats)
      return stats
    } else {
      console.log("No appointments found or empty array")

      // Try a direct MongoDB query as a last resort
      try {
        console.log("Attempting direct MongoDB stats query...")
        const statsUrl = `${API_BASE_URL}/api/api/appointments/count`
        const statsResponse = await fetchWithAuth(statsUrl)

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          console.log("Direct stats query result:", statsData)

          if (statsData && typeof statsData === "object") {
            return {
              total: statsData.total || 0,
              completed: statsData.completed || 0,
              pending: statsData.pending || 0,
              today: statsData.today || 0,
              completion_rate: statsData.completion_rate || 0,
            }
          }
        }
      } catch (statsError) {
        console.error("Direct stats query failed:", statsError)
      }

      return {
        total: 0,
        completed: 0,
        pending: 0,
        today: 0,
        completion_rate: 0,
      }
    }
  } catch (error) {
    console.error("Error fetching appointment stats:", error)

    // Try a direct MongoDB count query as a last resort
    try {
      console.log("Attempting direct MongoDB count query...")
      const countUrl = `${API_BASE_URL}/api/api/appointments/count`
      const countResponse = await fetchWithAuth(countUrl)

      if (countResponse.ok) {
        const countData = await countResponse.json()
        console.log("Direct count query result:", countData)

        if (countData && typeof countData === "number") {
          return {
            total: countData,
            completed: 0,
            pending: 0,
            today: 0,
            completion_rate: 0,
          }
        }
      }
    } catch (countError) {
      console.error("Direct count query failed:", countError)
    }

    return null
  }
}

// New function to directly query MongoDB for appointment count
export async function fetchAppointmentCount() {
  try {
    // Try different endpoints that might return the count
    const endpoints = [
      `${API_BASE_URL}/api/api/appointments/count`,
      `${API_BASE_URL}/api/api/appointments/stats/`,
      `${API_BASE_URL}/api/api/appointments?count=true`,
    ]

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying count endpoint: ${endpoint}`)
        const response = await fetchWithAuth(endpoint)

        if (response.ok) {
          const data = await response.json()
          console.log(`Response from ${endpoint}:`, data)

          if (typeof data === "number") {
            return data
          } else if (data && typeof data === "object") {
            if (data.count !== undefined) return data.count
            if (data.total !== undefined) return data.total
          }
        }
      } catch (e) {
        console.log(`Endpoint ${endpoint} failed:`, e)
      }
    }

    // If all else fails, try to get all appointments and count them
    const response = await fetchWithAuth(`${API_BASE_URL}/api/api/appointments/`)
    const data = await response.json()

    if (Array.isArray(data)) {
      return data.length
    } else if (data && typeof data === "object" && Array.isArray(data.results)) {
      return data.results.length
    }

    return 0
  } catch (error) {
    console.error("Error fetching appointment count:", error)
    return 0
  }
}
