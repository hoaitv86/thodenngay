import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  getBillGoBillingPeriod,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoNextPeriodStartDate,
  getBillGoStoredStatus,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";

const allowedCycles = new Set(BILLGO_CYCLE_OPTIONS.map(option => option.value));
const allowedPaymentMethods = new Set(["cash", "bank_transfer", "other"]);

type WorkerContext = {
  admin: SupabaseClient;
  userId: string;
  workerId: string;
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const getAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getWorkerContext = async (): Promise<WorkerContext | NextResponse> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Bạn chưa đăng nhập.", 401);

  const { data: worker } = await supabase.from("workers").select("id").eq("user_id", user.id).single();
  if (!worker) return jsonError("Không tìm thấy hồ sơ thợ.", 403);

  return { admin: getAdmin() || supabase, userId: user.id, workerId: worker.id };
};

const asText = (value: unknown) => String(value || "").trim();

const resolveBillGoArea = async (
  db: SupabaseClient,
  userId: string,
  areaId: string | null,
  areaName: string,
  subAreaId: string | null,
  subAreaName: string,
) => {
  let resolvedAreaId = areaId;
  let resolvedSubAreaId = subAreaId;

  if (!resolvedAreaId && areaName) {
    const { data: existingArea } = await db
      .from("areas")
      .select("id")
      .eq("owner_id", userId)
      .ilike("name", areaName)
      .maybeSingle();

    if (existingArea?.id) {
      resolvedAreaId = existingArea.id;
    } else {
      const { data: createdArea, error: areaError } = await db
        .from("areas")
        .insert({
          name: areaName,
          area_type: "commune",
          owner_id: userId,
          created_by: userId,
        })
        .select("id")
        .single();
      if (areaError) return { error: areaError.message };
      resolvedAreaId = createdArea.id;
    }
  }

  if (resolvedAreaId && !resolvedSubAreaId && subAreaName) {
    const { data: existingSubArea } = await db
      .from("sub_areas")
      .select("id")
      .eq("area_id", resolvedAreaId)
      .ilike("name", subAreaName)
      .maybeSingle();

    if (existingSubArea?.id) {
      resolvedSubAreaId = existingSubArea.id;
    } else {
      const { data: createdSubArea, error: subAreaError } = await db
        .from("sub_areas")
        .insert({
          area_id: resolvedAreaId,
          name: subAreaName,
          sub_area_type: "village",
          created_by: userId,
        })
        .select("id")
        .single();
      if (subAreaError) return { error: subAreaError.message };
      resolvedSubAreaId = createdSubArea.id;
    }
  }

  return { areaId: resolvedAreaId, subAreaId: resolvedSubAreaId };
};

const todayInputForServer = () => toBillGoDateInput(new Date());

const parseMonthFilter = (value: string) => {
  const [rawYear, rawMonth] = value.split("-").map(Number);
  const today = new Date();
  const year = rawYear || today.getFullYear();
  const month = rawMonth && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : today.getMonth() + 1;
  return { year, month };
};

const monthStartInput = (year: number, month: number) =>
  toBillGoDateInput(new Date(year, month - 1, 1));

const getBillingParts = (collectionMonth: string) => {
  const date = new Date(collectionMonth);
  return {
    billingMonth: date.getMonth() + 1,
    billingYear: date.getFullYear(),
  };
};

const firstOfMonth = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
};

const addMonths = (value: string | Date, months: number) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date();
  date.setMonth(date.getMonth() + months);
  return date;
};

const endOfMonth = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return toBillGoDateInput(new Date());
  return toBillGoDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const buildCoverageMonths = (periodStart: string, paidMonths: number, bonusMonths: number) => {
  const paid = Array.from({ length: paidMonths }, (_, index) => ({
    covered_month: firstOfMonth(addMonths(periodStart, index)),
    coverage_type: "paid",
  }));
  const promo = Array.from({ length: bonusMonths }, (_, index) => ({
    covered_month: firstOfMonth(addMonths(periodStart, paidMonths + index)),
    coverage_type: "promo",
  }));
  return [...paid, ...promo];
};

const buildReceivableDraft = (
  subscription: {
    id: string;
    customer_id?: string | null;
    worker_id?: string | null;
    package_name?: string | null;
    current_cycle?: string | null;
    cycle?: string | null;
    monthly_fee?: number | string | null;
    amount_per_cycle?: number | string | null;
  },
  userId: string,
  periodStart: string,
) => {
  const cycle = String(subscription.current_cycle || subscription.cycle || "monthly") as BillGoCycle;
  const option = getBillGoCycleOption(cycle);
  const monthlyFee = toMoneyNumber(subscription.monthly_fee ?? subscription.amount_per_cycle);
  const billing = getBillGoBillingPeriod(periodStart, cycle);
  const billingParts = getBillingParts(billing.collectionMonth);
  const nextPeriodStart = getBillGoNextPeriodStartDate(billing.periodEnd);
  const nextBilling = getBillGoBillingPeriod(nextPeriodStart, cycle);

  return {
    customer_id: subscription.customer_id,
    worker_id: subscription.worker_id,
    subscription_id: subscription.id,
    type: "subscription_fee",
    title: `Thu cước ${subscription.package_name || "Internet"}`,
    total_amount: getBillGoCollectableAmount(monthlyFee, cycle),
    due_date: billing.dueDate,
    period_start: billing.periodStart,
    period_end: billing.periodEnd,
    collection_month: billing.collectionMonth,
    usage_month: billing.usageMonth,
    billing_month: billingParts.billingMonth,
    billing_year: billingParts.billingYear,
    cycle_at_collection: cycle,
    billing_months: option.paidMonths,
    bonus_months: option.bonusMonths,
    service_months: option.paidMonths + option.bonusMonths,
    paid_amount: 0,
    monthly_fee_at_collection: monthlyFee,
    next_period_start: nextPeriodStart,
    next_due_date: nextBilling.dueDate,
    status: "unpaid",
    created_by: userId,
  };
};

const ensureDueReceivables = async (
  admin: SupabaseClient,
  workerId: string,
  userId: string,
  monthFilter: string,
) => {
  const { year, month } = parseMonthFilter(monthFilter);
  const collectionMonth = monthStartInput(year, month);
  const billingParts = getBillingParts(collectionMonth);

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("billgo_subscriptions")
    .select("id, customer_id, worker_id, customer_name, package_name, current_cycle, cycle, monthly_fee, amount_per_cycle, status, deleted_at, start_date, next_period_start")
    .eq("worker_id", workerId)
    .eq("status", "active")
    .is("deleted_at", null);
  if (subscriptionError) return { error: subscriptionError.message };

  const { data: existing, error: existingError } = await admin
    .from("billgo_receivables")
    .select("subscription_id")
    .eq("worker_id", workerId)
    .eq("billing_month", billingParts.billingMonth)
    .eq("billing_year", billingParts.billingYear)
    .is("deleted_at", null)
    .not("subscription_id", "is", null);
  if (existingError) return { error: existingError.message };

  const existingSubscriptionIds = new Set((existing || []).map(row => row.subscription_id));
  const rowsToCreate = (subscriptions || []).flatMap(subscription => {
    if (existingSubscriptionIds.has(subscription.id)) return [];
    const periodStart = firstOfMonth(subscription.next_period_start || subscription.start_date || collectionMonth);
    const billing = getBillGoBillingPeriod(periodStart, subscription.current_cycle || subscription.cycle || "monthly");
    if (billing.collectionMonth !== collectionMonth) return [];
    return [buildReceivableDraft(subscription, userId, periodStart)];
  });

  if (rowsToCreate.length === 0) return { created: 0 };
  const { error: insertError } = await admin.from("billgo_receivables").insert(rowsToCreate);
  if (insertError && insertError.code !== "23505") return { error: insertError.message };
  return { created: insertError?.code === "23505" ? 0 : rowsToCreate.length };
};

export async function GET(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId, workerId } = context;

  const { searchParams } = new URL(request.url);
  const monthFilter = searchParams.get("month") || todayInputForServer().slice(0, 7);
  const { year, month } = parseMonthFilter(monthFilter);
  const ensured = await ensureDueReceivables(admin, workerId, userId, monthFilter);
  if (ensured.error) return jsonError(ensured.error);

  const { data, error } = await admin
    .from("billgo_receivables")
    .select("id, total_amount, due_date, period_start, period_end, collection_month, usage_month, billing_month, billing_year, cycle_at_collection, billing_months, bonus_months, service_months, next_due_date, paid_amount, paid_at, payment_method, status, note, subscription:billgo_subscriptions(id, customer_name, phone, internet_account, customer_address, area_id, sub_area_id, address_detail, legacy_address, provider, package_name, cycle, current_cycle, amount_per_cycle, monthly_fee, next_period_start, next_due_date, covered_until, status, note, created_at, billgo_cycle_changes(id, old_cycle, new_cycle, effective_period_start, note, created_at), billgo_status_events(id, event_type, effective_period_start, note, created_at)), payments(id, amount, method, status, paid_at, note)")
    .eq("worker_id", workerId)
    .eq("billing_month", month)
    .eq("billing_year", year)
    .not("subscription_id", "is", null)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (error) return jsonError("Không thể tải BillGo: " + error.message);
  return NextResponse.json({ rows: data || [], created: ensured.created || 0 });
}

export async function POST(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId, workerId } = context;

  const body = await request.json();
  const customerName = asText(body.customerName);
  const phone = asText(body.phone);
  const account = asText(body.account);
  const address = asText(body.address);
  const requestedAreaId = asText(body.areaId) || null;
  const requestedSubAreaId = asText(body.subAreaId) || null;
  const areaName = asText(body.areaName);
  const subAreaName = asText(body.subAreaName);
  const addressDetail = asText(body.addressDetail);
  const provider = asText(body.provider);
  const packageName = asText(body.packageName) || "Cước Internet";
  const monthlyFee = toMoneyNumber(body.monthlyFee ?? body.amount);
  const cycle = asText(body.cycle) || "monthly";
  const startDate = asText(body.startDate);
  const dueDate = asText(body.dueDate);
  const note = asText(body.note);
  const initialPaidAmount = toMoneyNumber(body.initialPaidAmount);
  const initialPaidAt = asText(body.initialPaidAt) || new Date().toISOString();
  const initialPaymentMethod = allowedPaymentMethods.has(asText(body.initialPaymentMethod)) ? asText(body.initialPaymentMethod) : "cash";

  if (!customerName || !account || (!address && !addressDetail) || !startDate || monthlyFee < 0 || !allowedCycles.has(cycle as BillGoCycle)) {
    return jsonError("Vui lòng nhập đầy đủ thông tin hợp lệ.");
  }

  const { data: duplicate } = await admin
    .from("billgo_subscriptions")
    .select("id")
    .eq("worker_id", workerId)
    .ilike("internet_account", account)
    .is("deleted_at", null)
    .not("status", "in", "(cancelled,deleted)")
    .maybeSingle();
  if (duplicate) return jsonError("Account này đã có trong BillGo.", 409);

  const billing = getBillGoBillingPeriod(startDate, cycle);
  const billingParts = getBillingParts(billing.collectionMonth);
  const billingOption = getBillGoCycleOption(cycle);
  const nextPeriodStart = getBillGoNextPeriodStartDate(billing.periodEnd);
  const nextBilling = getBillGoBillingPeriod(nextPeriodStart, cycle);
  const totalAmount = getBillGoCollectableAmount(monthlyFee, cycle);
  const paidAmount = Math.min(Math.max(initialPaidAmount, 0), totalAmount);
  const receivableStatus = getBillGoStoredStatus(totalAmount, paidAmount, dueDate || billing.dueDate);
  const location = await resolveBillGoArea(admin, userId, requestedAreaId, areaName, requestedSubAreaId, subAreaName);
  if ("error" in location) return jsonError(location.error || "Không thể tạo địa bàn khách hàng.");

  const { data: subscription, error: subscriptionError } = await admin
    .from("billgo_subscriptions")
    .insert({
      customer_id: null,
      worker_id: workerId,
      customer_name: customerName,
      phone,
      internet_account: account,
      customer_address: address,
      area_id: location.areaId,
      sub_area_id: location.subAreaId,
      address_detail: addressDetail,
      legacy_address: address || null,
      provider: provider || null,
      package_name: packageName,
      service_type: "internet",
      cycle,
      current_cycle: cycle,
      amount_per_cycle: monthlyFee,
      monthly_fee: monthlyFee,
      start_date: billing.periodStart,
      next_due_date: dueDate || billing.dueDate,
      next_period_start: billing.periodStart,
      status: "active",
      note,
      created_by: userId,
      last_changed_by: userId,
    })
    .select("id")
    .single();
  if (subscriptionError) return jsonError(subscriptionError.message);

  const { data: receivable, error: receivableError } = await admin
    .from("billgo_receivables")
    .insert({
      customer_id: null,
      worker_id: workerId,
      subscription_id: subscription.id,
      type: "subscription_fee",
      title: `Thu cước ${packageName}`,
      total_amount: totalAmount,
      due_date: dueDate || billing.dueDate,
      period_start: billing.periodStart,
      period_end: billing.periodEnd,
      collection_month: billing.collectionMonth,
      usage_month: billing.usageMonth,
      billing_month: billingParts.billingMonth,
      billing_year: billingParts.billingYear,
      cycle_at_collection: cycle,
      billing_months: billing.billingMonths,
      bonus_months: billing.bonusMonths,
      service_months: billingOption.paidMonths + billingOption.bonusMonths,
      paid_amount: paidAmount,
      monthly_fee_at_collection: monthlyFee,
      paid_at: paidAmount > 0 ? initialPaidAt : null,
      payment_method: paidAmount > 0 ? initialPaymentMethod : null,
      collected_by: paidAmount > 0 ? userId : null,
      next_period_start: nextPeriodStart,
      next_due_date: nextBilling.dueDate,
      status: receivableStatus,
      note,
      created_by: userId,
    })
    .select("id, period_start, period_end, billing_months, bonus_months")
    .single();

  if (receivableError) {
    await admin.from("billgo_subscriptions").delete().eq("id", subscription.id);
    return jsonError(receivableError.message);
  }

  if (paidAmount > 0) {
    const { data: payment } = await admin
      .from("payments")
      .insert({
        job_id: null,
        receivable_id: receivable.id,
        amount: paidAmount,
        method: initialPaymentMethod,
        status: "paid",
        paid_at: initialPaidAt,
        collected_by: userId,
        note: "Thanh toán ban đầu khi tạo khách BillGo",
      })
      .select("id")
      .single();

    if (paidAmount >= totalAmount) {
      await admin.from("billgo_payment_coverages").insert(
        buildCoverageMonths(receivable.period_start, receivable.billing_months, receivable.bonus_months).map(month => ({
          ...month,
          payment_id: payment?.id || null,
          receivable_id: receivable.id,
          subscription_id: subscription.id,
        })),
      );
      await admin
        .from("billgo_subscriptions")
        .update({ covered_until: receivable.period_end, next_period_start: nextPeriodStart, next_due_date: nextBilling.dueDate })
        .eq("id", subscription.id);
    }
  }

  return NextResponse.json({ subscriptionId: subscription.id, receivableId: receivable.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getWorkerContext();
  if (context instanceof NextResponse) return context;
  const { admin, userId, workerId } = context;

  const body = await request.json();
  const action = asText(body.action);

  if (action === "update_customer") {
    const subscriptionId = asText(body.subscriptionId);
    const monthlyFee = toMoneyNumber(body.monthlyFee);
    if (!subscriptionId || monthlyFee < 0) return jsonError("Thông tin khách hàng không hợp lệ.");
    const requestedAreaId = asText(body.areaId) || null;
    const requestedSubAreaId = asText(body.subAreaId) || null;
    const areaName = asText(body.areaName);
    const subAreaName = asText(body.subAreaName);
    const nextAddressDetail = asText(body.addressDetail);
    const location = await resolveBillGoArea(admin, userId, requestedAreaId, areaName, requestedSubAreaId, subAreaName);
    if ("error" in location) return jsonError(location.error || "Không thể tạo địa bàn khách hàng.");
    const nextAreaId = location.areaId;
    const nextSubAreaId = location.subAreaId;

    const { data: currentSubscription } = await admin
      .from("billgo_subscriptions")
      .select("id, area_id, sub_area_id, address_detail, current_cycle, cycle")
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .maybeSingle();

    const { error } = await admin
      .from("billgo_subscriptions")
      .update({
        customer_name: asText(body.customerName),
        phone: asText(body.phone),
        internet_account: asText(body.account),
        customer_address: asText(body.address),
        area_id: nextAreaId,
        sub_area_id: nextSubAreaId,
        address_detail: nextAddressDetail,
        provider: asText(body.provider) || null,
        package_name: asText(body.packageName) || "Cước Internet",
        monthly_fee: monthlyFee,
        amount_per_cycle: monthlyFee,
        note: asText(body.note),
        last_changed_by: userId,
      })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);
    const currentMonth = monthStartInput(new Date().getFullYear(), new Date().getMonth() + 1);
    const currentParts = getBillingParts(currentMonth);
    const currentCycle = String(currentSubscription?.current_cycle || currentSubscription?.cycle || "monthly");
    const currentUnpaidAmount = getBillGoCollectableAmount(monthlyFee, currentCycle);
    await admin
      .from("billgo_receivables")
      .update({
        total_amount: currentUnpaidAmount,
        monthly_fee_at_collection: monthlyFee,
        status: "unpaid",
      })
      .eq("subscription_id", subscriptionId)
      .eq("billing_month", currentParts.billingMonth)
      .eq("billing_year", currentParts.billingYear)
      .eq("worker_id", workerId)
      .eq("paid_amount", 0)
      .in("status", ["unpaid", "overdue", "not_due", "due"]);
    if (
      currentSubscription
      && (currentSubscription.area_id !== nextAreaId || currentSubscription.sub_area_id !== nextSubAreaId || (currentSubscription.address_detail || "") !== nextAddressDetail)
    ) {
      await admin.from("billgo_area_changes").insert({
        subscription_id: subscriptionId,
        old_area_id: currentSubscription.area_id,
        old_sub_area_id: currentSubscription.sub_area_id,
        new_area_id: nextAreaId,
        new_sub_area_id: nextSubAreaId,
        old_address_detail: currentSubscription.address_detail,
        new_address_detail: nextAddressDetail,
        changed_by: userId,
        note: "Cập nhật địa bàn khách BillGo",
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "change_cycle") {
    const subscriptionId = asText(body.subscriptionId);
    const newCycle = asText(body.cycle);
    const note = asText(body.note);
    if (!subscriptionId || !allowedCycles.has(newCycle as BillGoCycle)) return jsonError("Hình thức đóng không hợp lệ.");

    const { data: subscription, error: subscriptionError } = await admin
      .from("billgo_subscriptions")
      .select("id, current_cycle, cycle, covered_until, next_period_start")
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .single();
    if (subscriptionError || !subscription) return jsonError("Không tìm thấy khách hàng BillGo.", 404);

    const effectivePeriodStart = asText(body.effectivePeriodStart)
      || (subscription.covered_until ? getBillGoNextPeriodStartDate(subscription.covered_until) : subscription.next_period_start)
      || todayInputForServer();
    const oldCycle = String(subscription.current_cycle || subscription.cycle || "monthly");

    const { error: updateError } = await admin
      .from("billgo_subscriptions")
      .update({ current_cycle: newCycle, cycle: newCycle, next_period_start: effectivePeriodStart, last_changed_by: userId })
      .eq("id", subscriptionId);
    if (updateError) return jsonError(updateError.message);

    await admin.from("billgo_cycle_changes").insert({
      subscription_id: subscriptionId,
      old_cycle: oldCycle,
      new_cycle: newCycle,
      effective_period_start: effectivePeriodStart,
      changed_by: userId,
      note,
    });
    return NextResponse.json({ ok: true, effectivePeriodStart });
  }

  if (action === "pause" || action === "reactivate") {
    const subscriptionId = asText(body.subscriptionId);
    const effectivePeriodStart = asText(body.effectivePeriodStart) || todayInputForServer();
    const note = asText(body.note);
    if (!subscriptionId) return jsonError("Thiếu khách hàng BillGo.");

    const update = action === "pause"
      ? { status: "paused", paused_at: new Date().toISOString(), last_changed_by: userId }
      : { status: "active", reactivated_at: new Date().toISOString(), reactivated_period_start: effectivePeriodStart, next_period_start: effectivePeriodStart, last_changed_by: userId };

    const { error } = await admin
      .from("billgo_subscriptions")
      .update(update)
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);

    await admin.from("billgo_status_events").insert({
      subscription_id: subscriptionId,
      event_type: action === "pause" ? "paused" : "reactivated",
      effective_period_start: effectivePeriodStart,
      performed_by: userId,
      note,
    });
    if (action === "reactivate") {
      const monthFilter = effectivePeriodStart.slice(0, 7);
      await ensureDueReceivables(admin, workerId, userId, monthFilter);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "soft_delete") {
    const subscriptionId = asText(body.subscriptionId);
    const note = asText(body.note);
    if (!subscriptionId) return jsonError("Thiếu khách hàng BillGo.");

    const deletedAt = new Date().toISOString();
    const { error } = await admin
      .from("billgo_subscriptions")
      .update({ status: "deleted", deleted_at: deletedAt, last_changed_by: userId })
      .eq("id", subscriptionId)
      .eq("worker_id", workerId)
      .is("deleted_at", null);
    if (error) return jsonError(error.message);

    await admin
      .from("billgo_receivables")
      .update({ status: "deleted", deleted_at: deletedAt, deleted_by: userId })
      .eq("subscription_id", subscriptionId)
      .in("status", ["unpaid", "partial", "overdue"]);

    await admin.from("billgo_status_events").insert({
      subscription_id: subscriptionId,
      event_type: "deleted",
      performed_by: userId,
      note,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "assign_area_bulk") {
    const subscriptionIds = Array.isArray(body.subscriptionIds) ? body.subscriptionIds.map(asText).filter(Boolean) : [];
    const areaId = asText(body.areaId) || null;
    const subAreaId = asText(body.subAreaId) || null;
    const addressDetail = asText(body.addressDetail);
    const note = asText(body.note);
    if (subscriptionIds.length === 0 || !areaId) return jsonError("Vui lòng chọn khách và xã cần gán.");

    const { data: subscriptions, error: loadError } = await admin
      .from("billgo_subscriptions")
      .select("id, area_id, sub_area_id, address_detail")
      .eq("worker_id", workerId)
      .in("id", subscriptionIds)
      .is("deleted_at", null);
    if (loadError) return jsonError(loadError.message);

    const { error: updateError } = await admin
      .from("billgo_subscriptions")
      .update({ area_id: areaId, sub_area_id: subAreaId, address_detail: addressDetail || undefined, last_changed_by: userId })
      .eq("worker_id", workerId)
      .in("id", subscriptionIds);
    if (updateError) return jsonError(updateError.message);

    const historyRows = (subscriptions || []).map(subscription => ({
      subscription_id: subscription.id,
      old_area_id: subscription.area_id,
      old_sub_area_id: subscription.sub_area_id,
      new_area_id: areaId,
      new_sub_area_id: subAreaId,
      old_address_detail: subscription.address_detail,
      new_address_detail: addressDetail || subscription.address_detail,
      changed_by: userId,
      note,
    }));
    if (historyRows.length > 0) await admin.from("billgo_area_changes").insert(historyRows);
    return NextResponse.json({ ok: true, updated: subscriptionIds.length });
  }

  if (action !== "collect") return jsonError("Hành động BillGo không hợp lệ.");

  const receivableId = asText(body.receivableId);
  const paidAmount = toMoneyNumber(body.amount);
  const paidAt = asText(body.paidAt) || new Date().toISOString();
  const method = allowedPaymentMethods.has(asText(body.method)) ? asText(body.method) : "cash";
  const note = asText(body.note);

  if (!receivableId || paidAmount < 0) return jsonError("Thông tin thu tiền không hợp lệ.");

  const { data: receivable, error: receivableError } = await admin
    .from("billgo_receivables")
    .select("id, worker_id, subscription_id, total_amount, due_date, period_start, period_end, cycle_at_collection, billing_months, bonus_months, paid_amount, status, monthly_fee_at_collection, subscription:billgo_subscriptions(current_cycle, cycle)")
    .eq("id", receivableId)
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .single();

  if (receivableError || !receivable) return jsonError("Không tìm thấy kỳ cước.", 404);
  if (receivable.status === "paid" || receivable.status === "promo") return jsonError("Kỳ cước này đã được xử lý.", 409);

  const alreadyPaid = toMoneyNumber(receivable.paid_amount);
  const nextPaid = alreadyPaid + paidAmount;
  if (paidAmount <= 0) return jsonError("Số tiền thực thu phải lớn hơn 0.");
  if (alreadyPaid >= toMoneyNumber(receivable.total_amount)) return jsonError("Không thể xác nhận trùng kỳ.", 409);

  const nextStatus = getBillGoStoredStatus(toMoneyNumber(receivable.total_amount), nextPaid, receivable.due_date);
  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      job_id: null,
      receivable_id: receivable.id,
      amount: paidAmount,
      method,
      status: "paid",
      paid_at: paidAt,
      collected_by: userId,
      note,
    })
    .select("id")
    .single();
  if (paymentError) return jsonError(paymentError.message);

  const { error: updateError } = await admin
    .from("billgo_receivables")
    .update({
      paid_amount: nextPaid,
      paid_at: paidAt,
      payment_method: method,
      collected_by: userId,
      status: nextStatus,
      note: note || undefined,
    })
    .eq("id", receivable.id);
  if (updateError) return jsonError(updateError.message);

  if (nextPaid >= toMoneyNumber(receivable.total_amount) && receivable.subscription_id) {
    const coverages = buildCoverageMonths(receivable.period_start, receivable.billing_months, receivable.bonus_months).map(month => ({
      ...month,
      payment_id: payment.id,
      receivable_id: receivable.id,
      subscription_id: receivable.subscription_id,
    }));
    const { error: coverageError } = await admin.from("billgo_payment_coverages").insert(coverages);
    if (coverageError) return jsonError("Không thể lưu tháng bao phủ hoặc kỳ này đã được thu: " + coverageError.message, 409);

    const nextStart = getBillGoNextPeriodStartDate(receivable.period_end);
    const subscriptionRelation = Array.isArray(receivable.subscription) ? receivable.subscription[0] : receivable.subscription;
    const nextCycle = String(subscriptionRelation?.current_cycle || subscriptionRelation?.cycle || receivable.cycle_at_collection || "monthly");
    const nextBilling = getBillGoBillingPeriod(nextStart, nextCycle);
    await admin
      .from("billgo_subscriptions")
      .update({
        covered_until: receivable.period_end,
        next_period_start: nextStart,
        next_due_date: nextBilling.dueDate,
        last_changed_by: userId,
      })
      .eq("id", receivable.subscription_id);

    if (receivable.bonus_months > 0) {
      const cycle = getBillGoCycleOption("yearly");
      const promoStart = toBillGoDateInput(addMonths(receivable.period_start, cycle.paidMonths));
      await admin.from("billgo_receivables").insert({
        worker_id: workerId,
        subscription_id: receivable.subscription_id,
        type: "subscription_fee",
        title: "Tháng khuyến mại BillGo",
        total_amount: 0,
        due_date: promoStart,
        period_start: promoStart,
        period_end: endOfMonth(promoStart),
        collection_month: firstOfMonth(promoStart),
        usage_month: firstOfMonth(promoStart),
        billing_month: getBillingParts(firstOfMonth(promoStart)).billingMonth,
        billing_year: getBillingParts(firstOfMonth(promoStart)).billingYear,
        cycle_at_collection: "yearly",
        billing_months: 0,
        bonus_months: 1,
        service_months: 1,
        next_due_date: nextBilling.dueDate,
        paid_amount: 0,
        status: "promo",
        created_by: userId,
      });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
