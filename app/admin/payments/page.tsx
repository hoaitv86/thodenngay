"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBillGoCurrency, getBillGoSummary } from "@/lib/billgo";

type PaymentRow = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
  collected_by?: string | null;
  note?: string | null;
};

type BillGoJob = {
  id: string;
  job_code?: string | null;
  customer_id?: string | null;
  worker_id?: string | null;
  status?: string | null;
  quoted_price?: number | string | null;
  final_amount?: number | string | null;
  created_at?: string | null;
  customer?: { full_name?: string | null; phone?: string | null } | null;
  service?: { name?: string | null } | null;
  worker?: { profiles?: { full_name?: string | null } | null } | null;
  payments?: PaymentRow[] | null;
};

const methodLabels: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";

export default function AdminPayments() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<BillGoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("debt");

  const fetchBillGo = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, job_code, customer_id, worker_id, status, quoted_price, created_at, customer:profiles!customer_id(full_name, phone), service:services!jobs_service_id_fkey(name), worker:workers(profiles(full_name)), payments(id, amount, method, status, paid_at, collected_by, note)")
      .order("created_at", { ascending: false });

    if (!error && data) setJobs(data as BillGoJob[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBillGo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        const summary = getBillGoSummary(job);
        acc.receivable += summary.receivable;
        acc.paid += summary.paid;
        acc.debt += summary.debt;
        if (summary.status === "partial" || summary.status === "unpaid") acc.debtJobs += 1;
        return acc;
      },
      { receivable: 0, paid: 0, debt: 0, debtJobs: 0 }
    );
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const summary = getBillGoSummary(job);
      if (statusFilter === "paid") return summary.status === "paid";
      if (statusFilter === "debt") return summary.debt > 0;
      return true;
    });
  }, [jobs, statusFilter]);

  const selectedJob = jobs.find(job => job.id === selectedJobId) || null;
  const selectedSummary = selectedJob ? getBillGoSummary(selectedJob) : null;

  const handleSavePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedJob) {
      setMessage("Vui lòng chọn công việc cần thu.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMessage("Số tiền thu phải lớn hơn 0.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      job_id: selectedJob.id,
      amount: parsedAmount,
      method,
      status: "paid",
      paid_at: new Date().toISOString(),
      collected_by: user?.id || null,
      note: note.trim() || null,
    });

    if (error) {
      setMessage("Không thể lưu thanh toán: " + error.message);
    } else {
      setAmount("");
      setNote("");
      setMessage("Đã ghi nhận thanh toán BillGo.");
      await fetchBillGo();
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">BillGo</p>
        <h1 className="text-headline-md text-on-surface">Thanh toán & Công nợ</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Quản lý phải thu, đã thu và còn nợ trực tiếp theo từng công việc.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Phải thu</p>
          <p className="mt-2 text-xl font-extrabold text-on-surface">{formatBillGoCurrency(totals.receivable)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Đã thu</p>
          <p className="mt-2 text-xl font-extrabold text-success">{formatBillGoCurrency(totals.paid)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Còn nợ</p>
          <p className="mt-2 text-xl font-extrabold text-error">{formatBillGoCurrency(totals.debt)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Job còn nợ</p>
          <p className="mt-2 text-xl font-extrabold text-warning">{totals.debtJobs}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-outline-variant/30 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 p-4">
            <h2 className="text-lg font-extrabold text-on-surface">Danh sách công nợ</h2>
            <div className="flex rounded-lg bg-surface-container-low p-1 text-xs font-bold">
              {["debt", "all", "paid"].map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatusFilter(item)}
                  className={`rounded-md px-3 py-2 ${statusFilter === item ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}
                >
                  {item === "debt" ? "Còn nợ" : item === "paid" ? "Đã thu đủ" : "Tất cả"}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-outline-variant/20">
            {loading ? (
              <div className="p-6 text-sm text-on-surface-variant">Đang tải BillGo...</div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-6 text-sm text-on-surface-variant">Không có khoản phù hợp.</div>
            ) : filteredJobs.map(job => {
              const summary = getBillGoSummary(job);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`block w-full p-4 text-left transition-colors hover:bg-surface-container-lowest ${selectedJobId === job.id ? "bg-primary-fixed/50" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">{job.job_code || job.id.slice(0, 8)} · {job.customer?.full_name || "Khách hàng"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{job.service?.name || "Dịch vụ"} · {job.customer?.phone || "Chưa có SĐT"}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Thợ: {job.worker?.profiles?.full_name || "Chưa phân công"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${summary.debt > 0 ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
                        {summary.statusLabel}
                      </span>
                      <p className="mt-2 text-sm font-bold text-on-surface">Nợ: {formatBillGoCurrency(summary.debt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span>Phải thu: <strong>{formatBillGoCurrency(summary.receivable)}</strong></span>
                    <span>Đã thu: <strong>{formatBillGoCurrency(summary.paid)}</strong></span>
                    <span>Lần thu: <strong>{job.payments?.filter(p => p.status === "paid").length || 0}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <form onSubmit={handleSavePayment} className="rounded-lg border border-outline-variant/30 bg-white p-4">
            <h2 className="text-lg font-extrabold text-on-surface">Ghi nhận thu tiền</h2>
            {selectedJob && selectedSummary ? (
              <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-xs">
                <p className="font-bold text-on-surface">{selectedJob.job_code || selectedJob.id.slice(0, 8)}</p>
                <p className="mt-1 text-on-surface-variant">Còn nợ: <strong className="text-error">{formatBillGoCurrency(selectedSummary.debt)}</strong></p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-on-surface-variant">Chọn một công việc trong danh sách để thu tiền.</p>
            )}

            <div className="mt-4 space-y-3">
              <input className="input-field" type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Số tiền thu" disabled={!selectedJob || saving} />
              <select className="input-field" value={method} onChange={event => setMethod(event.target.value)} disabled={!selectedJob || saving}>
                {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <textarea className="input-field min-h-20" value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú" disabled={!selectedJob || saving} />
              {message && <p className="text-xs font-bold text-primary">{message}</p>}
              <button className="btn-primary w-full" disabled={!selectedJob || saving}>{saving ? "Đang lưu..." : "Lưu thanh toán"}</button>
            </div>
          </form>

          <div className="rounded-lg border border-outline-variant/30 bg-white p-4">
            <h2 className="text-lg font-extrabold text-on-surface">Lịch sử thanh toán</h2>
            <div className="mt-3 space-y-2">
              {!selectedJob ? (
                <p className="text-sm text-on-surface-variant">Chọn công việc để xem lịch sử.</p>
              ) : (selectedJob.payments || []).filter(payment => payment.status === "paid").length === 0 ? (
                <p className="text-sm text-on-surface-variant">Chưa có lần thu nào.</p>
              ) : (
                (selectedJob.payments || []).filter(payment => payment.status === "paid").map(payment => (
                  <div key={payment.id} className="rounded-lg bg-surface-container-low p-3 text-xs">
                    <div className="flex justify-between gap-3">
                      <strong>{formatBillGoCurrency(payment.amount)}</strong>
                      <span>{methodLabels[payment.method] || payment.method}</span>
                    </div>
                    <p className="mt-1 text-on-surface-variant">{formatDateTime(payment.paid_at)}</p>
                    {payment.note && <p className="mt-1 text-on-surface">{payment.note}</p>}
                    {payment.collected_by && <p className="mt-1 text-on-surface-variant">Người thu: {payment.collected_by.slice(0, 8)}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
