// This file provides a consistent way to make authenticated requests

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token")

  // Create headers object
  const headers = new Headers(options.headers)

  // Add authorization header if token exists
  if (token) {
    // Use Bearer format for MongoDB JWT authentication
    headers.set("Authorization", `Bearer ${token}`)

    // Log the token being used (first 10 chars for security)
    console.log(`Using token for authentication: ${token.substring(0, 10)}...`)
  } else {
    console.warn("No authentication token found when making request to:", url)
  }

  // Only set Content-Type if not FormData
  const isFormData = options.body instanceof FormData
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  try {
    // Make the request with the headers
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for cross-origin requests
    })

    // Log response for debugging
    console.log(`API response from ${url}: ${response.status}`)

    // Handle 401 Unauthorized errors
    if (response.status === 401) {
      console.error("Unauthorized request detected:", url)

      // Get response text for debugging
      try {
        const responseText = await response.clone().text()
        console.error("Response text:", responseText)
      } catch (e) {
        console.error("Could not read response text")
      }
    }

    return response
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
}

// Special function for login that doesn't require authentication
export async function fetchForLogin(url: string, options: RequestInit = {}) {
  // Create headers object
  const headers = new Headers(options.headers)

  // Only set Content-Type if not FormData
  const isFormData = options.body instanceof FormData
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  try {
    // Make the request with the headers
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Include cookies for cross-origin requests
    })

    // Log response for debugging
    console.log(`Login API response from ${url}: ${response.status}`)

    return response
  } catch (error) {
    console.error("Login API request failed:", error)
    throw error
  }
}

// Token validation function
export async function validateToken(request: Request | string) {
  try {
    let token: string | null = null

    // Handle both Request objects and direct token strings
    if (typeof request === "string") {
      token = request
    } else {
      // Extract token from Authorization header
      const authHeader = request.headers.get("Authorization")
      if (authHeader) {
        // Handle both "Token xyz" and "Bearer xyz" formats
        if (authHeader.startsWith("Token ")) {
          token = authHeader.substring(6) // Remove 'Token ' prefix
        } else if (authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7) // Remove 'Bearer ' prefix
        } else {
          // If no prefix, assume the whole header is the token
          token = authHeader
        }
      }
    }

    if (!token) {
      console.warn("No token provided for validation")
      return { valid: false, error: "No token provided" }
    }

    // Make request to backend validation endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/api/validate-token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // Updated to Bearer for MongoDB
      },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      console.error(`Token validation failed with status: ${response.status}`)
      return { valid: false, error: `Validation failed with status ${response.status}` }
    }

    const data = await response.json()
    return { valid: true, user: data.user }
  } catch (error) {
    console.error("Error validating token:", error)
    return { valid: false, error: "Error validating token" }
  }
}

// Helper function to validate token from a request object
export async function validateTokenFromRequest(request: Request) {
  const authHeader = request.headers.get("Authorization")

  if (!authHeader || (!authHeader.startsWith("Token ") && !authHeader.startsWith("Bearer "))) {
    return { valid: false, error: "No authorization token provided" }
  }

  // Handle both Token and Bearer formats
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7) // Remove 'Bearer ' prefix
    : authHeader.substring(6) // Remove 'Token ' prefix

  return await validateToken(token)
}

export function getToken(): string | null {
  return localStorage.getItem("token")
}
