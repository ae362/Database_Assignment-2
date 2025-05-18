import { fetchWithAuth } from "@/lib/auth"

/**
 * Helper function to handle API responses
 */
export async function handleApiResponse(response: Response) {
  const contentType = response.headers.get("content-type")
  const isJson = contentType && contentType.includes("application/json")

  // For JSON responses
  if (isJson) {
    const data = await response.json()

    if (!response.ok) {
      // Extract error message from response
      const errorMessage = data.error || data.message || data.detail || "An error occurred"
      throw new Error(errorMessage)
    }

    return data
  }

  // For non-JSON responses
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return await response.text()
}

/**
 * Helper function to format API request data
 */
export function formatRequestData(data: Record<string, any>) {
  // Remove empty string values
  const formattedData: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    if (value !== "") {
      formattedData[key] = value
    }
  }

  return formattedData
}

/**
 * Helper function for API requests without authentication
 */
export async function fetchApi(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)

  // Check if body is FormData before setting Content-Type
  const isFormData = options.body instanceof FormData
  if (!headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json")
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for cross-origin requests
    })

    return response
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
}

// Re-export fetchWithAuth from lib/auth
export { fetchWithAuth }

// Define ENDPOINTS here or import it from a config file
const ENDPOINTS = {
  doctors: () => "/api/api/doctors/", // Example endpoint, adjusted to use /api/api/
}

// Update the getDoctorId function to prioritize the UUID format
export async function getDoctorId(): Promise<string | null> {
  try {
    // Get user data from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}")

    // If we have a user ID, return it
    if (user && user.id) {
      return user.id
    }

    return null
  } catch (error) {
    console.error("Error getting doctor ID:", error)
    return null
  }
}

// Update the fetchDoctorData function to use the correct ID format
export async function fetchDoctorData(endpoint: string, options: RequestInit = {}): Promise<Response> {
  try {
    const doctorId = await getDoctorId()
    if (!doctorId) {
      throw new Error("Doctor ID not found")
    }

    // Construct the URL with the doctor's ID (which should be the UUID)
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/api/doctors/${doctorId}${endpoint}`
    console.log(`Fetching doctor data from: ${url}`)

    return fetchWithAuth(url, options)
  } catch (error) {
    console.error("Error in fetchDoctorData:", error)
    throw error
  }
}
