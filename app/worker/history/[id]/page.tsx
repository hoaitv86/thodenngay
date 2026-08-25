"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { findCachedWorkerRecordById } from "@/lib/offline/worker-detail-cache";
import { getJobServices, isMissingWorkflowColumn, type JobWithWorkflow } from "@/lib/job-workflow";
import {
  BILLGO_CYCLE_OPTIONS,
  getBillGoBillingPeriod,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoStoredStatus,
  type BillGoCycle,
} from "@/lib/billgo";
import {
  BILLGO_SIGNUP_CYCLES,
  getBillGoPackagePrice,
  getBillGoPackageTypeLabel,
  type BillGoPackage,
} from "@/lib/billgo-packages";
import { readVietnameseMoney } from "@/lib/vietnamese-money";
import { TaskAttachmentList } from "@/app/components/TaskAttachmentList";
import type { TaskAttachment } from "@/lib/task-attachments";
import {
  MapPinIcon,
  ClockIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XIcon,
  StarIcon,
  CalendarIcon,
  DollarSignIcon,
  ChevronLeftIcon,
  PhoneIcon,
  ShieldCheckIcon
} from "../../../components/icons";

interface CompletionItem {
  name: string;
  quantity: number;
  unitPrice: number;
  warrantyDays: number;
  generatedKey?: string;
}

const INTERNET_INSTALL_FEE_OPTIONS = [300000, 400000];
const VIETTEL_GIFT_CAMERA_OPTIONS = [
  "Camera Viettel trong nhà",
  "Camera Viettel ngoài trời",
];
const INTERNET_COMPLETION_CYCLES: BillGoCycle[] = ["monthly", "two_months", "three_months", "six_months", "yearly"];
const DEFAULT_CANCEL_REASON = "Khách hàng từ chối lắp đặt/sửa chữa";
const CANCELABLE_JOB_STATUSES = new Set(["assigned", "in_progress"]);

type ReceiptEditEntry = {
  editedAt: string;
  editedBy?: string | null;
  reason: string;
  previousAmount: number;
  nextAmount: number;
  previousItems: CompletionItem[];
  nextItems: CompletionItem[];
};

type JobWorkflowData = Record<string, unknown> & {
  receiptEditHistory?: ReceiptEditEntry[];
  receiptRevision?: number;
  billgo?: Record<string, unknown>;
  internetInstall?: Record<string, unknown>;
  billgoAddOn?: Record<string, unknown>;
};

interface WorkerJobDetail {
  id: string;
  worker_id?: string | null;
  customer_id?: string | null;
  service_id?: string | null;
  job_code?: string | null;
  status?: string | null;
  address?: string | null;
  scheduled_at: string;
  updated_at?: string | null;
  description?: string | null;
  quoted_price?: number | null;
  images?: string[] | null;
  completion_items?: CompletionItem[] | null;
  final_amount?: number | null;
  warranty_days?: number | null;
  warranty_note?: string | null;
  workflow_data?: JobWorkflowData | null;
  task_attachments?: TaskAttachment[] | null;
  service?: {
    id?: string | null;
    name?: string | null;
    description?: string | null;
  } | null;
  job_services?: JobWithWorkflow["job_services"];
  customer?: {
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | Array<{
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  }> | null;
  ratings?: Array<{
    score: number;
    comment?: string | null;
    created_at: string;
    images?: string[] | null;
  }> | null;
}

type WorkerProfileCache = {
  worker?: ({
    id?: string | null;
    user?: { full_name?: string | null; phone?: string | null; email?: string | null; address?: string | null } | null;
  } & Record<string, unknown>) | null;
  storeId?: string | null;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const makeEditItem = (): CompletionItem => ({
  name: "",
  quantity: 1,
  unitPrice: 0,
  warrantyDays: 0,
});

const calculateItemsTotal = (items: CompletionItem[]) =>
  items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);

const getStringValue = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

const getNumberValue = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isInternetInstallReceiptForJob = (job: WorkerJobDetail) => {
  const services = getJobServices({ service: job.service, job_services: job.job_services });
  const serviceName = job.service?.name || "";
  const serviceText = normalizeText(`${serviceName} ${services.map(service => service.name || "").join(" ")}`);
  return Boolean(job.workflow_data?.billgo || job.workflow_data?.internetInstall)
    || ((/internet|wifi|wi-fi|mang|cap quang/.test(serviceText)) && (/lap|moi|hoa mang|install/.test(serviceText)));
};

const isInitialInternetServiceItem = (job: WorkerJobDetail, item: CompletionItem, index: number) => {
  if (!isInternetInstallReceiptForJob(job) || index !== 0 || item.generatedKey) return false;

  const quotedPrice = getNumberValue(job.quoted_price);
  const unitPrice = getNumberValue(item.unitPrice);
  const itemName = normalizeText(item.name || "");
  const serviceName = normalizeText(job.service?.name || "");

  return (
    (quotedPrice > 0 && unitPrice === quotedPrice)
    || (Boolean(serviceName) && itemName === serviceName)
    || /cong dich vu|lap moi internet|lap dat internet|internet/.test(itemName)
  );
};

export default function WorkerJobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [job, setJob] = useState<WorkerJobDetail | null>(null);
  const [billGoPackages, setBillGoPackages] = useState<BillGoPackage[]>([]);
  const [currentWorkerId, setCurrentWorkerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState("Thợ thực hiện");
  const [workerPhone, setWorkerPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItems, setEditItems] = useState<CompletionItem[]>([]);
  const [editInternetPackageId, setEditInternetPackageId] = useState("");
  const [editInternetMonthlyFee, setEditInternetMonthlyFee] = useState("");
  const [editInternetCycle, setEditInternetCycle] = useState<BillGoCycle>("monthly");
  const [editInternetInstallFeeInput, setEditInternetInstallFeeInput] = useState("300000");
  const [editGiftCamera, setEditGiftCamera] = useState("");
  const [editGiftCameraPassword, setEditGiftCameraPassword] = useState("");
  const [editAddOnPackageId, setEditAddOnPackageId] = useState("");
  const [editAddOnCycle, setEditAddOnCycle] = useState<BillGoCycle>("monthly");
  const [editAddOnNote, setEditAddOnNote] = useState("");
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [detailMessage, setDetailMessage] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(DEFAULT_CANCEL_REASON);
  const [requestingCancel, setRequestingCancel] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true);
      setDetailMessage("");
      const jobId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
      if (!jobId) {
        setLoading(false);
        return;
      }

      let cacheScope: WorkerOfflineScope | null = null;
      let cachedJob: WorkerJobDetail | null = null;
      let cachedPackages: BillGoPackage[] | null = null;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const cachedProfile = await getCachedDataset<WorkerProfileCache>(makeWorkerUserDatasetKey("worker-profile", user.id));
        const cachedWorker = cachedProfile?.data.worker;
        if (cachedWorker?.id) {
          setCurrentWorkerId(cachedWorker.id);
          cacheScope = { userId: user.id, workerId: cachedWorker.id, storeId: cachedProfile?.data.storeId || null };
        }
        const cachedUser = cachedWorker?.user;
        if (cachedUser?.full_name) setWorkerName(cachedUser.full_name);
        if (cachedUser?.phone) setWorkerPhone(cachedUser.phone);

        const cachedJobResult = await findCachedWorkerRecordById<WorkerJobDetail>({
          dataset: "jobs",
          userId: user.id,
          recordId: jobId,
          scopes: cacheScope ? [cacheScope] : [],
          variants: [`detail:${jobId}`, "history", "customers", "backlog", "active", "pending", "available", "dashboard", null],
        });
        cachedJob = cachedJobResult?.record || null;
        if (cacheScope) {
          cachedPackages = (await getCachedDataset<BillGoPackage[]>(makeWorkerDatasetKey("packages", cacheScope)))?.data || null;
        }

        if (cachedJob) {
          setJob(cachedJob);
          logOfflineDebug("hydrated from cache", { dataset: "jobs", cacheKey: cachedJobResult?.cacheKey || null, recordCount: 1 });
          setLoading(false);
        }
        if (cachedPackages) setBillGoPackages(cachedPackages);

        if (typeof window !== "undefined" && !window.navigator.onLine) {
          if (!cachedJob) {
            setDetailMessage("Chưa có dữ liệu offline cho mục này");
            logOfflineDebug("dataset load", { dataset: "jobs", userId: user.id, variant: `detail:${jobId}`, snapshotFound: false, reason: "offline-missing-detail" });
          }
          logOfflineDebug("server fetch skipped", { dataset: "jobs", userId: user.id, variant: `detail:${jobId}`, reason: "offline" });
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) setWorkerName(profile.full_name);
        if (profile?.phone) setWorkerPhone(profile.phone);

        const { data: workerRow } = await supabase
          .from("workers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (workerRow?.id) {
          setCurrentWorkerId(workerRow.id);
          cacheScope = cacheScope || { userId: user.id, workerId: workerRow.id, storeId: cachedProfile?.data.storeId || null };
        }
      } else if (typeof window !== "undefined" && !window.navigator.onLine) {
        setDetailMessage("Chưa có dữ liệu offline cho mục này");
        logOfflineDebug("dataset load", { dataset: "jobs", variant: `detail:${jobId}`, snapshotFound: false, reason: "missing-offline-identity" });
        setLoading(false);
        return;
      }

      let result = await supabase
        .from("jobs")
        .select(`
          id,
          worker_id,
          customer_id,
          service_id,
          job_code,
          status,
          address,
          scheduled_at,
          updated_at,
          description,
          quoted_price,
          images,
          completion_items,
          final_amount,
          warranty_days,
          warranty_note,
          workflow_data,
          task_attachments(id, task_id, original_name, storage_path, mime_type, file_size, created_at),
          service:services!jobs_service_id_fkey(id, name, description),
          job_services(service:services(id, name, description)),
          customer:profiles!customer_id(full_name, phone, address),
          ratings(score, comment, created_at, images)
        `)
        .eq("id", jobId)
        .single();

      if (result.error && isMissingWorkflowColumn(result.error.message)) {
        result = await supabase
          .from("jobs")
          .select(`
            id,
            worker_id,
            customer_id,
            service_id,
            job_code,
            status,
            address,
            scheduled_at,
            updated_at,
            description,
            quoted_price,
            images,
            completion_items,
            final_amount,
            warranty_days,
            warranty_note,
            workflow_data,
            task_attachments(id, task_id, original_name, storage_path, mime_type, file_size, created_at),
            service:services!jobs_service_id_fkey(id, name, description),
            customer:profiles!customer_id(full_name, phone, address),
            ratings(score, comment, created_at, images)
          `)
          .eq("id", jobId)
          .single();
      }

      if (result.error) {
        logOfflineDebug("skipped cache overwrite", { dataset: "jobs", cacheKey: cacheScope ? makeWorkerDatasetKey("jobs", cacheScope, `detail:${jobId}`) : null, reason: result.error.message });
        if (!cachedJob) {
          setDetailMessage("Chưa có dữ liệu offline cho mục này");
        }
      } else {
        const nextJob = result.data as unknown as WorkerJobDetail;
        setJob(nextJob);
        if (cacheScope) {
          void setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, `detail:${jobId}`), [nextJob], { dataset: "jobs", variant: `detail:${jobId}`, userId: cacheScope.userId, workerId: cacheScope.workerId, storeId: cacheScope.storeId || null });
        }
      }

      const { data: packageData, error: packageError } = await supabase
        .from("billgo_packages")
        .select("id, code, name, type, provider, monthly_price, setup_price, allowed_cycles, description, is_active, sort_order")
        .eq("is_active", true)
        .order("type", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (packageError) {
        logOfflineDebug("skipped cache overwrite", { dataset: "packages", cacheKey: cacheScope ? makeWorkerDatasetKey("packages", cacheScope) : null, reason: packageError.message });
        if (cachedPackages) setBillGoPackages(cachedPackages);
      } else {
        const nextPackages = (packageData || []) as BillGoPackage[];
        setBillGoPackages(nextPackages);
        if (cacheScope) void setCachedDataset(makeWorkerDatasetKey("packages", cacheScope), nextPackages, { dataset: "packages", userId: cacheScope.userId, workerId: cacheScope.workerId, storeId: cacheScope.storeId || null });
      }
      setLoading(false);
    };

    void fetchJob();
  }, [id, router, supabase]);

  const openCancelModal = () => {
    setCancelReason(DEFAULT_CANCEL_REASON);
    setCancelFeedback("");
    setCancelModalOpen(true);
  };

  const requestCancelJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!job || requestingCancel) return;

    const reason = cancelReason.trim();
    if (!reason) {
      setCancelFeedback("Vui lòng nhập lý do huỷ.");
      return;
    }

    setRequestingCancel(true);
    setCancelFeedback("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const { data: updatedJobs, error } = await supabase
        .from("jobs")
        .update({
          status: "cancel_requested",
          cancellation_reason: reason,
          cancellation_requested_by: user.id,
          cancellation_requested_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .in("status", ["assigned", "in_progress"])
        .select("id, status, updated_at");

      if (error) {
        throw new Error("Không thể gửi yêu cầu huỷ: " + error.message);
      }

      if (!updatedJobs || updatedJobs.length === 0) {
        throw new Error("Job không còn ở trạng thái có thể yêu cầu huỷ.");
      }

      const updatedJob = updatedJobs[0] as Pick<WorkerJobDetail, "status" | "updated_at">;
      setJob(current => current ? { ...current, status: updatedJob.status || "cancel_requested", updated_at: updatedJob.updated_at || new Date().toISOString() } : current);
      setCancelModalOpen(false);
      setCancelReason(DEFAULT_CANCEL_REASON);
      setCancelFeedback("Đã gửi yêu cầu huỷ, chờ admin duyệt.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể gửi yêu cầu huỷ.";
      setCancelFeedback(message);
    } finally {
      setRequestingCancel(false);
    }
  };
  const openEditReceipt = () => {
    if (!job) return;
    const workflowBillGo = job.workflow_data?.billgo || {};
    const workflowInternetInstall = job.workflow_data?.internetInstall || {};
    const workflowAddOn = job.workflow_data?.billgoAddOn || {};
    const currentItems = Array.isArray(job.completion_items) && job.completion_items.length > 0
      ? job.completion_items.filter((item, index) => !item.generatedKey && !isInitialInternetServiceItem(job, item, index))
      : [makeEditItem()];
    const nextEditItems = currentItems.length > 0 ? currentItems : [makeEditItem()];
    setEditItems(nextEditItems.map(item => ({
      name: item.name || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      warrantyDays: Number(item.warrantyDays || 0),
    })));
    setEditInternetPackageId(getStringValue(workflowBillGo.packageId));
    setEditInternetMonthlyFee(getStringValue(workflowBillGo.amount));
    setEditInternetCycle(
      INTERNET_COMPLETION_CYCLES.includes(workflowBillGo.cycle as BillGoCycle)
        ? workflowBillGo.cycle as BillGoCycle
        : "monthly"
    );
    setEditInternetInstallFeeInput(String(getNumberValue(workflowInternetInstall.installFee) || 300000));
    setEditGiftCamera(getStringValue(workflowInternetInstall.giftCamera));
    setEditGiftCameraPassword(getStringValue(workflowInternetInstall.giftCameraPassword));
    setEditAddOnPackageId(getStringValue(workflowAddOn.packageId));
    setEditAddOnCycle(
      BILLGO_SIGNUP_CYCLES.includes(workflowAddOn.cycle as BillGoCycle)
        ? workflowAddOn.cycle as BillGoCycle
        : "monthly"
    );
    setEditAddOnNote(getStringValue(workflowAddOn.note));
    setEditReason("");
    setEditError("");
    setEditModalOpen(true);
  };

  const updateEditItem = (index: number, patch: Partial<CompletionItem>) => {
    setEditItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const removeEditItem = (index: number) => {
    setEditItems(current => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
  };

  const saveReceiptEdit = async () => {
    if (!job || savingEdit) return;

    const cleanedManualItems = editItems
      .map(item => ({
        name: item.name.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        warrantyDays: Number(item.warrantyDays) || 0,
      }))
      .filter((item, index) => item.name && item.quantity > 0 && !isInitialInternetServiceItem(job, item, index));

    const cleanedItems = [...cleanedManualItems, ...editGeneratedItems];

    if (cleanedItems.length === 0) {
      setEditError("Vui lòng nhập ít nhất một hạng mục hoặc chọn gói cước hợp lệ.");
      return;
    }

    if (cleanedItems.some(item => item.unitPrice < 0 || item.warrantyDays < 0)) {
      setEditError("Đơn giá và bảo hành không được âm.");
      return;
    }

    if (!editReason.trim()) {
      setEditError("Vui lòng nhập lý do sửa phiếu.");
      return;
    }

    if (editInternetMonthlyFeeNumber < 0) {
      setEditError("Cước Internet/tháng không được âm.");
      return;
    }

    if (!INTERNET_COMPLETION_CYCLES.includes(editInternetCycle)) {
      setEditError("Chu kỳ gói Internet không hợp lệ.");
      return;
    }

    if (selectedEditAddOnPackage && !editAddOnCycleOptions.some(option => option.value === editAddOnCycle)) {
      setEditError("Chu kỳ gói TV/đầu thu không hợp lệ.");
      return;
    }

    if (canEditGiftViettelCamera && !editGiftCamera) {
      setEditError("Còn thiếu mục: Camera Viettel tặng kèm.");
      return;
    }

    if (canEditGiftViettelCamera && !editGiftCameraAccountValue) {
      setEditError("Còn thiếu mục: Tài khoản camera (SĐT khách hàng). Vui lòng cập nhật SĐT khách trước.");
      return;
    }

    if (canEditGiftViettelCamera && !editGiftCameraPassword.trim()) {
      setEditError("Còn thiếu mục: Mật khẩu camera.");
      return;
    }

    setSavingEdit(true);
    setEditError("");

    const previousItems = Array.isArray(job.completion_items) ? job.completion_items : [];
    const previousAmount = Number(job.final_amount || calculateItemsTotal(previousItems));
    const nextAmount = calculateItemsTotal(cleanedItems);
    const nextWarrantyDays = cleanedItems.reduce((max, item) => Math.max(max, Number(item.warrantyDays || 0)), 0);
    const previousWorkflow = job.workflow_data || {};
    const nextHistory: ReceiptEditEntry[] = [
      ...(Array.isArray(previousWorkflow.receiptEditHistory) ? previousWorkflow.receiptEditHistory : []),
      {
        editedAt: new Date().toISOString(),
        editedBy: workerName,
        reason: editReason.trim(),
        previousAmount,
        nextAmount,
        previousItems,
        nextItems: cleanedItems,
      },
    ];

    const nextWorkflow: JobWorkflowData = {
      ...previousWorkflow,
      billgo: isInternetInstallReceipt && editInternetMonthlyFeeNumber > 0 ? {
        ...(previousWorkflow.billgo || {}),
        packageId: selectedEditInternetPackage?.id || null,
        packageName: selectedEditInternetPackage?.name || null,
        packageType: selectedEditInternetPackage?.type || "internet",
        cycle: editInternetCycle,
        amount: editInternetMonthlyFeeNumber,
        startDate: getStringValue(previousWorkflow.billgo?.startDate) || new Date().toISOString().slice(0, 10),
        totalAmount: editInternetCycleTotal,
        receiptAmount: editInternetReceiptTotal,
        note: "Cước Internet lắp mới",
      } : previousWorkflow.billgo,
      internetInstall: isInternetInstallReceipt ? {
        ...(previousWorkflow.internetInstall || {}),
        installFee: editInternetInstallFee,
        giftCamera: canEditGiftViettelCamera ? editGiftCamera || null : null,
        giftCameraAccount: canEditGiftViettelCamera ? editGiftCameraAccountValue || null : null,
        giftCameraPassword: canEditGiftViettelCamera ? editGiftCameraPassword.trim() || null : null,
      } : previousWorkflow.internetInstall,
      billgoAddOn: isInternetInstallReceipt && selectedEditAddOnPackage ? {
        packageId: selectedEditAddOnPackage.id,
        packageName: selectedEditAddOnPackage.name,
        packageType: selectedEditAddOnPackage.type,
        monthlyFee: editAddOnMonthlyFee,
        cycle: editAddOnCycle,
        subscriptionAmount: editAddOnTotal,
        totalAmount: editAddOnTotal,
        totalAmountInWords: readVietnameseMoney(editAddOnTotal),
        note: editAddOnNote.trim() || null,
        selectedAt: getStringValue(previousWorkflow.billgoAddOn?.selectedAt) || new Date().toISOString(),
      } : undefined,
      receiptRevision: Number(previousWorkflow.receiptRevision || 0) + 1,
      receiptEditHistory: nextHistory,
    };

    const { error } = await supabase
      .from("jobs")
      .update({
        completion_items: cleanedItems,
        final_amount: nextAmount,
        warranty_days: nextWarrantyDays,
        workflow_data: nextWorkflow,
      })
      .eq("id", job.id);

    setSavingEdit(false);

    if (error) {
      setEditError("Không thể lưu sửa phiếu: " + error.message);
      return;
    }

    if (isInternetInstallReceipt && editInternetMonthlyFeeNumber > 0 && job.customer_id && (currentWorkerId || job.worker_id)) {
      const startDate = getStringValue(nextWorkflow.billgo?.startDate) || new Date().toISOString().slice(0, 10);
      const billingPeriod = getBillGoBillingPeriod(startDate, editInternetCycle);
      const cycle = getBillGoCycleOption(editInternetCycle);
      const billGoWorkerId = currentWorkerId || job.worker_id || null;
      const billGoCustomerName = customerName || null;
      const billGoPhone = customerPhone || null;
      const billGoAddress = job.address || (Array.isArray(job.customer) ? job.customer[0]?.address : job.customer?.address) || null;
      const packageName = selectedEditInternetPackage?.name || serviceName || "Cước Internet";

      const { data: existingSubscription, error: existingSubscriptionError } = await supabase
        .from("billgo_subscriptions")
        .select("id")
        .eq("job_id", job.id)
        .eq("service_type", "internet")
        .maybeSingle();

      if (existingSubscriptionError) {
        setEditError("Phiếu đã lưu nhưng chưa đồng bộ được BillGo: " + existingSubscriptionError.message);
        setSavingEdit(false);
        return;
      }

      let subscriptionId = existingSubscription?.id || null;
      const subscriptionPayload = {
        customer_id: job.customer_id,
        worker_id: billGoWorkerId,
        job_id: job.id,
        service_id: job.service_id || null,
        customer_name: billGoCustomerName,
        phone: billGoPhone,
        customer_address: billGoAddress,
        provider: selectedEditInternetPackage?.provider || null,
        package_id: selectedEditInternetPackage?.id || null,
        package_name: packageName,
        service_type: "internet",
        cycle: editInternetCycle,
        current_cycle: editInternetCycle,
        amount_per_cycle: editInternetMonthlyFeeNumber,
        monthly_fee: editInternetMonthlyFeeNumber,
        start_date: billingPeriod.periodStart,
        next_due_date: billingPeriod.dueDate,
        next_period_start: billingPeriod.periodStart,
        status: "active",
        note: getStringValue(nextWorkflow.billgo?.note) || null,
        created_by: currentUserId,
      };

      if (subscriptionId) {
        const { error: subscriptionUpdateError } = await supabase
          .from("billgo_subscriptions")
          .update(subscriptionPayload)
          .eq("id", subscriptionId);
        if (subscriptionUpdateError) {
          setEditError("Phiếu đã lưu nhưng chưa cập nhật được khách BillGo: " + subscriptionUpdateError.message);
          setSavingEdit(false);
          return;
        }
      } else {
        const { data: subscription, error: subscriptionInsertError } = await supabase
          .from("billgo_subscriptions")
          .insert(subscriptionPayload)
          .select("id")
          .single();
        if (subscriptionInsertError) {
          setEditError("Phiếu đã lưu nhưng chưa tạo được khách BillGo: " + subscriptionInsertError.message);
          setSavingEdit(false);
          return;
        }
        subscriptionId = subscription.id;
      }

      const totalAmount = getBillGoCollectableAmount(editInternetMonthlyFeeNumber, editInternetCycle);
      const { data: existingReceivable, error: existingReceivableError } = await supabase
        .from("billgo_receivables")
        .select("id")
        .eq("job_id", job.id)
        .eq("subscription_id", subscriptionId)
        .eq("type", "subscription_fee")
        .maybeSingle();

      if (existingReceivableError) {
        setEditError("Phiếu đã lưu nhưng chưa kiểm tra được khoản thu BillGo: " + existingReceivableError.message);
        setSavingEdit(false);
        return;
      }

      const receivablePayload = {
        customer_id: job.customer_id,
        worker_id: billGoWorkerId,
        job_id: job.id,
        subscription_id: subscriptionId,
        type: "subscription_fee",
        package_id: selectedEditInternetPackage?.id || null,
        package_name_at_collection: selectedEditInternetPackage?.name || null,
        title: `Thu cước ${packageName}`,
        total_amount: totalAmount,
        due_date: billingPeriod.dueDate,
        period_start: billingPeriod.periodStart,
        period_end: billingPeriod.periodEnd,
        billing_months: cycle.paidMonths,
        bonus_months: cycle.bonusMonths,
        cycle_at_collection: editInternetCycle,
        service_months: cycle.paidMonths + cycle.bonusMonths,
        monthly_fee_at_collection: editInternetMonthlyFeeNumber,
        status: getBillGoStoredStatus(totalAmount, 0, billingPeriod.dueDate),
        note: getStringValue(nextWorkflow.billgo?.note) || null,
        created_by: currentUserId,
      };

      const receivableResult = existingReceivable
        ? await supabase.from("billgo_receivables").update(receivablePayload).eq("id", existingReceivable.id)
        : await supabase.from("billgo_receivables").insert({ ...receivablePayload, paid_amount: 0 });

      if (receivableResult.error) {
        setEditError("Phiếu đã lưu nhưng chưa đồng bộ được khoản thu BillGo: " + receivableResult.error.message);
        setSavingEdit(false);
        return;
      }
    }

    if (isInternetInstallReceipt && selectedEditAddOnPackage && job.customer_id && (currentWorkerId || job.worker_id)) {
      const startDate = new Date().toISOString().slice(0, 10);
      const billingPeriod = getBillGoBillingPeriod(startDate, editAddOnCycle);
      const cycle = getBillGoCycleOption(editAddOnCycle);
      const billGoWorkerId = currentWorkerId || job.worker_id || null;
      const billGoAddress = job.address || (Array.isArray(job.customer) ? job.customer[0]?.address : job.customer?.address) || null;
      const totalAmount = getBillGoCollectableAmount(editAddOnMonthlyFee, editAddOnCycle);
      const note = [
        `Bổ sung khi sửa phiếu ${job.job_code || job.id}`,
        editAddOnNote.trim(),
      ].filter(Boolean).join(" · ");

      const { data: existingSubscription, error: existingSubscriptionError } = await supabase
        .from("billgo_subscriptions")
        .select("id")
        .eq("job_id", job.id)
        .eq("package_id", selectedEditAddOnPackage.id)
        .maybeSingle();

      if (existingSubscriptionError) {
        setEditError("Phiếu đã lưu nhưng chưa kiểm tra được gói TV/đầu thu BillGo: " + existingSubscriptionError.message);
        setSavingEdit(false);
        return;
      }

      let subscriptionId = existingSubscription?.id || null;
      const subscriptionPayload = {
        customer_id: job.customer_id,
        worker_id: billGoWorkerId,
        job_id: job.id,
        service_id: job.service_id || null,
        customer_name: customerName || null,
        phone: customerPhone || null,
        customer_address: billGoAddress,
        provider: selectedEditAddOnPackage.provider || null,
        package_id: selectedEditAddOnPackage.id,
        package_name: selectedEditAddOnPackage.name,
        service_type: selectedEditAddOnPackage.type,
        cycle: editAddOnCycle,
        current_cycle: editAddOnCycle,
        amount_per_cycle: editAddOnMonthlyFee,
        monthly_fee: editAddOnMonthlyFee,
        start_date: billingPeriod.periodStart,
        next_due_date: billingPeriod.dueDate,
        next_period_start: billingPeriod.periodStart,
        status: "active",
        note: note || null,
        created_by: currentUserId,
      };

      if (subscriptionId) {
        const { error: subscriptionUpdateError } = await supabase
          .from("billgo_subscriptions")
          .update(subscriptionPayload)
          .eq("id", subscriptionId);
        if (subscriptionUpdateError) {
          setEditError("Phiếu đã lưu nhưng chưa cập nhật được gói TV/đầu thu BillGo: " + subscriptionUpdateError.message);
          setSavingEdit(false);
          return;
        }
      } else {
        const { data: subscription, error: subscriptionInsertError } = await supabase
          .from("billgo_subscriptions")
          .insert(subscriptionPayload)
          .select("id")
          .single();
        if (subscriptionInsertError) {
          setEditError("Phiếu đã lưu nhưng chưa tạo được gói TV/đầu thu BillGo: " + subscriptionInsertError.message);
          setSavingEdit(false);
          return;
        }
        subscriptionId = subscription.id;
      }

      const { data: existingReceivable, error: existingReceivableError } = await supabase
        .from("billgo_receivables")
        .select("id")
        .eq("job_id", job.id)
        .eq("package_id", selectedEditAddOnPackage.id)
        .eq("type", "subscription_fee")
        .maybeSingle();

      if (existingReceivableError) {
        setEditError("Phiếu đã lưu nhưng chưa kiểm tra được khoản thu TV/đầu thu: " + existingReceivableError.message);
        setSavingEdit(false);
        return;
      }

      const receivablePayload = {
        customer_id: job.customer_id,
        worker_id: billGoWorkerId,
        job_id: job.id,
        subscription_id: subscriptionId,
        type: "subscription_fee",
        package_id: selectedEditAddOnPackage.id,
        package_name_at_collection: selectedEditAddOnPackage.name,
        title: `Thu cước ${selectedEditAddOnPackage.name}`,
        total_amount: totalAmount,
        due_date: billingPeriod.dueDate,
        period_start: billingPeriod.periodStart,
        period_end: billingPeriod.periodEnd,
        billing_months: cycle.paidMonths,
        bonus_months: cycle.bonusMonths,
        cycle_at_collection: editAddOnCycle,
        service_months: cycle.paidMonths + cycle.bonusMonths,
        monthly_fee_at_collection: editAddOnMonthlyFee,
        status: getBillGoStoredStatus(totalAmount, 0, billingPeriod.dueDate),
        note: note || null,
        created_by: currentUserId,
      };

      const receivableResult = existingReceivable
        ? await supabase.from("billgo_receivables").update(receivablePayload).eq("id", existingReceivable.id)
        : await supabase.from("billgo_receivables").insert({ ...receivablePayload, paid_amount: 0 });

      if (receivableResult.error) {
        setEditError("Phiếu đã lưu nhưng chưa đồng bộ được khoản thu TV/đầu thu: " + receivableResult.error.message);
        setSavingEdit(false);
        return;
      }
    }

    setJob({
      ...job,
      completion_items: cleanedItems,
      final_amount: nextAmount,
      warranty_days: nextWarrantyDays,
      workflow_data: nextWorkflow,
    });
    setEditModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded-xl border border-outline-variant/30 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-on-surface">
            {detailMessage || "Không tìm thấy công việc."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/worker/history")}
            className="btn-outline mt-4 !w-auto !px-4 !py-2 text-sm font-bold"
          >
            Quay lại Lịch sử
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = job.status === 'completed' || job.status === 'done';
  const customerName = Array.isArray(job.customer) ? job.customer[0]?.full_name : job.customer?.full_name;
  const customerPhone = Array.isArray(job.customer) ? job.customer[0]?.phone : job.customer?.phone;
  const customerAddress = Array.isArray(job.customer) ? job.customer[0]?.address : job.customer?.address;
  const directionDestination = (job.address || customerAddress || "").trim();
  const mobileDirectionsUrl = directionDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionDestination)}`
    : "";
  const canUseMobileJobActions = CANCELABLE_JOB_STATUSES.has(job.status || "");
  const completedDate = new Date(job.updated_at || job.scheduled_at);
  const scheduledDate = new Date(job.scheduled_at);
  const completionItems: CompletionItem[] = Array.isArray(job.completion_items) && job.completion_items.length > 0
    ? job.completion_items
    : [{
        name: job.service?.name || 'Công dịch vụ',
        quantity: 1,
        unitPrice: Number(job.quoted_price || 0),
        warrantyDays: Number(job.warranty_days || 30),
      }];
  const finalAmount = Number(job.final_amount || completionItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0));
  const serviceName = job.service?.name || completionItems[0]?.name || "Công dịch vụ";
  const jobServices = getJobServices({ service: job.service, job_services: job.job_services });
  const isInternetInstallReceipt = isInternetInstallReceiptForJob(job);
  const warrantyDays = Number(job.warranty_days || completionItems.reduce((max, item) => Math.max(max, Number(item.warrantyDays || 0)), 0));
  const warrantyUntil = new Date(completedDate);
  warrantyUntil.setDate(warrantyUntil.getDate() + warrantyDays);
  const completionImages = job.images || [];
  const firstRating = job.ratings?.[0];
  const ratingImages = firstRating?.images || [];
  const receiptEditHistory = Array.isArray(job.workflow_data?.receiptEditHistory)
    ? job.workflow_data.receiptEditHistory
    : [];
  const editInternetPackages = billGoPackages.filter(pkg => pkg.is_active && pkg.type === "internet");
  const editAddOnPackages = billGoPackages.filter(pkg => pkg.is_active && (pkg.type === "tv360" || pkg.type === "receiver"));
  const selectedEditInternetPackage = editInternetPackages.find(pkg => pkg.id === editInternetPackageId) || null;
  const selectedEditAddOnPackage = editAddOnPackages.find(pkg => pkg.id === editAddOnPackageId) || null;
  const editInternetMonthlyFeeNumber = isInternetInstallReceipt && selectedEditInternetPackage
    ? getBillGoPackagePrice(selectedEditInternetPackage)
    : isInternetInstallReceipt ? getNumberValue(editInternetMonthlyFee) : 0;
  const editInternetInstallFee = INTERNET_INSTALL_FEE_OPTIONS.includes(getNumberValue(editInternetInstallFeeInput))
    ? (isInternetInstallReceipt ? getNumberValue(editInternetInstallFeeInput) : 0)
    : (isInternetInstallReceipt ? INTERNET_INSTALL_FEE_OPTIONS[0] : 0);
  const editInternetCycleTotal = editInternetMonthlyFeeNumber > 0
    ? getBillGoCollectableAmount(editInternetMonthlyFeeNumber, editInternetCycle)
    : 0;
  const editInternetReceiptTotal = editInternetCycle === "monthly" ? 0 : editInternetCycleTotal;
  const editAddOnAllowedCycles = new Set([
    ...(selectedEditAddOnPackage?.allowed_cycles || []),
    ...BILLGO_SIGNUP_CYCLES,
  ]);
  const editAddOnCycleOptions = BILLGO_CYCLE_OPTIONS.filter(option =>
    BILLGO_SIGNUP_CYCLES.includes(option.value) && editAddOnAllowedCycles.has(option.value)
  );
  const editAddOnMonthlyFee = isInternetInstallReceipt ? getBillGoPackagePrice(selectedEditAddOnPackage) : 0;
  const editAddOnTotal = isInternetInstallReceipt && selectedEditAddOnPackage
    ? getBillGoCollectableAmount(editAddOnMonthlyFee, editAddOnCycle)
    : 0;
  const canEditGiftViettelCamera = editInternetInstallFee === 400000 && editInternetCycle !== "monthly";
  const editGiftCameraAccountValue = canEditGiftViettelCamera ? (customerPhone || "").trim() : "";
  const editGeneratedItems = ([
    editInternetInstallFee > 0 ? {
      name: "Phí lắp đặt Internet",
      quantity: 1,
      unitPrice: editInternetInstallFee,
      warrantyDays: 0,
      generatedKey: "internet-install-fee",
    } : null,
    editInternetReceiptTotal > 0 ? {
      name: `Cước Internet ${getBillGoCycleOption(editInternetCycle).label}${selectedEditInternetPackage ? ` - ${selectedEditInternetPackage.name}` : ""}`,
      quantity: 1,
      unitPrice: editInternetReceiptTotal,
      warrantyDays: 0,
      generatedKey: "internet-package",
    } : null,
    isInternetInstallReceipt && selectedEditAddOnPackage ? {
      name: `${getBillGoPackageTypeLabel(selectedEditAddOnPackage.type)} - ${selectedEditAddOnPackage.name} (${getBillGoCycleOption(editAddOnCycle).label})`,
      quantity: 1,
      unitPrice: editAddOnTotal,
      warrantyDays: 0,
      generatedKey: "billgo-addon",
    } : null,
    canEditGiftViettelCamera && editGiftCamera ? {
      name: `Tặng kèm: ${editGiftCamera}`,
      quantity: 1,
      unitPrice: 0,
      warrantyDays: 0,
      generatedKey: "viettel-gift-camera",
    } : null,
  ] as Array<CompletionItem | null>).filter((item): item is CompletionItem => Boolean(item));
  const editChargeableManualItems = editItems.filter((item, index) => !isInitialInternetServiceItem(job, item, index));
  const editTotal = calculateItemsTotal(editChargeableManualItems) + calculateItemsTotal(editGeneratedItems);

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface animate-fade-in">
      <style>{`
        @media print {
          @page {
            margin: 14mm;
          }

          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .invoice-print-area,
          .invoice-print-area * {
            visibility: visible !important;
          }

          .invoice-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 px-4 h-14 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-full transition-colors -ml-2">
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="text-body-lg font-bold text-on-surface">Chi tiết công việc</h1>
      </div>

      <div className="flex-1 p-4 space-y-6 pb-10">
        {/* Status Hero */}
        <div className={`relative flex flex-col items-center overflow-hidden rounded-xl border p-5 text-center shadow-sm sm:p-6 ${
          isCompleted
            ? 'border-success/20 bg-linear-to-br from-primary via-primary-container to-success text-white'
            : 'border-error/20 bg-linear-to-br from-primary via-primary-container to-error text-white'
        }`}>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" />
          <div className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
            isCompleted 
              ? 'bg-white text-success' 
              : 'bg-white text-error'
          }`}>
            {isCompleted ? <CheckCircleIcon size={32} /> : <XIcon size={32} />}
          </div>
          <div className="relative mt-3">
            <h2 className={`text-xl font-extrabold ${isCompleted ? "text-primary-fixed" : "text-white"}`}>
              {isCompleted ? 'Đã hoàn thành' : 'Đã hủy'}
            </h2>
            <p className="mt-1 break-all font-mono text-label-md font-medium text-white/75">{job.job_code}</p>
          </div>
          <div className="relative mt-3 rounded-lg bg-white px-4 py-2 text-2xl font-extrabold text-primary-container shadow-sm">
            {formatCurrency(finalAmount)}
          </div>
        </div>


        {canUseMobileJobActions && (
          <div className="md:hidden space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openCancelModal}
                className="flex min-h-12 items-center justify-center rounded-xl border border-error/25 bg-error-container px-4 py-3 text-sm font-extrabold text-on-error-container shadow-sm"
              >
                Hủy
              </button>
              {mobileDirectionsUrl ? (
                <a
                  href={mobileDirectionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 text-sm font-extrabold text-white shadow-sm"
                >
                  <MapPinIcon size={18} />
                  Chỉ đường
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-container px-4 py-3 text-sm font-extrabold text-on-surface-variant opacity-70"
                >
                  <MapPinIcon size={18} />
                  Chỉ đường
                </button>
              )}
            </div>
            {cancelFeedback && (
              <div className="rounded-xl border border-outline-variant/30 bg-white px-4 py-3 text-sm font-semibold text-on-surface shadow-sm">
                {cancelFeedback}
              </div>
            )}
          </div>
        )}
        {/* Service Info */}
        <div className="space-y-3">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Dịch vụ</h3>
          <div className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-white p-4 shadow-sm sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm">
              <BriefcaseIcon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{serviceName}</p>
              {job.service?.description && (
                <p className="text-label-sm text-on-surface-variant line-clamp-1">{job.service.description}</p>
              )}
            </div>
          </div>
          {jobServices.length > 1 && (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Các dịch vụ đã chọn</p>
              <ul className="mt-2 space-y-2">
                {jobServices.map(service => (
                  <li key={service.id} className="flex items-start gap-2 text-sm font-bold text-on-surface">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-container" />
                    {service.name || "Dịch vụ"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Khách hàng</h3>
          <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-lg shadow-blue-900/5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-lg font-bold text-white">
              {(customerName || 'K').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-on-surface truncate">{customerName || 'Khách vãng lai'}</p>
              {customerPhone && (
                <p className="text-label-sm text-on-surface-variant">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <a 
                href={`tel:${customerPhone}`} 
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-md shadow-green-700/20 transition-all hover:brightness-110"
              >
                <PhoneIcon size={20} />
              </a>
            )}
          </div>
        </div>

        {/* Location & Time */}
        <div className="space-y-4">
          <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Thông tin chi tiết</h3>
          
          <div className="space-y-4 rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-lg shadow-blue-900/5">
            {/* Address */}
            {job.address && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <MapPinIcon size={18} />
                </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Địa chỉ thi công</p>
                  <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">{job.address}</p>
                </div>
              </div>
            )}

            {/* Scheduled Time */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                <CalendarIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Lịch hẹn</p>
                <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">
                  {scheduledDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' — '}
                  {scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Completed Time */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                isCompleted ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                <ClockIcon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                  {isCompleted ? 'Thời gian hoàn thành' : 'Thời gian hủy'}
                </p>
                <p className="text-body-sm font-medium text-on-surface mt-0.5 break-words">
                  {completedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' — '}
                  {completedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Earnings */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                <DollarSignIcon size={18} />
              </div>
              <div>
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Thu nhập</p>
                <p className="text-body-md font-bold text-success mt-0.5">{formatCurrency(finalAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice & Warranty */}
        {isCompleted && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Hóa đơn & bảo hành</h3>
              <div className="no-print flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openEditReceipt}
                  className="rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Sửa phiếu
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-bold text-primary-container"
                >
                  In / Xuất hóa đơn
                </button>
              </div>
            </div>

            <div className="invoice-print-area space-y-4 rounded-xl border border-outline-variant/20 bg-white p-4 shadow-sm">
              <div className="border-b border-outline-variant/30 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-on-surface-variant">Phiếu thu dịch vụ</p>
                    <p className="mt-1 text-xl font-extrabold text-on-surface">Hóa Đơn Công Việc</p>
                    <p className="mt-1 font-mono text-sm font-bold text-primary-container">{job.job_code || job.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant">Ngày xuất</p>
                    <p className="text-sm font-bold text-on-surface">{completedDate.toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Khách hàng</p>
                  <p className="mt-1 font-bold text-on-surface">{customerName || "Khách vãng lai"}</p>
                  {customerPhone && <p className="mt-0.5 text-on-surface-variant">{customerPhone}</p>}
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Dịch vụ</p>
                  <p className="mt-1 font-bold text-on-surface">{serviceName}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3 sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Địa chỉ thi công</p>
                  <p className="mt-1 font-medium text-on-surface">{job.address || "Chưa cập nhật"}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Lịch hẹn</p>
                  <p className="mt-1 font-medium text-on-surface">
                    {scheduledDate.toLocaleDateString('vi-VN')} {scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Hoàn thành</p>
                  <p className="mt-1 font-medium text-on-surface">
                    {completedDate.toLocaleDateString('vi-VN')} {completedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface-variant">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">Hạng mục</th>
                      <th className="px-3 py-2 text-center font-bold">SL</th>
                      <th className="px-3 py-2 text-right font-bold">Đơn giá</th>
                      <th className="px-3 py-2 text-center font-bold">BH</th>
                      <th className="px-3 py-2 text-right font-bold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completionItems.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(item.unitPrice || 0);
                      return (
                        <tr key={`${item.name}-${index}`} className="border-t border-outline-variant/20">
                          <td className="px-3 py-3 font-semibold text-on-surface">{item.name || `Hạng mục ${index + 1}`}</td>
                          <td className="px-3 py-3 text-center font-semibold text-on-surface-variant">{quantity}</td>
                          <td className="px-3 py-3 text-right text-on-surface-variant">{formatCurrency(unitPrice)}</td>
                          <td className="px-3 py-3 text-center text-on-surface-variant">{Number(item.warrantyDays || 0)} ngày</td>
                          <td className="px-3 py-3 text-right font-bold text-on-surface">{formatCurrency(quantity * unitPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 border-t border-outline-variant/30 pt-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-on-surface-variant">Báo giá ban đầu</span>
                  <span className="font-bold text-on-surface">{formatCurrency(Number(job.quoted_price || 0))}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-success-container px-4 py-3">
                  <span className="text-sm font-bold text-on-success-container">Tổng thanh toán</span>
                  <span className="text-xl font-extrabold text-success">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              {receiptEditHistory.length > 0 && (
                <div className="no-print rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-800">Lịch sử sửa phiếu</p>
                  <div className="mt-3 space-y-2">
                    {receiptEditHistory.slice().reverse().map((entry, index) => (
                      <div key={`${entry.editedAt}-${index}`} className="rounded-lg bg-white/75 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-on-surface">{entry.editedBy || "Thợ thực hiện"}</span>
                          <span className="text-xs font-medium text-on-surface-variant">
                            {new Date(entry.editedAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <p className="mt-1 text-on-surface-variant">{entry.reason}</p>
                        <p className="mt-1 text-xs font-bold text-amber-800">
                          {formatCurrency(Number(entry.previousAmount || 0))} → {formatCurrency(Number(entry.nextAmount || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-success/20 bg-success-container/35 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-container text-success">
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-on-surface">Phiếu bảo hành</p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Hiệu lực {warrantyDays} ngày, đến {warrantyUntil.toLocaleDateString('vi-VN')}.
                    </p>
                    {job.warranty_note && (
                      <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-on-surface-variant">
                        {job.warranty_note}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-outline-variant/30 pt-4">
                <div className="min-w-[12rem] text-center">
                  <p className="text-[11px] font-bold uppercase text-on-surface-variant">Thợ Thi Công</p>
                  <p className="mt-1 font-bold text-on-surface">{workerName}</p>
                  {workerPhone && <p className="mt-0.5 text-sm text-on-surface-variant">{workerPhone}</p>}
                </div>
              </div>

              <p className="text-center text-[11px] font-semibold text-on-surface-variant">
                Phiếu được tạo từ hệ thống Thợ đến ngay. Vui lòng đối chiếu mã đơn khi cần hỗ trợ.
              </p>
            </div>
          </div>
        )}

        {cancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:hidden">
            <form onSubmit={requestCancelJob} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-error">Yêu cầu huỷ</p>
                  <h2 className="mt-1 text-lg font-bold text-on-surface">Huỷ công việc</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Yêu cầu sẽ được gửi để admin duyệt như luồng hiện tại.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="rounded-full bg-surface-container p-2 text-on-surface-variant"
                  disabled={requestingCancel}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold text-on-surface-variant">Lý do huỷ</span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-xl border border-outline-variant/35 bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
                  disabled={requestingCancel}
                />
              </label>

              {cancelFeedback && (
                <div className="mt-3 rounded-xl border border-error/20 bg-error-container/60 p-3 text-sm font-semibold text-on-error-container">
                  {cancelFeedback}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3 text-sm font-bold text-on-surface"
                  disabled={requestingCancel}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-error px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  disabled={requestingCancel}
                >
                  {requestingCancel ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </form>
          </div>
        )}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
            <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-3xl sm:rounded-2xl sm:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3">
                <div>
                  <h3 className="text-lg font-extrabold text-on-surface">Sửa phiếu thu</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Cập nhật lại vật tư, gói cước hoặc chi phí bị thiếu. Hệ thống sẽ lưu lịch sử sửa phiếu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface-variant"
                  aria-label="Đóng"
                  disabled={savingEdit}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {editItems.map((item, index) => (
                  <div key={index} className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase text-on-surface-variant">Hạng mục {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeEditItem(index)}
                        className="text-xs font-bold text-error disabled:opacity-40"
                        disabled={editItems.length <= 1 || savingEdit}
                      >
                        Xóa
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-12">
                      <label className="sm:col-span-5">
                        <span className="text-xs font-bold text-on-surface-variant">Tên hạng mục</span>
                        <input
                          value={item.name}
                          onChange={(event) => updateEditItem(index, { name: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                          placeholder="Ví dụ: Phí lắp đặt Internet"
                          disabled={savingEdit}
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="text-xs font-bold text-on-surface-variant">SL</span>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(event) => updateEditItem(index, { quantity: Number(event.target.value) })}
                          className="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                          disabled={savingEdit}
                        />
                      </label>
                      <label className="sm:col-span-3">
                        <span className="text-xs font-bold text-on-surface-variant">Đơn giá</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={item.unitPrice}
                          onChange={(event) => updateEditItem(index, { unitPrice: Number(event.target.value) })}
                          className="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                          disabled={savingEdit}
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="text-xs font-bold text-on-surface-variant">BH ngày</span>
                        <input
                          type="number"
                          min="0"
                          value={item.warrantyDays}
                          onChange={(event) => updateEditItem(index, { warrantyDays: Number(event.target.value) })}
                          className="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                          disabled={savingEdit}
                        />
                      </label>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setEditItems(current => [...current, makeEditItem()])}
                  className="w-full rounded-xl border border-dashed border-primary-container/40 bg-primary-fixed/40 px-4 py-3 text-sm font-bold text-primary-container"
                  disabled={savingEdit}
                >
                  Thêm hạng mục
                </button>

                {isInternetInstallReceipt && (
                  <>
                    <div className="rounded-xl border border-primary-container/20 bg-primary-fixed/35 p-4">
                      <div className="mb-3">
                        <p className="text-sm font-extrabold text-on-surface">Gói Internet lắp mới</p>
                        <p className="mt-1 text-xs text-on-surface-variant">Chọn lại gói, chu kỳ đóng và phí lắp đặt để hệ thống tự tính dòng phiếu.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs font-bold text-on-surface-variant">Gói Internet</span>
                      <select
                        className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                        value={editInternetPackageId}
                        onChange={(event) => {
                          const nextPackage = editInternetPackages.find(pkg => pkg.id === event.target.value) || null;
                          setEditInternetPackageId(event.target.value);
                          if (nextPackage) setEditInternetMonthlyFee(String(getBillGoPackagePrice(nextPackage)));
                        }}
                        disabled={savingEdit}
                      >
                        <option value="">Nhập cước Internet thủ công</option>
                        {editInternetPackages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} - {formatCurrency(getBillGoPackagePrice(pkg))}/tháng
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-on-surface-variant">Cước/tháng</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={editInternetMonthlyFee}
                        onChange={(event) => {
                          setEditInternetPackageId("");
                          setEditInternetMonthlyFee(event.target.value);
                        }}
                        className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                        disabled={savingEdit || Boolean(selectedEditInternetPackage)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-on-surface-variant">Chu kỳ Internet</span>
                      <select
                        className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                        value={editInternetCycle}
                        onChange={(event) => {
                          const nextCycle = event.target.value as BillGoCycle;
                          setEditInternetCycle(nextCycle);
                          if (nextCycle === "monthly") {
                            setEditGiftCamera("");
                            setEditGiftCameraPassword("");
                          }
                        }}
                        disabled={savingEdit}
                      >
                        {BILLGO_CYCLE_OPTIONS.filter(option => INTERNET_COMPLETION_CYCLES.includes(option.value)).map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-bold text-on-surface-variant">Phí lắp đặt</span>
                      <select
                        className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                        value={editInternetInstallFeeInput}
                        onChange={(event) => {
                          setEditInternetInstallFeeInput(event.target.value);
                          if (event.target.value !== "400000") {
                            setEditGiftCamera("");
                            setEditGiftCameraPassword("");
                          }
                        }}
                        disabled={savingEdit}
                      >
                        {INTERNET_INSTALL_FEE_OPTIONS.map(fee => (
                          <option key={fee} value={String(fee)}>{formatCurrency(fee)}</option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-on-surface-variant">Cước thu trên phiếu</span>
                      <div className="rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-extrabold text-success">
                        {formatCurrency(editInternetReceiptTotal)}
                      </div>
                    </div>
                    {canEditGiftViettelCamera && (
                      <div className="space-y-3 sm:col-span-2">
                        <label className="block space-y-1">
                          <span className="text-xs font-bold text-on-surface-variant">Camera Viettel tặng kèm</span>
                          <select
                            className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                            value={editGiftCamera}
                            onChange={(event) => setEditGiftCamera(event.target.value)}
                            disabled={savingEdit}
                          >
                            <option value="">Chọn loại camera</option>
                            {VIETTEL_GIFT_CAMERA_OPTIONS.map(cameraName => (
                              <option key={cameraName} value={cameraName}>{cameraName}</option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-xs font-bold text-on-surface-variant">Tài khoản camera</span>
                            <input
                              className="w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface outline-none"
                              value={editGiftCameraAccountValue}
                              placeholder="Tự lấy SĐT khách"
                              readOnly
                              disabled={savingEdit}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-bold text-on-surface-variant">Mật khẩu camera</span>
                            <input
                              className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                              value={editGiftCameraPassword}
                              onChange={(event) => setEditGiftCameraPassword(event.target.value)}
                              placeholder="Nhập mật khẩu bàn giao"
                              disabled={savingEdit}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-4">
                      <div className="mb-3">
                        <p className="text-sm font-extrabold text-on-surface">Dịch vụ xem TV thêm</p>
                        <p className="mt-1 text-xs text-on-surface-variant">Chọn thêm TV360 hoặc đầu thu nếu khách phát sinh sau khi lắp Internet.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs font-bold text-on-surface-variant">Gói TV/đầu thu</span>
                      <select
                        className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                        value={editAddOnPackageId}
                        onChange={(event) => {
                          setEditAddOnPackageId(event.target.value);
                          setEditAddOnCycle("monthly");
                        }}
                        disabled={savingEdit}
                      >
                        <option value="">Không chọn thêm</option>
                        {editAddOnPackages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {getBillGoPackageTypeLabel(pkg.type)} - {pkg.name} - {formatCurrency(getBillGoPackagePrice(pkg))}/tháng
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedEditAddOnPackage && (
                      <>
                        <label className="space-y-1">
                          <span className="text-xs font-bold text-on-surface-variant">Chu kỳ gói thêm</span>
                          <select
                            className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                            value={editAddOnCycle}
                            onChange={(event) => setEditAddOnCycle(event.target.value as BillGoCycle)}
                            disabled={savingEdit}
                          >
                            {editAddOnCycleOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-on-surface-variant">Tổng gói thêm</span>
                          <div className="rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-extrabold text-primary-container">
                            {formatCurrency(editAddOnTotal)}
                          </div>
                        </div>
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-xs font-bold text-on-surface-variant">Ghi chú gói thêm</span>
                          <input
                            className="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary-container"
                            value={editAddOnNote}
                            onChange={(event) => setEditAddOnNote(event.target.value)}
                            placeholder="Ví dụ: Khách chọn thêm TV360 sau nghiệm thu"
                            disabled={savingEdit}
                          />
                        </label>
                      </>
                    )}
                      </div>
                    </div>

                    {editGeneratedItems.length > 0 && (
                      <div className="rounded-xl border border-success/20 bg-success-container/35 p-4">
                        <p className="text-xs font-bold uppercase text-on-success-container">Dòng hệ thống sẽ thêm vào phiếu</p>
                        <div className="mt-2 space-y-1">
                          {editGeneratedItems.map(item => (
                            <div key={item.generatedKey} className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-on-surface">{item.name}</span>
                              <span className="shrink-0 font-extrabold text-success">{formatCurrency(item.unitPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant">Lý do sửa phiếu</span>
                  <textarea
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    className="mt-1 min-h-24 w-full rounded-xl border border-outline-variant/35 bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary-container"
                    placeholder="Ví dụ: Bổ sung vật tư phát sinh hoặc chọn lại gói cước đúng"
                    disabled={savingEdit}
                  />
                </label>

                {editError && (
                  <div className="rounded-xl border border-error/20 bg-error-container/60 p-3 text-sm font-semibold text-on-error-container">
                    {editError}
                  </div>
                )}

                <div className="rounded-xl bg-success-container px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-on-success-container">Tổng mới</span>
                    <span className="text-xl font-extrabold text-success">{formatCurrency(editTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3 text-sm font-bold text-on-surface"
                  disabled={savingEdit}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={saveReceiptEdit}
                  className="rounded-xl bg-primary-container px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Đang lưu..." : "Lưu phiếu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Description / Notes */}
        {job.description && (
          <div className="space-y-3">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Mô tả công việc</h3>
            <div className="bg-surface-container-low p-4 rounded-xl text-body-sm text-on-surface-variant italic leading-relaxed break-words">
              &ldquo;{job.description}&rdquo;
            </div>
          </div>
        )}

        <TaskAttachmentList attachments={job.task_attachments} />

        {/* Completion Images */}
        {isCompleted && completionImages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Hình ảnh nghiệm thu</h3>
              <span className="text-[10px] px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-medium">
                {completionImages.length} ảnh
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {completionImages.map((imgUrl: string, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low shadow-sm group">
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <Image
                      src={imgUrl}
                      alt={`Ảnh nghiệm thu ${idx + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 180px"
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      unoptimized
                    />
                  </a>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                    {idx + 1}/{completionImages.length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Rating */}
        {firstRating && (
          <div className="space-y-3">
            <h3 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Đánh giá từ khách hàng</h3>
            <div className="card !p-5 space-y-3 border-amber-200/30 bg-amber-50/30">
              <div className="flex items-center gap-3 rounded-lg bg-white/70 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-bold text-white">
                  {(customerName || "K").charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Khách hàng đánh giá</p>
                  <p className="truncate text-sm font-bold text-on-surface">{customerName || "Khách vãng lai"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon 
                      key={star} 
                      size={18} 
                      className={star <= firstRating.score ? "fill-amber-400 text-amber-400" : "text-outline-variant"} 
                    />
                  ))}
                </div>
                <span className="text-label-sm text-on-surface-variant font-medium">
                  {new Date(firstRating.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              {firstRating.comment ? (
                <p className="text-body-sm text-on-surface-variant italic leading-relaxed break-words">&ldquo;{firstRating.comment}&rdquo;</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant/50 italic">Khách hàng không để lại bình luận.</p>
              )}
              {/* Rating images from customer */}
              {ratingImages.length > 0 && (
                <div className="pt-3 border-t border-amber-200/30">
                  <p className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ảnh đánh giá từ khách</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ratingImages.map((imgUrl: string, idx: number) => (
                      <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-low group">
                        <Image
                          src={imgUrl}
                          alt={`Ảnh đánh giá ${idx + 1}`}
                          fill
                          sizes="(max-width: 640px) 33vw, 120px"
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          unoptimized
                        />
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                          {idx + 1}/{ratingImages.length}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="pt-4">
          <button 
            onClick={() => router.push('/worker/history')} 
            className="w-full btn-outline !py-3.5 text-sm font-bold"
          >
            ← Quay lại Lịch sử
          </button>
        </div>
      </div>
    </div>
  );
}
