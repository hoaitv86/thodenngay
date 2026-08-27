import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { canUseJobs } from "@/lib/worker-unit-permissions";
import { resolveWorkerUnitScope } from "@/lib/worker-unit-server";
import { notifyJobEvent, notifyNextWorkerJob } from "@/lib/notifications/core";

type CompletionMaterialItem = {
  productId?: string;
  quantity?: number;
  unitPrice?: number;
};

type CompleteJobRequest = {
  jobId?: string;
  images?: string[];
  completionItems?: unknown[];
  finalAmount?: number;
  warrantyDays?: number;
  warrantyNote?: string;
  materialItems?: CompletionMaterialItem[];
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const makeSaleCode = () => {
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `JOBSALE-${stamp}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
};

async function getWorkerContext() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Ignored in route handler.
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: jsonError("Không được phép truy cập.", 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "worker") return { error: jsonError("Chỉ tài khoản thợ mới được hoàn thành công việc.", 403) };

  const { data: worker } = await supabase
    .from("workers")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!worker || worker.status !== "active") return { error: jsonError("Chỉ thợ đang hoạt động mới có thể hoàn thành công việc.", 403) };

  const scope = await resolveWorkerUnitScope(supabase as SupabaseClient, user.id, worker.id);
  if (!canUseJobs(scope.role)) return { error: jsonError("Bạn không có quyền hoàn thành công việc.", 403) };

  return { supabase, user };
}

export async function POST(request: Request) {
  try {
    const context = await getWorkerContext();
    if ("error" in context) return context.error;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return jsonError("Thiếu SUPABASE_SERVICE_ROLE_KEY để hoàn thành công việc với vật tư.", 500);

    const body = (await request.json()) as CompleteJobRequest;
    const jobId = (body.jobId || "").trim();
    const completionItems = Array.isArray(body.completionItems) ? body.completionItems : [];
    const materialItems = Array.isArray(body.materialItems) ? body.materialItems : [];
    const images = Array.isArray(body.images) ? body.images.filter((url): url is string => typeof url === "string") : [];
    const finalAmount = Number(body.finalAmount || 0);
    const warrantyDays = Number(body.warrantyDays || 0);
    const warrantyNote = (body.warrantyNote || "").trim();

    if (!jobId) return jsonError("Thiếu mã công việc.");
    if (completionItems.length === 0) return jsonError("Vui lòng nhập hạng mục hoàn thành.");
    if (materialItems.length === 0) return jsonError("Vui lòng chọn vật tư từ kho.");

    const { data: visibleJob, error: visibleJobError } = await context.supabase
      .from("jobs")
      .select("id, worker_id, customer_id, status")
      .eq("id", jobId)
      .in("status", ["assigned", "in_progress"])
      .maybeSingle();

    if (visibleJobError) return jsonError("Không thể kiểm tra công việc: " + visibleJobError.message, 500);
    if (!visibleJob?.worker_id || !visibleJob.customer_id) return jsonError("Công việc không hợp lệ hoặc đã hoàn thành.", 409);

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const saleCode = makeSaleCode();
    const { data: order, error: orderError } = await supabaseAdmin
      .from("worker_sales_orders")
      .insert({
        worker_id: visibleJob.worker_id,
        customer_id: visibleJob.customer_id,
        job_id: jobId,
        sale_code: saleCode,
        total_amount: 0,
        note: "Vat tu su dung cho cong viec",
        created_by: context.user.id,
      })
      .select("id")
      .single();

    if (orderError || !order) return jsonError("Không thể tạo đơn vật tư: " + (orderError?.message || "Không xác định"), 500);

    let materialTotal = 0;

    for (const item of materialItems) {
      const productId = (item.productId || "").trim();
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return jsonError("Thông tin vật tư không hợp lệ.");
      }

      const { data: product, error: productError } = await supabaseAdmin
        .from("worker_inventory_products")
        .select("id, worker_id, name, sku, category, unit, stock_quantity, warranty_months")
        .eq("id", productId)
        .eq("worker_id", visibleJob.worker_id)
        .maybeSingle();

      if (productError) return jsonError("Không thể kiểm tra vật tư: " + productError.message, 500);
      if (!product) return jsonError("Vật tư không tồn tại trong kho.");
      if (Number(product.stock_quantity || 0) < quantity) return jsonError(`Vật tư ${product.name} không đủ tồn kho.`);

      const nextStock = Number(product.stock_quantity || 0) - quantity;
      const { error: stockError } = await supabaseAdmin
        .from("worker_inventory_products")
        .update({ stock_quantity: nextStock })
        .eq("id", product.id)
        .eq("worker_id", visibleJob.worker_id);

      if (stockError) return jsonError("Không thể trừ tồn kho: " + stockError.message, 500);

      const lineTotal = quantity * unitPrice;
      materialTotal += lineTotal;
      const { data: orderItem, error: itemError } = await supabaseAdmin
        .from("worker_sales_order_items")
        .insert({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          category: product.category,
          unit: product.unit,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
        })
        .select("id")
        .single();

      if (itemError || !orderItem) return jsonError("Không thể ghi vật tư đã dùng: " + (itemError?.message || "Không xác định"), 500);

      if (Number(product.warranty_months || 0) > 0) {
        const warrantyStart = new Date();
        const warrantyEnd = new Date(warrantyStart);
        warrantyEnd.setMonth(warrantyEnd.getMonth() + Number(product.warranty_months || 0));
        const { error: warrantyError } = await supabaseAdmin
          .from("worker_product_warranties")
          .insert({
            worker_id: visibleJob.worker_id,
            customer_id: visibleJob.customer_id,
            sales_order_id: order.id,
            sales_order_item_id: orderItem.id,
            job_id: jobId,
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            warranty_months: Number(product.warranty_months || 0),
            warranty_start: warrantyStart.toISOString().slice(0, 10),
            warranty_end: warrantyEnd.toISOString().slice(0, 10),
            created_by: context.user.id,
          });

        if (warrantyError) return jsonError("Không thể tạo bảo hành vật tư: " + warrantyError.message, 500);
      }
    }

    const { error: orderTotalError } = await supabaseAdmin
      .from("worker_sales_orders")
      .update({ total_amount: materialTotal })
      .eq("id", order.id);

    if (orderTotalError) return jsonError("Không thể cập nhật tổng tiền vật tư: " + orderTotalError.message, 500);

    const { error: jobError } = await supabaseAdmin
      .from("jobs")
      .update({
        status: "completed",
        images,
        completion_items: completionItems,
        final_amount: Number.isFinite(finalAmount) ? finalAmount : 0,
        warranty_days: Number.isFinite(warrantyDays) ? warrantyDays : 0,
        warranty_note: warrantyNote || null,
      })
      .eq("id", jobId)
      .eq("worker_id", visibleJob.worker_id);

    if (jobError) return jsonError("Không thể hoàn thành công việc: " + jobError.message, 500);

    await supabaseAdmin
      .from("job_logs")
      .insert({
        job_id: jobId,
        actor_id: context.user.id,
        action: "completed_with_materials",
        metadata: {
          sales_order_id: order.id,
          material_total: materialTotal,
          material_count: materialItems.length,
          source: "worker_job_completion_api_fallback",
        },
      });

    await notifyJobEvent(supabaseAdmin, "job_completed", jobId, { source: "worker_job_completion_api_fallback", sales_order_id: order.id });
    await notifyNextWorkerJob(supabaseAdmin, visibleJob.worker_id, jobId);

    return NextResponse.json({ ok: true, salesOrderId: order.id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Không thể hoàn thành công việc với vật tư.", 500);
  }
}
