import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  try {
    console.log("Fetching appointment stats from MongoDB backend")

    // Get the token from the request headers
    const authHeader = request.headers.get("Authorization")
    let token = ""

    if (authHeader) {
      // Extract token from Authorization header
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader
      } else if (authHeader.startsWith("Token ")) {
        // Convert from Token to Bearer format
        token = `Bearer ${authHeader.substring(6)}`
      } else {
        // If no prefix, assume it's the token and add Bearer prefix
        token = `Bearer ${authHeader}`
      }
    } else {
      // Try to get token from cookies as fallback
      const cookieStore = cookies()
      const tokenCookie = cookieStore.get("token")
      if (tokenCookie) {
        token = `Bearer ${tokenCookie.value}`
      }
    }

    if (!token) {
      console.error("No authentication token found in request")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Construct the URL with the correct double /api/api/ prefix
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/api/appointments/stats/`
    console.log("Fetching from:", backendUrl)

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      credentials: "include",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error response from MongoDB backend: ${response.status} ${response.statusText}`, errorText)

      // If we get a 404, provide more detailed error information
      if (response.status === 404) {
        return NextResponse.json({ error: "Appointment stats endpoint not found", details: errorText }, { status: 404 })
      }

      return NextResponse.json(
        { error: `Failed to fetch appointment stats: ${response.statusText}`, details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("Successfully fetched appointment stats from MongoDB:", data)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in appointment stats route:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointment stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
