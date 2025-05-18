/**
 * Utility function to get the doctor's actual ID (not user_id)
 * This fetches the doctor profile to get the actual ID
 */
export async function getDoctorId(): Promise<string | null> {
  try {
    // First get the user ID from localStorage
    const userStr = localStorage.getItem("user")
    if (!userStr) {
      console.error("No user data found in localStorage")
      return null
    }

    const user = JSON.parse(userStr)
    if (!user || !user.id) {
      console.error("No user ID found in localStorage")
      return null
    }

    const userId = user.id
    console.log("User ID from localStorage:", userId)

    // Get the token
    const token = localStorage.getItem("token")
    if (!token) {
      console.error("No authentication token found")
      return null
    }

    // Fetch the doctors list to find the doctor with matching user_id
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const response = await fetch(`${apiBaseUrl}/api/api/doctors/`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("Failed to fetch doctors list:", response.status)
      return null
    }

    const doctors = await response.json()
    console.log("Doctors list:", doctors)

    // Find the doctor with matching user_id
    const doctorProfile = doctors.find((doc: any) => doc.user_id === userId)

    if (!doctorProfile) {
      console.error("Doctor profile not found for current user")
      return null
    }

    console.log("Found doctor profile:", doctorProfile)

    // Return the doctor's actual ID
    return doctorProfile.id
  } catch (error) {
    console.error("Error getting doctor ID:", error)
    return null
  }
}
