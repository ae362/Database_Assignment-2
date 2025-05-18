import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/config/api"

export async function POST(request: Request) {
  try {
    // Parse the request body as JSON instead of FormData
    const body = await request.json()
    const { doctorData } = body

    if (!doctorData) {
      return NextResponse.json({ error: "Missing doctor data" }, { status: 400 })
    }

    console.log("Direct registration with data:", {
      ...doctorData,
      password: "[REDACTED]",
    })

    // Create a public registration endpoint that doesn't require authentication
    const response = await fetch(`${API_BASE_URL}/api/api/register/doctor/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doctorData),
      credentials: "include",
    })

    console.log(`Direct registration response: ${response.status} ${response.statusText}`)

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
      console.error("Error parsing response:", error)
      responseData = { message: "Could not parse response" }
    }

    // Return success or error based on response
    if (response.ok) {
      return NextResponse.json({
        ...responseData,
        success: true,
        message: responseData.message || "Doctor registered successfully",
      })
    } else {
      return NextResponse.json(
        {
          error: responseData.detail || responseData.error || responseData.message || "Failed to register doctor",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status || 500 },
      )
    }
  } catch (error) {
    console.error("Error in direct doctor registration API route:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An error occurred during doctor registration",
        trace: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
