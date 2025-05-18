"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

// This is a completely standalone debug page that doesn't use any auth-related components
export default function AuthDebugPage() {
  // Get API base URL from environment or default
  const [baseUrl, setBaseUrl] = useState("")
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("token-check")

  // Initialize baseUrl and check for token on mount
  useEffect(() => {
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    setBaseUrl(envApiUrl)
    
    // Get token and user from localStorage
    const storedToken = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")
    
    setToken(storedToken)
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error("Failed to parse user data:", e)
      }
    }
  }, [])

  // Test token validation with backend
  const testTokenValidation = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (!token) {
        throw new Error("No token found in localStorage")
      }
      
      const response = await fetch(`${baseUrl}/api/api/validate-token/`, {
        method: "GET",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "application/json"
        }
      })
      
      const data = await response.json()
      
      setResults({
        endpoint: `${baseUrl}/api/validate-token/`,
        status: response.status,
        statusText: response.statusText,
        valid: response.ok,
        data
      })
    } catch (error) {
      console.error("Error validating token:", error)
      setError(error instanceof Error ? error.message : "An error occurred while validating token")
    } finally {
      setIsLoading(false)
    }
  }

  // Test a protected endpoint
  const testProtectedEndpoint = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      if (!token) {
        throw new Error("No token found in localStorage")
      }
      
      const response = await fetch(`${baseUrl}/api/api/profile/`, {
        method: "GET",
        headers: {
          "Authorization": `Token ${token}`,
          "Content-Type": "application/json"
        }
      })
      
      let data
      try {
        data = await response.json()
      } catch (e) {
        data = await response.text()
      }
      
      setResults({
        endpoint: `${baseUrl}/api/profile/`,
        status: response.status,
        statusText: response.statusText,
        valid: response.ok,
        data
      })
    } catch (error) {
      console.error("Error testing protected endpoint:", error)
      setError(error instanceof Error ? error.message : "An error occurred while testing protected endpoint")
    } finally {
      setIsLoading(false)
    }
  }

  // Test login endpoint
  const testLoginEndpoint = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const testCredentials = {
        username: "test@example.com",
        email: "test@example.com",
        password: "Test1234!",
        role: "patient"
      }
      
      const response = await fetch(`${baseUrl}/api/api/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testCredentials)
      })
      
      let data
      try {
        data = await response.json()
      } catch (e) {
        data = await response.text()
      }
      
      setResults({
        endpoint: `${baseUrl}/api/login/`,
        status: response.status,
        statusText: response.statusText,
        valid: response.ok,
        data
      })
    } catch (error) {
      console.error("Error testing login endpoint:", error)
      setError(error instanceof Error ? error.message : "An error occurred while testing login endpoint")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-2">Authentication Debug Tool</h1>
      <p className="text-muted-foreground mb-6">
        This page helps diagnose authentication and token-related issues.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Authentication State</CardTitle>
            <CardDescription>Information about your current authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Token Status</Label>
                <div className="flex items-center mt-1">
                  {token ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                      <span>Token found in localStorage</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <span>No token found in localStorage</span>
                    </>
                  )}
                </div>
                {token && (
                  <div className="mt-2">
                    <Label className="text-xs">Token Value (first 20 chars)</Label>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {token.substring(0, 20)}...
                    </pre>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">User Data</Label>
                <div className="flex items-center mt-1">
                  {user ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                      <span>User data found in localStorage</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <span>No user data found in localStorage</span>
                    </>
                  )}
                </div>
                {user && (
                  <div className="mt-2">
                    <Label className="text-xs">User Data</Label>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-40">
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">API Base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default from NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL || "not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication Checklist</CardTitle>
            <CardDescription>Common authentication issues and solutions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-start">
                <div className="mr-2 mt-0.5">
                  {token ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p className="text-sm">Token exists in localStorage</p>
              </div>
              
              <div className="flex items-start">
                <div className="mr-2 mt-0.5">
                  {user ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p className="text-sm">User data exists in localStorage</p>
              </div>
              
              <div className="flex items-start">
                <div className="mr-2 mt-0.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm">
                  NEXT_PUBLIC_API_URL is set to: {process.env.NEXT_PUBLIC_API_URL || "not set"}
                </p>
              </div>
              
              <div className="flex items-start">
                <div className="mr-2 mt-0.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm">
                  Check if Django CORS settings allow requests from: {typeof window !== 'undefined' ? window.location.origin : 'unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Tests</CardTitle>
          <CardDescription>Test various authentication scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="token-check">Token Validation</TabsTrigger>
              <TabsTrigger value="protected-endpoint">Protected Endpoint</TabsTrigger>
              <TabsTrigger value="login-test">Login Test</TabsTrigger>
            </TabsList>
            
            <TabsContent value="token-check" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Test if your current token is valid by sending it to the backend validation endpoint.
              </p>
              <Button onClick={testTokenValidation} disabled={isLoading || !token}>
                {isLoading ? "Testing..." : "Validate Token"}
              </Button>
            </TabsContent>
            
            <TabsContent value="protected-endpoint" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Test if you can access a protected endpoint using your current token.
              </p>
              <Button onClick={testProtectedEndpoint} disabled={isLoading || !token}>
                {isLoading ? "Testing..." : "Test Protected Endpoint"}
              </Button>
            </TabsContent>
            
            <TabsContent value="login-test" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Test the login endpoint with test credentials (will not update your current token).
              </p>
              <Button onClick={testLoginEndpoint} disabled={isLoading}>
                {isLoading ? "Testing..." : "Test Login Endpoint"}
              </Button>
            </TabsContent>
          </Tabs>

          {results && (
            <div className="mt-6 border rounded-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Test Results</h3>
                <Badge variant={results.valid ? "default" : "destructive"}>
                  {results.status} {results.statusText}
                </Badge>
              </div>
              
              <p className="text-sm mb-2">Endpoint: {results.endpoint}</p>
              
              <div className="mt-2">
                <Label className="text-xs">Response Data</Label>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-60">
                  {typeof results.data === 'object' 
                    ? JSON.stringify(results.data, null, 2) 
                    : results.data}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 p-6 border rounded-md bg-muted/50">
        <h2 className="text-xl font-bold mb-4">Authentication Flow Checklist</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">1. Token Generation</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>User submits login credentials (email/username, password, role)</li>
              <li>Backend validates credentials and generates a token (JWT or custom token)</li>
              <li>Backend returns token and user data in response</li>
              <li>Frontend stores token in localStorage</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">2. Token Transmission</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Frontend retrieves token from localStorage for each API request</li>
              <li>Token is added to the Authorization header: <code>Authorization: Token {'{token}'}</code></li>
              <li>Request is sent to the backend with this header</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">3. Token Validation</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Backend extracts token from the Authorization header</li>
              <li>Backend validates the token (checks signature, expiration, etc.)</li>
              <li>If valid, backend identifies the user and processes the request</li>
              <li>If invalid, backend returns 401 Unauthorized response</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">4. Common Issues</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Token not being stored in localStorage after login</li>
              <li>Token not being included in API requests</li>
              <li>Token format incorrect (missing "Token " prefix)</li>
              <li>CORS issues preventing requests from reaching the backend</li>
              <li>Token expired or invalid</li>
              <li>Backend not properly extracting or validating the token</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">5. Debugging Steps</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check if token exists in localStorage</li>
              <li>Verify token format is correct</li>
              <li>Inspect network requests to ensure token is being sent</li>
              <li>Test token validation endpoint to check if token is still valid</li>
              <li>Check backend logs for authentication errors</li>
              <li>Verify CORS settings allow requests from your frontend origin</li>
              <li>Try logging out and logging in again to get a fresh token</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
