import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/config/api"

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json()
    const { doctorData, adminToken } = body

    if (!doctorData) {
      return NextResponse.json({ error: "Missing doctor data" }, { status: 400 })
    }

    console.log("Registering doctor with data:", {
      ...doctorData,
      password: "[REDACTED]",
    })

    // Create headers object - now making authentication optional
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    // Add authorization header only if adminToken is provided
    if (adminToken) {
      headers.Authorization = `Token ${adminToken}`
    }

    // Try different URL variations to find the correct one
    const urlVariations = [
      `${API_BASE_URL}/api/register/doctor/`,
      `${API_BASE_URL}/api/api/register/doctor/`, // Try with double "api" prefix
      `${API_BASE_URL}/register/doctor/`, // Try without "api" prefix
      `${API_BASE_URL}/api/doctors/register/`, // Try alternative path
      `${API_BASE_URL}/api/doctors/new/`, // Try the "new_doctor_form" endpoint
    ]

    let response = null
    let successfulUrl = null

    // Try each URL variation until one works
    for (const url of urlVariations) {
      console.log(`Trying URL: ${url}`)

      try {
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(doctorData),
          credentials: "include",
        })

        console.log(`Response from ${url}: ${response.status} ${response.statusText}`)

        if (response.status !== 404) {
          successfulUrl = url
          break
        }
      } catch (error) {
        console.error(`Error with URL ${url}:`, error)
      }
    }

    if (!response) {
      throw new Error("All URL attempts failed")
    }

    // Get response data
    let responseData
    try {
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json()
        console.log("Response data:", responseData)
      } else {
        const textResponse = await response.text()
        console.log("Response text:", textResponse)

        // If we got HTML and it's a 404, provide a clearer error
        if (textResponse.includes("<!DOCTYPE html>") && response.status === 404) {
          throw new Error(`Endpoint not found. Tried URLs: ${urlVariations.join(", ")}`)
        }

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
        usedUrl: successfulUrl,
      })
    } else {
      return NextResponse.json(
        {
          error: responseData.detail || responseData.error || responseData.message || "Failed to register doctor",
          status: response.status,
          statusText: response.statusText,
          usedUrl: successfulUrl,
        },
        { status: response.status || 500 },
      )
    }
  } catch (error) {
    console.error("Error in doctor registration API route:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An error occurred during doctor registration",
        trace: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
