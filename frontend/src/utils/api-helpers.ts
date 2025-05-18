import { API_BASE_URL } from "@/config/api"

/**
 * Helper function to ensure URLs have trailing slashes
 */
export function ensureTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`
}

/**
 * Helper function to fetch with authentication
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token")
  if (!token) {
    throw new Error("No authentication token found")
  }

  // Ensure URL has trailing slash for Django
  const urlWithSlash = ensureTrailingSlash(url)

  const headers = new Headers(options.headers)
  // Use Bearer format for MongoDB JWT authentication
  headers.set("Authorization", `Bearer ${token}`)

  // Set Content-Type if not already set and we have a body
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json")
  }

  try {
    const response = await fetch(urlWithSlash, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "/login"
      throw new Error("Unauthorized")
    }

    return response
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
}

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
 * Get a patient record by user ID
 * Returns null if not found
 */
export async function getPatientByUserId(userId: string) {
  try {
    // First try to get the patient by querying with user_id parameter
    const url = ensureTrailingSlash(`${API_BASE_URL}/api/api/patients`) + `?user_id=${userId}`

    const response = await fetchWithAuth(url)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Failed to get patient by user ID: ${response.status}`)
    }

    const patients = await response.json()

    if (!patients || patients.length === 0) {
      return null
    }

    return patients[0]
  } catch (error) {
    console.error("Error getting patient by user ID:", error)
    return null
  }
}

/**
 * Get or create a patient record using the user ID
 */
export async function getOrCreatePatientRecord(userId: string) {
  try {
    // First try to get the patient by user ID
    const patient = await getPatientByUserId(userId)

    if (patient) {
      return patient
    }

    // If not found, try to create a new patient record
    console.log("Patient record not found, attempting to create one")

    // Get user data from localStorage
    const userDataString = localStorage.getItem("user")
    if (!userDataString) {
      throw new Error("User data not found in localStorage")
    }

    const userData = JSON.parse(userDataString)

    // Create a new patient record
    const url = ensureTrailingSlash(`${API_BASE_URL}/api/api/patients`)

    const response = await fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        name: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        email: userData.email || "",
        phone: userData.phone || "",
        date_of_birth: userData.birthday || "",
        gender: userData.gender || "",
        address: userData.address || "",
        medical_history: [],
        allergies: [],
        medications: [],
        chronic_diseases: [],
        medical_info: {
          blood_type: "",
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create patient record: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting or creating patient record:", error)
    throw error
  }
}

/**
 * Update a patient's medical information
 */
export async function updatePatientMedicalInfo(patientId: string, medicalData: any) {
  try {
    // Convert string values to arrays if they're not already
    const formatToArray = (value: string | string[]): string[] => {
      if (Array.isArray(value)) return value
      if (!value) return []
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "")
    }

    // Format medical data for the API
    const formattedData = {
      medical_info: {
        blood_type: medicalData.blood_type || "",
      },
      allergies: formatToArray(medicalData.allergies),
      medications: formatToArray(medicalData.medications),
      medical_history: formatToArray(medicalData.medical_history),
      chronic_diseases: formatToArray(medicalData.chronic_diseases),
    }

    console.log("Updating patient medical info:", JSON.stringify(formattedData, null, 2))

    const url = ensureTrailingSlash(`${API_BASE_URL}/api/api/patients/${patientId}`)
    console.log("Sending PATCH request to:", url)

    // Get token directly for more explicit control
    const token = localStorage.getItem("token")
    if (!token) {
      throw new Error("No authentication token found")
    }

    // Make a direct fetch call with detailed logging
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formattedData),
    })

    console.log("Response status:", response.status)

    // Log the full response for debugging
    const responseText = await response.text()
    console.log("Response text:", responseText)

    if (!response.ok) {
      throw new Error(`Failed to update patient medical info: ${response.status} - ${responseText}`)
    }

    // Parse the response JSON
    try {
      return JSON.parse(responseText)
    } catch (e) {
      console.error("Error parsing response JSON:", e)
      throw new Error("Invalid response from server")
    }
  } catch (error) {
    console.error("Error updating patient medical info:", error)
    throw error
  }
}
