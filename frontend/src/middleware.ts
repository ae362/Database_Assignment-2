import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // If this is an admin route, let the admin layout handle it
  if (path.startsWith("/admin")) {
    return NextResponse.next()
  }

  // Get the pathname
  const path2 = request.nextUrl.pathname

  // Allow debug paths without authentication
  if (
    path2.startsWith("/debug") ||
    path2.startsWith("/api-debug") ||
    path2.startsWith("/system-debug") ||
    path2.startsWith("/auth-debug")
  ) {
    return NextResponse.next()
  }

  // All other paths will use client-side auth

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
