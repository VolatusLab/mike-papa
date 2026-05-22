import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabase } from '@/lib/supabase/middleware';

// Paths that are always public (auth flow + static-ish).
const PUBLIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]);

// Path prefixes that require an authenticated session.
const PROTECTED_PREFIXES = ['/dashboard', '/admin'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthScreen(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always let static-ish + auth callback through with cookie refresh only.
  const { supabase, response } = createMiddlewareSupabase(request);

  // IMPORTANT: do not run code between createMiddlewareSupabase and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAuthScreen(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!user && isProtected(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Public pages and authenticated-allowed paths: pass through with refreshed cookies.
  void PUBLIC_PATHS; // keep set referenced for future use
  return response;
}

export const config = {
  matcher: [
    // Run on everything except next internals, favicons, and asset files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
