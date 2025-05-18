import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Forward the request to the backend API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/password-reset/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    )

    // Get the response data
    const responseData = await response.json()

    // Return the response with the same status
    return NextResponse.json(responseData, { status: response.status })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Failed to process password reset request" }, { status: 500 })
  }
}
