import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = [
  '/planner', '/create', '/messages', '/notifications', '/profile', '/settings',
  '/dashboard', '/traveler', '/agency', '/guide', '/business', '/admin',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('tvp_token')?.value;

  // Signed in, the planner is the home page. Signed out, "/" stays the public
  // marketing page — redirecting it unconditionally would bounce every visitor
  // to /login, since /planner is protected below.
  if (pathname === '/' && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/planner';
    return NextResponse.redirect(url);
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/planner/:path*',
    '/create/:path*',
    '/messages/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/dashboard/:path*',
    '/dashboard',
    '/traveler/:path*',
    '/agency/:path*',
    '/guide/:path*',
    '/business/:path*',
    '/admin/:path*',
    '/admin',
  ],
};
