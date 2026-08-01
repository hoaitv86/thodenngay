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
  unit?: { module_flags?: unknown } | Array<{ module_flags?: unknown }> | null;
};

const workerRolePriority: WorkerModuleRole[] = ['owner', 'manager', 'technician', 'bill_collector', 'sales_inventory'];

function firstMembershipUnit(row?: WorkerMembershipForAccess | null) {
  if (!row?.unit) return null;
  return Array.isArray(row.unit) ? row.unit[0] : row.unit;
}

function isMissingModuleFlagsError(message?: string) {
  return Boolean(message && message.includes('module_flags'));
}

function getWorkerUnitRole(memberships: WorkerMembershipForAccess[] = []): WorkerModuleRole {
  const roles = memberships.map((item) => item.member_role).filter(Boolean);
  for (const role of workerRolePriority) {
    if (roles.includes(role)) return role;
  }
  return 'worker';
}

function getWorkerUnitModuleFlags(memberships: WorkerMembershipForAccess[] = []) {
  const selectedMembership = workerRolePriority
    .map((role) => memberships.find((item) => item.member_role === role))
    .find(Boolean);
  return firstMembershipUnit(selectedMembership)?.module_flags;
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
    const [{ data: profile }, { data: userRoles }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_roles')
        .select('role, is_active')
        .eq('user_id', user.id),
    ]);

    let workerResult = await supabase
      .from('workers')
      .select('status, specialties, module_flags')
      .eq('user_id', user.id)
      .maybeSingle();
    if (workerResult.error && isMissingModuleFlagsError(workerResult.error.message)) {
      workerResult = await supabase
        .from('workers')
        .select('status, specialties')
        .eq('user_id', user.id)
        .maybeSingle();
    }
    const worker = workerResult.data;

    const membershipsWithModules = await supabase
      .from('worker_unit_members')
      .select('member_role, unit:worker_units(module_flags)')
      .eq('user_id', user.id)
      .eq('status', 'active');
    let memberships: unknown[] | null = membershipsWithModules.data;
    if (membershipsWithModules.error && isMissingModuleFlagsError(membershipsWithModules.error.message)) {
      const fallbackMemberships = await supabase
        .from('worker_unit_members')
        .select('member_role')
        .eq('user_id', user.id)
        .eq('status', 'active');
      memberships = fallbackMemberships.data;
    }

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
        accountFlags: worker?.module_flags,
        unitFlags: getWorkerUnitModuleFlags(workerMemberships),
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
