import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/config/api"

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { appointmentId, status } = body

    if (!appointmentId || !status) {
      return NextResponse.json({ error: "Missing appointmentId or status" }, { status: 400 })
    }

    // Get the auth token from the request headers
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header provided" }, { status: 401 })
    }

    // Convert token format if needed
    let authToken = authHeader
    if (authHeader.startsWith("Token ")) {
      // Convert from Token to Bearer format for MongoDB
      authToken = `Bearer ${authHeader.substring(6)}`
    } else if (!authHeader.startsWith("Bearer ")) {
      // If no prefix, assume it's the token and add Bearer prefix
      authToken = `Bearer ${authHeader}`
    }

    console.log(`Updating appointment ${appointmentId} to status ${status} in MongoDB`)

    // Try multiple endpoints in sequence until one works
    const endpoints = [
      // Try the MongoDB-specific endpoint first
      `${API_BASE_URL}/api/api/appointments/${appointmentId}`,
      // Then try the direct update endpoint
      `${API_BASE_URL}/api/api/appointments/${appointmentId}/direct-update/`,
      // Then try the regular update-status endpoint
      `${API_BASE_URL}/api/api/appointments/${appointmentId}/update-status/`,
    ]

    let successResponse = null
    let lastError = null

    // Try each endpoint in sequence
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)

        const response = await fetch(endpoint, {
          method: endpoint.includes("direct-update") ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: authToken,
          },
          body: JSON.stringify({ status }),
        })

        // Get response data
        let responseData
        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            responseData = await response.json()
          } else {
            const textResponse = await response.text()
            responseData = { message: textResponse }
          }
        } catch (error) {
          console.error(`Error parsing response from ${endpoint}:`, error)
          responseData = { message: "Could not parse response" }
        }

        console.log(`Response from ${endpoint}:`, response.status, responseData)

        if (response.ok) {
          successResponse = {
            success: true,
            message: "Appointment status updated successfully in MongoDB",
            data: responseData,
            endpoint: endpoint,
          }
          break
        } else {
          lastError = {
            error: responseData.error || responseData.detail || "Failed to update appointment status",
            status: response.status,
            statusText: response.statusText,
            endpoint: endpoint,
          }
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error)
        lastError = {
          error: error instanceof Error ? error.message : `Error with endpoint ${endpoint}`,
          endpoint: endpoint,
        }
      }
    }

    // Return success response if any endpoint worked
    if (successResponse) {
      return NextResponse.json(successResponse)
    }

    // Otherwise return the last error
    return NextResponse.json(
      {
        error: lastError?.error || "All endpoints failed",
        details: lastError,
      },
      { status: lastError?.status || 500 },
    )
  } catch (error) {
    console.error("Error in appointment status update API route:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An error occurred during appointment status update",
      },
      { status: 500 },
    )
  }
}
