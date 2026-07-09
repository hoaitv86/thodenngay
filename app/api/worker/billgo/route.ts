import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBillGoBillingPeriod, getBillGoStoredStatus } from "@/lib/billgo";

const allowedCycles = new Set(["monthly", "three_months", "six_months", "yearly"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ban chua dang nhap." }, { status: 401 });

  const { data: worker } = await supabase
    .from("workers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!worker) return NextResponse.json({ error: "Khong tim thay ho so tho." }, { status: 403 });

  const body = await request.json();
  const customerName = String(body.customerName || "").trim();
  const account = String(body.account || "").trim();
  const address = String(body.address || "").trim();
  const packageName = String(body.packageName || "").trim();
  const amount = Number(body.amount);
  const cycle = String(body.cycle || "monthly");
  const startDate = String(body.startDate || "");
  const collectionStatus = body.collectionStatus === "paid" ? "paid" : "unpaid";

  if (!customerName || !account || !address || !packageName || !startDate || amount < 0 || !allowedCycles.has(cycle)) {
    return NextResponse.json({ error: "Vui long nhap day du thong tin hop le." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "May chu chua cau hinh SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: duplicate } = await admin
    .from("billgo_subscriptions")
    .select("id")
    .eq("worker_id", worker.id)
    .eq("internet_account", account)
    .neq("status", "cancelled")
    .maybeSingle();
  if (duplicate) {
    return NextResponse.json({ error: "Account nay da co trong BillGo." }, { status: 409 });
  }

  const billingPeriod = getBillGoBillingPeriod(startDate, cycle);
  const initialPaid = collectionStatus === "paid" ? amount : 0;
  const receivableStatus = getBillGoStoredStatus(amount, initialPaid, billingPeriod.dueDate);

  const { data: subscription, error: subscriptionError } = await admin
    .from("billgo_subscriptions")
    .insert({
      customer_id: null,
      worker_id: worker.id,
      customer_name: customerName,
      internet_account: account,
      customer_address: address,
      package_name: packageName,
      service_type: "internet",
      cycle,
      amount_per_cycle: amount,
      start_date: billingPeriod.periodStart,
      next_due_date: billingPeriod.dueDate,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
  }

  const { data: receivable, error: receivableError } = await admin
    .from("billgo_receivables")
    .insert({
      customer_id: null,
      worker_id: worker.id,
      subscription_id: subscription.id,
      type: "subscription_fee",
      title: `Thu cuoc ${packageName}`,
      total_amount: amount,
      due_date: billingPeriod.dueDate,
      period_start: billingPeriod.periodStart,
      period_end: billingPeriod.periodEnd,
      billing_months: billingPeriod.billingMonths,
      bonus_months: billingPeriod.bonusMonths,
      status: receivableStatus,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (receivableError) {
    await admin.from("billgo_subscriptions").delete().eq("id", subscription.id);
    return NextResponse.json({ error: receivableError.message }, { status: 400 });
  }

  if (collectionStatus === "paid" && amount > 0) {
    await admin.from("payments").insert({
      job_id: null,
      receivable_id: receivable.id,
      amount,
      method: "cash",
      status: "paid",
      paid_at: new Date().toISOString(),
      collected_by: user.id,
      note: `BillGo initial payment ${randomUUID().slice(0, 8)}`,
    });
  }

  return NextResponse.json({ subscriptionId: subscription.id, receivableId: receivable.id }, { status: 201 });
}
