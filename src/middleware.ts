import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Silently handle stray tooling requests that the browser or extensions may make.
  // This prevents noisy 404s in dev logs without affecting app behavior.
  const { pathname } = request.nextUrl
  if (pathname === '/@vite/client') {
    return NextResponse.json({}, { status: 204 })
  }

  // Backward compatibility: redirect legacy /semester/7 or /semester/s7 to default specialization
  if (pathname.startsWith('/semester/')) {
    const id = pathname.split('/')[2] || ''
    const lower = id.toLowerCase()
    if (lower === '7' || lower === 's7') {
      const url = request.nextUrl.clone()
      url.pathname = '/semester/s7_bigdata_ai'
      return NextResponse.redirect(url)
    }
    if (lower === '8' || lower === 's8') {
      const url = request.nextUrl.clone()
      url.pathname = '/semester/s8_bigdata_ai'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/:path*'],
}
