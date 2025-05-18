import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token")
  if (!token) {
    throw new Error("No authentication token found")
  }

  const headers = new Headers(options.headers)
  headers.set("Authorization", `Token ${token}`)
  headers.set("Content-Type", "application/json")

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  return response
}

