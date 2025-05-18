import { NextResponse } from "next/server"

// This endpoint can be used to validate tokens
export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Token ")) {
      return NextResponse.json({ valid: false, error: "Authentication credentials were not provided" }, { status: 401 })
    }

    // Extract the token
    const token = authHeader.split(" ")[1]

    // In a real app, you would validate the token with your backend
    // For now, we'll just return success if a token is provided
    return NextResponse.json({
      valid: true,
      user_id: "mock_user_id",
      username: "admin",
    })
  } catch (error) {
    console.error("Token validation error:", error)
    return NextResponse.json({ valid: false, error: "Token validation failed" }, { status: 500 })
  }
}
