import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_ROLE_COOKIE,
  isWorkerRole,
  resolveActiveRole,
} from '@/lib/account-roles';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 30, // 30 ngày (tính bằng giây)
      },
    }
  );

  // Refresh session — IMPORTANT: avoid writing logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPaths = ['/login', '/register', '/'];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith('/api/auth')
  );

  if (!user && !isPublicPath) {
    // Redirect to login if not authenticated
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/redirect';
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  if (user) {
    const [{ data: profile }, { data: worker }, { data: userRoles }] = await Promise.all([
      supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
        .single(),
      supabase
        .from('workers')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role, is_active')
        .eq('user_id', user.id),
    ]);

    if (profile) {
      const path = request.nextUrl.pathname;
      const role = resolveActiveRole({
        legacyRole: profile.role,
        worker,
        userRoles: userRoles || [],
        preferredRole: request.cookies.get(ACTIVE_ROLE_COOKIE)?.value,
      });

      // 1. Admin protection
      if (path.startsWith('/admin') && role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }

      // 2. Worker protection
      if (path.startsWith('/worker') && !isWorkerRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }

      // 3. Customer protection (dashboard)
      if ((path.startsWith('/dashboard') || path.startsWith('/customer')) && role !== 'customer') {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
