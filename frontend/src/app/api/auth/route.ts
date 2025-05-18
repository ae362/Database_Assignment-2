import { NextResponse } from "next/server"

// This API route handles authentication verification
export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Token ")) {
      return NextResponse.json({ error: "Authentication credentials were not provided" }, { status: 401 })
    }

    // Extract the token
    const token = authHeader.split(" ")[1]

    // Forward the token validation request to your backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const validationUrl = `${backendUrl}/api/validate-token/`

    console.log("Validating token with backend:", validationUrl)
    console.log("Token format being sent:", `Token ${token.substring(0, 10)}...`)

    // Properly typed headers
    const headers: HeadersInit = {
      Authorization: `Token ${token}`,
    }

    try {
      const response = await fetch(validationUrl, {
        method: "GET",
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Token validation failed" }))
        console.error("Token validation failed:", errorData)
        return NextResponse.json(errorData, { status: response.status })
      }

      const userData = await response.json()
      console.log("Token validation successful:", userData)

      return NextResponse.json({
        authenticated: true,
        message: "Token is valid",
        user: userData,
      })
    } catch (error) {
      console.error("Token validation error:", error)
      return NextResponse.json({ error: "Failed to validate token with backend" }, { status: 500 })
    }
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json({ error: "Authentication check failed" }, { status: 500 })
  }
}
