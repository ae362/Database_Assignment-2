import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Forward the request to the backend API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/reset-password/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    )

    // Get the response data
    const responseData = await response.json().catch(() => ({}))

    // Return the response with the same status
    return NextResponse.json(responseData, { status: response.status })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
