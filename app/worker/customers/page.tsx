"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BriefcaseIcon,
  CalendarIcon,
  DollarSignIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
  UserIcon,
} from "../../components/icons";

type CustomerProfile = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  created_at?: string | null;
};

type RawWorkerCustomerJob = {
  id: string;
  status?: string | null;
  customer_id: string;
  address?: string | null;
  quoted_price?: number | null;
  updated_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  service?: { name?: string | null } | null;
  customer?: CustomerProfile | CustomerProfile[] | null;
};

type CustomerSummary = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  jobCount: number;
  completedCount: number;
  cancelledCount: number;
  totalRevenue: number;
  lastJobAt?: string | null;
  lastJobId?: string;
  services: string[];
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const getCustomerProfile = (customer: RawWorkerCustomerJob["customer"]) => {
  if (Array.isArray(customer)) return customer[0] || null;
  return customer || null;
};

const WORKER_CUSTOMERS_JOB_LIMIT = 200;

export default function WorkerCustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    const { data: workerData, error: workerError } = await supabase
      .from("workers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (workerError || !workerData) {
      setError("Không tìm thấy hồ sơ thợ.");
      setCustomers([]);
      setLoading(false);
      return;
    }

    const { data: jobsData, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        customer_id,
        address,
        quoted_price,
        updated_at,
        scheduled_at,
        created_at,
        service:services!jobs_service_id_fkey(name),
        customer:profiles!customer_id(id, full_name, phone, address, created_at)
      `)
      .eq("worker_id", workerData.id)
      .order("updated_at", { ascending: false })
      .range(0, WORKER_CUSTOMERS_JOB_LIMIT - 1);

    if (jobsError) {
      setError("Không thể tải danh sách khách hàng: " + jobsError.message);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const summaries = new Map<string, CustomerSummary>();

    ((jobsData || []) as RawWorkerCustomerJob[]).forEach((job) => {
      const customer = getCustomerProfile(job.customer);
      const customerId = customer?.id || job.customer_id;
      const current = summaries.get(customerId);
      const jobDate = job.updated_at || job.scheduled_at || job.created_at;
      const serviceName = job.service?.name || "Dịch vụ";
      const isCompleted = job.status === "completed" || job.status === "done";
      const isCancelled = job.status === "cancelled";

      if (!current) {
        summaries.set(customerId, {
          id: customerId,
          name: customer?.full_name || "Khách hàng",
          phone: customer?.phone,
          address: customer?.address || job.address,
          jobCount: 1,
          completedCount: isCompleted ? 1 : 0,
          cancelledCount: isCancelled ? 1 : 0,
          totalRevenue: isCompleted ? Number(job.quoted_price || 0) : 0,
          lastJobAt: jobDate,
          lastJobId: job.id,
          services: [serviceName],
        });
        return;
      }

      current.jobCount += 1;
      current.completedCount += isCompleted ? 1 : 0;
      current.cancelledCount += isCancelled ? 1 : 0;
      current.totalRevenue += isCompleted ? Number(job.quoted_price || 0) : 0;
      current.address = current.address || customer?.address || job.address;
      current.phone = current.phone || customer?.phone;

      if (!current.services.includes(serviceName)) {
        current.services.push(serviceName);
      }

      if (jobDate && (!current.lastJobAt || new Date(jobDate) > new Date(current.lastJobAt))) {
        current.lastJobAt = jobDate;
        current.lastJobId = job.id;
      }
    });

    setCustomers(
      [...summaries.values()].sort((a, b) =>
        new Date(b.lastJobAt || 0).getTime() - new Date(a.lastJobAt || 0).getTime()
      )
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchCustomers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.phone,
        customer.address,
        customer.services.join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        acc.totalCustomers += 1;
        acc.totalJobs += customer.jobCount;
        acc.totalRevenue += customer.totalRevenue;
        return acc;
      },
      { totalCustomers: 0, totalJobs: 0, totalRevenue: 0 }
    );
  }, [customers]);

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden bg-linear-to-b from-primary-fixed via-surface to-secondary-fixed/35 p-4 animate-fade-in lg:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-linear-to-br from-primary/12 via-tertiary-container/10 to-secondary-container/12" />

      <div className="relative mb-5 overflow-hidden rounded-xl border border-white/30 bg-linear-to-br from-primary via-tertiary-container to-secondary-container p-5 text-white shadow-[0_18px_42px_rgba(6,52,103,0.18)]">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" />
        <p className="text-[11px] font-bold uppercase text-white/75">Quan hệ khách hàng</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight" style={{ color: "#fcd34d" }}>Quản lý khách hàng</h1>
        <p className="mt-2 max-w-[22rem] text-sm leading-6 text-white/85">
          Theo dõi khách quen, lịch sử phục vụ, doanh thu và liên hệ nhanh khi cần chăm sóc lại.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-success-container" />
          {stats.totalCustomers} khách đã phục vụ
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-primary-container/15 bg-primary-fixed p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-primary-container/75">Khách đã phục vụ</p>
          <p className="mt-1 text-2xl font-extrabold text-primary-container">{stats.totalCustomers}</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/70">
            <div className="h-full w-2/3 rounded-full bg-primary-container" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-tertiary-container/15 bg-cyan-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-tertiary-container/75">Tổng đơn</p>
          <p className="mt-1 text-2xl font-extrabold text-tertiary-container">{stats.totalJobs}</p>
          <div className="mt-3 h-1.5 rounded-full bg-white">
            <div className="h-full w-3/4 rounded-full bg-tertiary-container" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-success/15 bg-success-container p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-on-success-container/75">Doanh thu hoàn thành</p>
          <p className="mt-1 text-xl font-extrabold text-success">{currencyFormatter.format(stats.totalRevenue)}</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/75">
            <div className="h-full w-4/5 rounded-full bg-success" />
          </div>
        </div>
      </div>

      <div className="relative my-4 rounded-xl border border-white/60 bg-white/72 p-3 shadow-[0_12px_30px_rgba(15,35,66,0.08)] backdrop-blur">
        <label className="relative block">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="input-field !border-white !bg-white/92 !pl-10 !py-2.5"
            placeholder="Tìm theo tên, số điện thoại, địa chỉ, dịch vụ..."
          />
        </label>
      </div>

      {loading ? (
        <div className="relative flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
        </div>
      ) : error ? (
        <div className="relative rounded-lg border border-error/20 bg-error-container p-4 text-sm font-bold text-error">
          {error}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="relative rounded-xl border border-dashed border-primary-container/30 bg-white/75 py-20 text-center shadow-sm backdrop-blur">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
            <UserIcon size={32} />
          </div>
          <p className="text-body-md font-bold text-on-surface">Chưa có khách hàng phù hợp</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">Khách sẽ xuất hiện khi bạn nhận hoặc tạo đơn cho họ.</p>
        </div>
      ) : (
        <div className="relative grid gap-4 lg:grid-cols-2">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-[0_14px_34px_rgba(15,35,66,0.08)] backdrop-blur">
              <div className="h-1.5 bg-linear-to-r from-primary-container via-tertiary-container to-secondary-container" />
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-container to-tertiary-container text-lg font-extrabold text-white shadow-sm">
                    {customer.name.trim().charAt(0).toUpperCase() || "K"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-extrabold text-on-surface">{customer.name}</h2>
                        <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                          {customer.completedCount} hoàn thành · {customer.cancelledCount} đã hủy
                        </p>
                      </div>
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-md shadow-green-900/15"
                          aria-label="Gọi khách hàng"
                        >
                          <PhoneIcon size={18} />
                        </a>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low/75 p-3">
                      {customer.address && (
                        <div className="flex items-start gap-2 text-sm text-on-surface-variant">
                          <MapPinIcon size={15} className="mt-0.5 shrink-0 text-primary-container" />
                          <span className="line-clamp-2">{customer.address}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <PhoneIcon size={15} className="text-success" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      {customer.lastJobAt && (
                        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                          <CalendarIcon size={15} className="text-secondary-container" />
                          <span>Lần gần nhất: {new Date(customer.lastJobAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-primary-fixed p-3">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-primary-container/75">
                          <BriefcaseIcon size={13} />
                          Số đơn
                        </div>
                        <p className="mt-1 text-lg font-extrabold text-primary-container">{customer.jobCount}</p>
                      </div>
                      <div className="rounded-lg bg-success-container p-3">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-on-success-container/75">
                          <DollarSignIcon size={13} />
                          Doanh thu
                        </div>
                        <p className="mt-1 text-sm font-extrabold text-success">{currencyFormatter.format(customer.totalRevenue)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {customer.services.slice(0, 4).map((service) => (
                        <span key={service} className="rounded-full border border-primary-container/10 bg-white/75 px-2.5 py-1 text-[10px] font-bold text-primary-container shadow-sm">
                          {service}
                        </span>
                      ))}
                    </div>

                    {customer.lastJobId && (
                      <Link
                        href={`/worker/history/${customer.lastJobId}`}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-secondary-container px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-orange-900/15 transition-all hover:brightness-105 active:scale-[0.98]"
                      >
                        Xem đơn gần nhất
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
