import { NextResponse } from 'next/server';

// Edge-runtime middleware. We can't import bcrypt or jsonwebtoken here
// (Node-only modules), so we just check for the presence of the session
// cookie. Cryptographic verification + Mongo lookup happens in each
// Server Component via lib/admin/serverAuth.requireAdmin().

const SESSION_COOKIE = 'det.admin';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public admin routes — login + the static assets behind /_next.
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/_') ||
    !pathname.startsWith('/admin')
  ) {
    return NextResponse.next();
  }

  const hasCookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
