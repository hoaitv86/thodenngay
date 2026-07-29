import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_ROLE_COOKIE,
  isWorkerRole,
  resolveActiveRole,
} from '@/lib/account-roles';

function getWorkerUnitRole(memberships: Array<{ member_role?: string | null }> = []) {
  const roles = memberships.map((item) => item.member_role).filter(Boolean);
  for (const role of ['owner', 'manager', 'technician', 'bill_collector', 'sales_inventory']) {
    if (roles.includes(role)) return role;
  }
  return 'worker';
}

function canOpenWorkerPath(path: string, unitRole: string) {
  if (path === '/worker' || path.startsWith('/worker/profile')) return true;
  if (path.startsWith('/worker/billgo')) return ['owner', 'manager', 'bill_collector'].includes(unitRole);
  if (path.startsWith('/worker/inventory') || path.startsWith('/worker/sales')) return ['owner', 'manager', 'sales_inventory'].includes(unitRole);
  if (path.startsWith('/worker/jobs') || path.startsWith('/worker/customers') || path.startsWith('/worker/history') || path.startsWith('/worker/chat')) return ['owner', 'manager', 'technician', 'worker'].includes(unitRole);
  if (path.startsWith('/worker/wallet')) return ['owner', 'manager'].includes(unitRole);
  return true;
}

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
  const publicPaths = [
    '/login',
    '/register',
    '/',
    '/ve-chung-toi',
    '/dieu-khoan-su-dung',
    '/chinh-sach-bao-mat',
    '/chinh-sach-tho',
    '/chinh-sach-khach-hang',
  ];
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
    const [{ data: profile }, { data: worker }, { data: userRoles }, { data: memberships }] = await Promise.all([
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
      supabase
        .from('worker_unit_members')
        .select('member_role')
        .eq('user_id', user.id)
        .eq('status', 'active'),
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

      if (path.startsWith('/worker') && !canOpenWorkerPath(path, getWorkerUnitRole(memberships || []))) {
        const url = request.nextUrl.clone();
        url.pathname = '/worker/profile';
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
