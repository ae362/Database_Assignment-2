import { ENDPOINTS } from "@/config/api"
import { fetchWithAuth } from "@/utils/api-helpers"

export const getAppointments = async () => {
  const response = await fetchWithAuth(ENDPOINTS.appointments())
  return response.json()
}

export const createAppointment = async (appointmentData: any) => {
  const response = await fetchWithAuth(ENDPOINTS.appointments(), {
    method: "POST",
    body: JSON.stringify(appointmentData),
  })
  return response.json()
}

export const getDoctors = async () => {
  const response = await fetchWithAuth(ENDPOINTS.doctors())
  return response.json()
}

export const createDoctor = async (doctorData: any) => {
  const response = await fetchWithAuth(ENDPOINTS.doctors(), {
    method: "POST",
    body: JSON.stringify(doctorData),
  })
  return response.json()
}

export const getUserProfile = async () => {
  const response = await fetchWithAuth(ENDPOINTS.userProfile)
  return response.json()
}

export const updateUserProfile = async (profileData: any) => {
  const response = await fetchWithAuth(ENDPOINTS.userProfile, {
    method: "PATCH",
    body: JSON.stringify(profileData),
  })
  return response.json()
}

export const uploadAvatar = async (formData: FormData) => {
  const token = localStorage.getItem("token")
  if (!token) {
    throw new Error("No authentication token found")
  }

  const headers = new Headers()
  headers.set("Authorization", `Token ${token}`)
  // Don't set Content-Type for FormData

  const response = await fetch(ENDPOINTS.avatarUpload, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  })

  if (response.status === 401) {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  return response.json()
}

export const getAppointmentDetails = async (appointmentId: string | number) => {
  const response = await fetchWithAuth(`${ENDPOINTS.appointments()}/${appointmentId}`)
  return response.json()
}
