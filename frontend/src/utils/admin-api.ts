/**
 * Creates a patient record for a user (admin only)
 * This function should only be called by administrators
 */
export async function createPatientRecord(token: string, userData: any) {
  try {
    const response = await fetch(`http://localhost:8000/api/api/patients/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        name: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        email: userData.email,
        phone: userData.phone || "",
        user_id: userData.id,
        date_of_birth: userData.birthday || "",
        gender: userData.gender || "",
        address: userData.address || "",
        medical_history: "",
        allergies: "",
        medications: "",
        blood_type: "",
        chronic_diseases: "",
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to create patient record (${response.status})`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error creating patient record:", error)
    throw error
  }
}
