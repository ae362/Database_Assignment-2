/**
 * Debug utility to check API endpoints
 */
export async function checkEndpoint(url: string): Promise<{
    status: number
    exists: boolean
    message: string
  }> {
    try {
      // Try a HEAD request first to check if the endpoint exists
      const response = await fetch(url, {
        method: "HEAD",
        cache: "no-store",
      })
  
      return {
        status: response.status,
        exists: response.ok || response.status === 405, // 405 means Method Not Allowed, but endpoint exists
        message: response.ok ? "Endpoint exists" : `Status: ${response.status} ${response.statusText}`,
      }
    } catch (error) {
      console.error(`Error checking endpoint ${url}:`, error)
      return {
        status: 0,
        exists: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
  
  /**
   * Debug utility to check all API endpoints
   */
  export async function checkAllEndpoints(baseUrl: string): Promise<Record<string, any>> {
    const endpoints = [
      "/api/login/",
      "/api/register/patient/",
      "/api/register/doctor/",
      "/api/validate-token/",
      "/api/csrf/",
      "/api/users/",
      "/api/profile/",
      "/api/doctors/",
      "/api/patients/",
      "/api/appointments/",
    ]
  
    const results: Record<string, any> = {}
  
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`
      results[endpoint] = await checkEndpoint(url)
    }
  
    return results
  }
  