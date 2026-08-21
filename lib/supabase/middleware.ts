import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_ROLE_COOKIE,
  isWorkerRole,
  resolveActiveRole,
} from '@/lib/account-roles';
import { resolveWorkerFeatureModuleState, type WorkerFeatureModuleState, type WorkerModuleRole } from '@/lib/worker-modules';

type WorkerMembershipForAccess = {
  member_role?: string | null;
};

const workerRolePriority: WorkerModuleRole[] = ['owner', 'manager', 'technician', 'bill_collector', 'sales_inventory'];


function getWorkerUnitRole(memberships: WorkerMembershipForAccess[] = []): WorkerModuleRole {
  const roles = memberships.map((item) => item.member_role).filter(Boolean);
  for (const role of workerRolePriority) {
    if (roles.includes(role)) return role;
  }
  return 'worker';
}


function canOpenWorkerPath(path: string, unitRole: WorkerModuleRole, enabledFeatures: WorkerFeatureModuleState) {
  if (path === '/worker' || path.startsWith('/worker/profile')) return true;
  if (path.startsWith('/worker/billgo')) return enabledFeatures.billgo;
  if (path.startsWith('/worker/inventory') || path.startsWith('/worker/sales')) return enabledFeatures.sales;
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
        maxAge: 60 * 60 * 24 * 30, // 30 ngay (tinh bang giay)
      },
    }
  );

  // Refresh session. Avoid writing logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = [
    '/login',
    '/register',
    '/',
    '/offline-sw.js',
    '/site.webmanifest',
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
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
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/redirect';
    return NextResponse.redirect(url);
  }

  if (user) {
    const [{ data: profile }, { data: worker }, { data: userRoles }, { data: memberships }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),
      supabase
        .from('workers')
        .select('status, specialties')
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

      if (path.startsWith('/admin') && role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }

      if (path.startsWith('/worker') && !isWorkerRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }

      const workerMemberships = ((memberships || []) as WorkerMembershipForAccess[]);
      const workerUnitRole = getWorkerUnitRole(workerMemberships);
      const enabledWorkerFeatures = resolveWorkerFeatureModuleState({
        role: workerUnitRole,
        specialties: worker?.specialties,
      });

      if (path.startsWith('/worker') && !canOpenWorkerPath(path, workerUnitRole, enabledWorkerFeatures)) {
        const url = request.nextUrl.clone();
        url.pathname = '/worker/profile';
        return NextResponse.redirect(url);
      }

      if ((path.startsWith('/dashboard') || path.startsWith('/customer')) && role !== 'customer') {
        const url = request.nextUrl.clone();
        url.pathname = '/redirect';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
