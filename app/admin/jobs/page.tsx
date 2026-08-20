"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyDefaultServiceParents, getSelectableServices, getServicePathLabel } from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import { DynamicServiceWorkflowForm } from "@/app/components/DynamicServiceWorkflowForm";
import { HierarchicalServiceSelector } from "@/app/components/HierarchicalServiceSelector";
import { normalizeServiceIds } from "@/lib/job-workflow";
import { formatFileSize, MAX_TASK_ATTACHMENTS } from "@/lib/task-attachments";
import { handoverWorkflowSectionKeys, pruneWorkflowData, type WorkflowData } from "@/config/serviceWorkflows";
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ChevronRightIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  MapPinIcon,
  CalendarIcon,
  XIcon
} from "../../components/icons";

interface CustomerOption {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  gps_location?: Record<string, unknown> | null;
}

interface ServiceOption {
  id: string;
  name?: string | null;
  icon?: string | null;
  base_price?: number | string | null;
  parent_service_id?: string | null;
}

interface WorkerOption {
  id: string;
  is_available?: boolean | null;
  profiles?: WorkerProfile | WorkerProfile[] | null;
}

interface WorkerProfile {
  full_name?: string | null;
  phone?: string | null;
}

interface JobWorkerProfile {
  full_name?: string | null;
}

interface JobRow {
  id: string;
  customer_id?: string | null;
  worker_id?: string | null;
  service_id?: string | null;
  service_detail_id?: string | null;
  job_code?: string | null;
  created_at?: string | null;
  address?: string | null;
  status?: string | null;
  total_price?: number | null;
  quoted_price?: number | string | null;
  final_amount?: number | string | null;
  cancellation_reason?: string | null;
  cancellation_requested_at?: string | null;
  cancellation_reviewed_at?: string | null;
  customer?: CustomerOption | null;
  service?: ServiceOption | null;
  job_services?: Array<{ service?: ServiceOption | null }> | null;
  worker?: {
    profiles?: JobWorkerProfile | null;
  } | null;
  customer_gps_location?: Record<string, unknown> | null;
  worker_gps_location?: Record<string, unknown> | null;
}

interface CreateJobResponse {
  error?: string;
  job?: JobRow;
  createdCustomer?: CustomerOption;
  loginPhone?: string;
  defaultPassword?: string;
  customerAlreadyExists?: boolean;
}

function getWorkerProfile(worker?: WorkerOption | null) {
  if (!worker?.profiles) return null;
  return Array.isArray(worker.profiles) ? worker.profiles[0] || null : worker.profiles;
}

function getJobStatusLabel(status?: string | null) {
  if (status === "pending") return "Chờ xử lý";
  if (status === "assigned") return "Đã nhận";
  if (status === "in_progress") return "Đang làm";
  if (status === "completed" || status === "done") return "Hoàn thành";
  if (status === "cancel_requested") return "Chờ duyệt huỷ";
  if (status === "cancelled") return "Đã hủy";
  return status || "Không rõ";
}

const JOB_STATUS_FILTERS = ["all", "pending", "assigned", "in_progress", "completed", "cancel_requested", "cancelled"] as const;
const ADMIN_JOBS_PAGE_SIZE = 50;

function matchesJobStatusFilter(jobStatus: string | null | undefined, statusFilter: string) {
  if (statusFilter === "all") return true;
  if (statusFilter === "completed") return jobStatus === "completed" || jobStatus === "done";
  return jobStatus === statusFilter;
}

function getJobStatusCardClass(status: string) {
  if (status === "completed") return "border-success-container bg-success-container/70 text-success";
  if (status === "pending" || status === "cancel_requested") return "border-primary-fixed-dim bg-primary-fixed text-primary-container";
  if (status === "cancelled") return "border-error-container bg-error-container/70 text-error";
  if (status === "all") return "border-primary-container bg-primary-fixed text-primary-container";
  return "border-outline-variant bg-surface-container-lowest text-on-surface";
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = useMemo(() => createClient(), []);

  // Create Job Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");

  const [newJob, setNewJob] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    serviceId: "",
    serviceIds: [] as string[],
    address: "",
    scheduledAt: "",
    quotedPrice: "",
    description: ""
  });
  const [workflowData, setWorkflowData] = useState<WorkflowData>({});
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);

  // Assign Worker Modal states
  const [assignWorkerModalOpen, setAssignWorkerModalOpen] = useState(false);
  const [workersList, setWorkersList] = useState<WorkerOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");
  const [approvingCancellationJobId, setApprovingCancellationJobId] = useState<string | null>(null);
  const [approvingWorkerJobId, setApprovingWorkerJobId] = useState<string | null>(null);
  const [updatingDetailJobId, setUpdatingDetailJobId] = useState<string | null>(null);

  async function fetchJobs() {
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        worker_id,
        service_id,
        service_detail_id,
        job_code,
        created_at,
        address,
        status,
        quoted_price,
        final_amount,
        cancellation_reason,
        cancellation_requested_at,
        cancellation_reviewed_at,
        customer_gps_location,
        worker_gps_location,
        customer:profiles!customer_id(id, full_name, phone, email, gps_location),
        service:services!jobs_service_id_fkey(id, name, icon, base_price, parent_service_id),
        job_services(service:services(id, name, icon, base_price, parent_service_id)),
        worker:workers(id, profiles(full_name))
      `)
      .order('created_at', { ascending: false })
      .range(0, ADMIN_JOBS_PAGE_SIZE - 1);

    if (data) setJobs(data as unknown as JobRow[]);
    setLoading(false);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([fetchJobs(), fetchServices()]);
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchServices() {
    const { data: sData, error: serviceError } = await supabase
      .from('services')
      .select('id, name, base_price, parent_service_id')
      .eq('is_active', true);
    if (sData) {
      const servicesWithParents = applyDefaultServiceParents(sData);
      setServices(filterStandardServiceCatalog(servicesWithParents));
    } else if (serviceError) {
      const { data: fallbackServices } = await supabase
        .from('services')
        .select('id, name, base_price')
        .eq('is_active', true);
      if (fallbackServices) {
        const servicesWithParents = applyDefaultServiceParents(fallbackServices.map(service => ({ ...service, parent_service_id: null })));
        setServices(filterStandardServiceCatalog(servicesWithParents));
      }
    }
  }

  const openModal = async () => {
    setIsModalOpen(true);
    const { data: cData } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(100);
    if (cData) setCustomers(cData);
    if (services.length === 0) {
      await fetchServices();
    }

    // Default time to tomorrow 9AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(tomorrow.getTime() - tzoffset)).toISOString().slice(0, 16);

    setNewJob(prev => ({
      ...prev,
      scheduledAt: localISOTime
    }));
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "create") {
      const openTimer = window.setTimeout(() => {
        openModal();
      }, 0);
      return () => window.clearTimeout(openTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectableServices = useMemo(() => getSelectableServices(services), [services]);
  const selectedServiceIds = normalizeServiceIds(newJob.serviceId, newJob.serviceIds);
  const selectedServices = selectedServiceIds
    .map(serviceId => services.find(service => service.id === serviceId))
    .filter((service): service is ServiceOption => Boolean(service));

  const updateSelectedServices = (nextIds: string[]) => {
    const nextServices = nextIds
      .map(serviceId => services.find(service => service.id === serviceId))
      .filter((service): service is ServiceOption => Boolean(service));
    const nextPrice = nextServices.reduce((sum, service) => sum + Number(service.base_price || 0), 0);
    setWorkflowData(prev => pruneWorkflowData(prev, nextServices, { excludeSectionKeys: handoverWorkflowSectionKeys }));
    setNewJob(prev => ({
      ...prev,
      serviceId: nextIds[0] || "",
      serviceIds: nextIds,
      quotedPrice: nextPrice > 0 ? String(nextPrice) : "",
    }));
  };

  const getAttachmentKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setSelectedAttachments(prev => {
      const seen = new Set(prev.map(getAttachmentKey));
      const next = [...prev];
      for (const file of files) {
        const key = getAttachmentKey(file);
        if (!seen.has(key) && next.length < MAX_TASK_ATTACHMENTS) {
          seen.add(key);
          next.push(file);
        }
      }

      if (files.length + prev.length > MAX_TASK_ATTACHMENTS) {
        alert(`Chỉ được đính kèm tối đa ${MAX_TASK_ATTACHMENTS} file cho một công việc.`);
      }

      return next;
    });
    event.currentTarget.value = "";
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const creatingNewCustomer = customerMode === "new";
    if (
      (creatingNewCustomer ? (!newJob.customerName || !newJob.customerPhone) : !newJob.customerId) ||
      !newJob.serviceId ||
      !newJob.address ||
      !newJob.scheduledAt
    ) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("customerMode", customerMode);
      formData.append("customerId", newJob.customerId);
      formData.append("customerName", newJob.customerName);
      formData.append("customerPhone", newJob.customerPhone);
      formData.append("serviceId", newJob.serviceId);
      formData.append("serviceIds", JSON.stringify(selectedServiceIds));
      formData.append("workflowData", JSON.stringify(pruneWorkflowData(workflowData, selectedServices, { excludeSectionKeys: handoverWorkflowSectionKeys })));
      formData.append("address", newJob.address);
      formData.append("scheduledAt", newJob.scheduledAt);
      formData.append("quotedPrice", newJob.quotedPrice);
      formData.append("description", newJob.description);
      selectedAttachments.forEach(file => formData.append("attachments", file));

      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as CreateJobResponse;

      if (!res.ok) {
        alert(data.error || "Không thể tạo job.");
        return;
      }

      setIsModalOpen(false);
      setCustomerMode("existing");
      setNewJob({
        customerId: "",
        customerName: "",
        customerPhone: "",
        serviceId: "",
        serviceIds: [],
        address: "",
        scheduledAt: "",
        quotedPrice: "",
        description: ""
      });
      setWorkflowData({});
      setSelectedAttachments([]);

      const createdCustomer = data.createdCustomer;
      if (createdCustomer) {
        setCustomers(prev => [createdCustomer, ...prev]);
      }
      const createdJob = data.job;
      if (createdJob) {
        setJobs(prev => [createdJob, ...prev]);
      }

      if (data.defaultPassword) {
        alert(`Đã tạo job và tài khoản khách hàng.\nTài khoản: ${data.loginPhone}@thodenngay.vn\nMật khẩu mặc định: ${data.defaultPassword}`);
      } else if (data.customerAlreadyExists) {
        alert(`Khách hàng đã có tài khoản. Đã tạo thêm công việc cho khách.\nTài khoản: ${data.loginPhone}@thodenngay.vn\nMật khẩu: Giữ nguyên mật khẩu đã tạo trước`);
      }
    } catch (err: unknown) {
      alert("Lỗi kết nối: " + (err instanceof Error ? err.message : "Không xác định"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAssignModal = async (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedWorkerId("");
    setWorkerSearchQuery("");
    setAssignWorkerModalOpen(true);

    if (workersList.length === 0) {
      const { data } = await supabase
        .from('workers')
        .select('id, is_available, profiles(full_name, phone)')
        .eq('status', 'active')
        .eq('is_available', true)
        .limit(100);
      if (data) setWorkersList(data as WorkerOption[]);
    }
  };

  const handleAssignWorker = async () => {
    if (!selectedWorkerId) {
      alert("Vui lòng chọn thợ để gán.");
      return;
    }

    setIsAssigning(true);
    const selectedJob = jobs.find(job => job.id === selectedJobId);
    const { data: customerProfile } = selectedJob?.customer?.id
      ? await supabase
        .from('profiles')
        .select('gps_location')
        .eq('id', selectedJob.customer.id)
        .single()
      : { data: null };
    const { data: selectedWorker } = await supabase
      .from('workers')
      .select('is_available, profiles(gps_location)')
      .eq('id', selectedWorkerId)
      .single();

    if (selectedWorker?.is_available === false) {
      alert("Thợ này đang Offline nên chưa thể nhận việc mới.");
      setIsAssigning(false);
      return;
    }
    const workerProfiles = selectedWorker?.profiles;
    const workerProfile = Array.isArray(workerProfiles) ? workerProfiles[0] : workerProfiles;

    const { error } = await supabase
      .from('jobs')
      .update({
        worker_id: selectedWorkerId,
        status: 'assigned',
        customer_gps_location: customerProfile?.gps_location || selectedJob?.customer_gps_location || null,
        worker_gps_location: workerProfile?.gps_location || null,
      })
      .eq('id', selectedJobId);

    setIsAssigning(false);

    if (error) {
      alert("Lỗi khi gán thợ: " + error.message);
      console.error(error);
    } else {
      setAssignWorkerModalOpen(false);

      const assignedWorker = workersList.find(w => w.id === selectedWorkerId);
      const assignedWorkerProfile = getWorkerProfile(assignedWorker);

      setJobs(prevJobs => prevJobs.map(job => {
        if (job.id === selectedJobId) {
          return {
            ...job,
            status: 'assigned',
            customer_gps_location: customerProfile?.gps_location || selectedJob?.customer_gps_location || null,
            worker_gps_location: workerProfile?.gps_location || null,
            worker: {
              profiles: {
                full_name: assignedWorkerProfile?.full_name || 'Thợ đã gán'
              }
            }
          };
        }
        return job;
      }));
    }
  };

  const handleApproveCancellation = async (job: JobRow) => {
    if (!window.confirm(`Duyệt huỷ job ${job.job_code || ""}?`)) return;

    setApprovingCancellationJobId(job.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const reviewedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("jobs")
        .update({
          status: "cancelled",
          cancellation_reviewed_by: user?.id || null,
          cancellation_reviewed_at: reviewedAt,
          cancellation_review_note: "Admin đã duyệt huỷ",
        })
        .eq("id", job.id)
        .eq("status", "cancel_requested")
        .select("id");

      if (error) {
        alert("Lỗi khi duyệt huỷ: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        alert("Job không còn ở trạng thái chờ duyệt huỷ.");
        return;
      }

      setJobs(prevJobs => prevJobs.map(item =>
        item.id === job.id
          ? { ...item, status: "cancelled", cancellation_reviewed_at: reviewedAt }
          : item
      ));
    } finally {
      setApprovingCancellationJobId(null);
    }
  };

  const handleApproveWorkerJob = async (job: JobRow) => {
    if (!window.confirm(`Duyệt job ${job.job_code || ""} cho thợ phụ trách?`)) return;

    setApprovingWorkerJobId(job.id);
    try {
      const { data: customerProfile } = job.customer_id
        ? await supabase
          .from("profiles")
          .select("gps_location")
          .eq("id", job.customer_id)
          .single()
        : { data: null };
      const { data: assignedWorker } = job.worker_id
        ? await supabase
          .from("workers")
          .select("profiles(gps_location)")
          .eq("id", job.worker_id)
          .single()
        : { data: null };
      const assignedWorkerProfiles = assignedWorker?.profiles;
      const assignedWorkerProfileLocation = Array.isArray(assignedWorkerProfiles)
        ? assignedWorkerProfiles[0]
        : assignedWorkerProfiles;

      const { data, error } = await supabase
        .from("jobs")
        .update({
          status: "assigned",
          customer_gps_location: customerProfile?.gps_location || job.customer_gps_location || null,
          worker_gps_location: assignedWorkerProfileLocation?.gps_location || job.worker_gps_location || null,
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .not("worker_id", "is", null)
        .select("id");

      if (error) {
        alert("Lỗi khi duyệt job: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        alert("Job không còn ở trạng thái chờ duyệt hoặc chưa có thợ phụ trách.");
        return;
      }

      setJobs(prevJobs => prevJobs.map(item =>
        item.id === job.id
          ? {
            ...item,
            status: "assigned",
            customer_gps_location: customerProfile?.gps_location || job.customer_gps_location || null,
            worker_gps_location: assignedWorkerProfileLocation?.gps_location || job.worker_gps_location || null,
          }
          : item
      ));
    } finally {
      setApprovingWorkerJobId(null);
    }
  };

  const filteredWorkers = workersList.filter(worker => {
    const searchLower = workerSearchQuery.toLowerCase();
    const profile = getWorkerProfile(worker);
    const fullName = profile?.full_name?.toLowerCase() || "";
    const phone = profile?.phone?.toLowerCase() || "";
    return fullName.includes(searchLower) || phone.includes(searchLower);
  });

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    const jobCode = job.job_code?.toLowerCase() || "";
    const customerName = job.customer?.full_name?.toLowerCase() || "";
    const serviceName = [
      job.service?.name,
      ...(job.job_services || []).map(link => link.service?.name),
    ].filter(Boolean).join(" ").toLowerCase();

    const matchesSearch = jobCode.includes(searchLower) || customerName.includes(searchLower) || serviceName.includes(searchLower);

    const matchesStatus = matchesJobStatusFilter(job.status, statusFilter);

    return matchesSearch && matchesStatus;
  });

  const jobStatusCounts = JOB_STATUS_FILTERS.reduce<Record<string, number>>((counts, status) => {
    counts[status] = jobs.filter(job => matchesJobStatusFilter(job.status, status)).length;
    return counts;
  }, {});

  const getTechnicalDetailOptions = (serviceId?: string | null) =>
    services
      .filter(service => service.parent_service_id === serviceId)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));

  const getServiceName = (serviceId?: string | null) =>
    services.find(service => service.id === serviceId)?.name || "";

  const handleUpdateServiceDetail = async (job: JobRow, serviceDetailId: string) => {
    setUpdatingDetailJobId(job.id);
    const nextDetailId = serviceDetailId || null;
    const { error } = await supabase
      .from("jobs")
      .update({ service_detail_id: nextDetailId })
      .eq("id", job.id);
    setUpdatingDetailJobId(null);

    if (error) {
      alert("Không thể cập nhật chi tiết kỹ thuật: " + error.message);
      return;
    }

    setJobs(prev => prev.map(item =>
      item.id === job.id ? { ...item, service_detail_id: nextDetailId } : item
    ));
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in relative">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-headline-md text-on-surface font-bold">Quản lý Job</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Theo dõi, điều phối và quản lý tất cả các công việc trên hệ thống
            </p>
          </div>
          <button onClick={openModal} className="btn-primary !py-2.5 !px-5 flex items-center gap-2">
            <PlusIcon size={20} />
            <span>Tạo Job mới</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {JOB_STATUS_FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                statusFilter === status
                  ? getJobStatusCardClass(status)
                  : "border-outline-variant bg-white text-on-surface hover:bg-surface-container-lowest"
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                {status === "all" ? "Tất cả" : getJobStatusLabel(status)}
              </div>
              <div className="mt-2 text-2xl font-extrabold">{jobStatusCounts[status] || 0}</div>
            </button>
          ))}
        </div>

        {/* Filters and Search */}
        <div className="card-elevated !p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
          <div className="relative w-full xl:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
              <SearchIcon size={20} />
            </div>
            <input
              type="text"
              placeholder="Tìm theo mã job, khách hàng, dịch vụ..."
              className="input-field !pl-10 !py-2.5 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
            {JOB_STATUS_FILTERS.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${statusFilter === status
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-sm'
                  : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                  }`}
              >
                {status === 'all' ? 'Tất cả' : getJobStatusLabel(status)}
              </button>
            ))}
            <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
              <FilterIcon size={16} /> Lọc thêm
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="admin-table-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Mã Job / Ngày</th>
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Khách hàng</th>
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Dịch vụ</th>
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Thợ phụ trách</th>
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                        <p className="text-body-md">Không tìm thấy job nào phù hợp.</p>
                        <button
                          onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                          className="mt-4 text-primary-container font-bold hover:underline"
                        >
                          Xóa bộ lọc
                        </button>
                      </td>
                    </tr>
                  ) : filteredJobs.map((job) => {
                    const detailOptions = getTechnicalDetailOptions(job.service_id);
                    const selectedDetailName = getServiceName(job.service_detail_id);

                    return (
                    <tr key={job.id} className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-primary-container font-bold">{job.job_code}</div>
                        <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mt-1.5">
                          <CalendarIcon size={14} />
                          {job.created_at
                            ? new Date(job.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })
                            : "Chưa có ngày"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-body-sm font-semibold text-on-surface">{job.customer?.full_name || 'Khách vãng lai'}</div>
                        {job.address && (
                          <div className="flex items-start gap-1.5 text-label-sm text-on-surface-variant mt-1.5 max-w-[200px]">
                            <MapPinIcon size={14} className="flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight">{job.address}</span>
                          </div>
                        )}
                        {job.status === "cancel_requested" && job.cancellation_reason && (
                          <div className="mt-2 max-w-[240px] rounded-lg bg-warning-container px-2.5 py-1.5 text-label-sm font-semibold text-warning">
                            Lý do huỷ: {job.cancellation_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${job.service?.icon === 'ZapIcon' ? 'bg-primary-fixed text-primary-container' :
                            job.service?.icon === 'DropletIcon' ? 'bg-secondary-fixed text-primary' :
                              job.service?.icon === 'CameraIcon' ? 'bg-primary-fixed-dim text-primary-container' :
                                'bg-primary-fixed text-primary-container'
                            }`}>
                            {job.service?.icon === "ZapIcon" && <ZapIcon size={18} />}
                            {job.service?.icon === "DropletIcon" && <DropletIcon size={18} />}
                            {job.service?.icon === "CameraIcon" && <CameraIcon size={18} />}
                            {job.service?.icon === "CogIcon" && <CogIcon size={18} />}
                            {!job.service?.icon && <CogIcon size={18} />}
                          </div>
                          <div>
                            <span className="text-body-sm text-on-surface font-bold block">{job.service?.name}</span>
                            {(job.job_services || []).filter(link => link.service?.id !== job.service?.id).length > 0 && (
                              <ul className="mt-1 space-y-1">
                                {(job.job_services || [])
                                  .filter(link => link.service?.id !== job.service?.id)
                                  .map(link => (
                                    <li key={link.service?.id} className="text-xs font-semibold text-on-surface-variant">
                                      • {link.service?.name || "Dịch vụ"}
                                    </li>
                                  ))}
                              </ul>
                            )}
                            {selectedDetailName && (
                              <span className="mt-0.5 block text-label-sm font-semibold text-secondary-container">
                                Chi tiết: {selectedDetailName}
                              </span>
                            )}
                            <span className="text-label-sm text-success font-medium mt-0.5 block">{job.total_price ? `${job.total_price.toLocaleString('vi-VN')}đ` : 'Chưa báo giá'}</span>
                            {detailOptions.length > 0 && (
                              <select
                                className="mt-2 w-full rounded-lg border border-outline-variant/50 bg-white px-2 py-1.5 text-xs font-semibold text-on-surface"
                                value={job.service_detail_id || ""}
                                disabled={updatingDetailJobId === job.id}
                                onChange={e => void handleUpdateServiceDetail(job, e.target.value)}
                              >
                                <option value="">Chưa chọn chi tiết</option>
                                {detailOptions.map(detail => (
                                  <option key={detail.id} value={detail.id}>{detail.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {job.worker?.profiles?.full_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-xs font-bold text-primary-container">
                              {job.worker.profiles.full_name[0]}
                            </div>
                            <span className="text-body-sm text-on-surface font-medium">{job.worker.profiles.full_name}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => openAssignModal(job.id)}
                            className="text-label-sm font-bold text-primary-container bg-primary-fixed px-3 py-1.5 rounded-lg hover:brightness-95 transition-all"
                          >
                            + Gán thợ
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge badge-${job.status === 'done' ? 'completed' : job.status} uppercase text-[10px] font-bold px-2.5 py-1`}>
                          {getJobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {job.status === "cancel_requested" ? (
                          <button
                            onClick={() => handleApproveCancellation(job)}
                            disabled={approvingCancellationJobId === job.id}
                            className="rounded-lg bg-error-container px-3 py-2 text-label-sm font-bold text-error transition-colors hover:bg-error hover:text-white disabled:opacity-60"
                          >
                            {approvingCancellationJobId === job.id ? "Đang duyệt..." : "Duyệt huỷ"}
                          </button>
                        ) : job.status === "pending" && job.worker?.profiles?.full_name ? (
                          <button
                            onClick={() => handleApproveWorkerJob(job)}
                            disabled={approvingWorkerJobId === job.id}
                            className="rounded-lg bg-success-container px-3 py-2 text-label-sm font-bold text-success transition-colors hover:bg-success hover:text-white disabled:opacity-60"
                          >
                            {approvingWorkerJobId === job.id ? "Đang duyệt..." : "Duyệt job"}
                          </button>
                        ) : (
                          <button className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary-container">
                            <ChevronRightIcon size={20} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination placeholder */}
          {!loading && filteredJobs.length > 0 && (
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <span className="text-label-sm text-on-surface-variant">Hiển thị <span className="font-bold text-on-surface">{filteredJobs.length}</span> kết quả</span>
              <div className="flex gap-1">
                <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang trước</button>
                <button className="px-3 py-1.5 rounded-lg text-sm bg-primary-container text-on-primary-container font-bold shadow-sm">1</button>
                <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang sau</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">Tạo Job mới (Điều phối)</h2>
              <button
                onClick={() => { setIsModalOpen(false); setSelectedAttachments([]); }}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="createJobForm" onSubmit={handleCreateJob} className="space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-1">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("existing")}
                    className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${customerMode === "existing"
                      ? "bg-white text-primary-container shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                      }`}
                  >
                    Khách có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("new")}
                    className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${customerMode === "new"
                      ? "bg-white text-primary-container shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                      }`}
                  >
                    Khách mới
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">
                      {customerMode === "existing" ? "Khách hàng" : "Tên khách hàng"} <span className="text-error">*</span>
                    </label>
                    {customerMode === "existing" ? (
                      <select
                        className="input-field"
                        required
                        value={newJob.customerId}
                        onChange={e => setNewJob({ ...newJob, customerId: e.target.value })}
                      >
                        <option value="" disabled>-- Chọn khách hàng --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name} ({c.phone || 'Chưa cập nhật SĐT'})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="VD: Nguyễn Văn A"
                        className="input-field"
                        required
                        value={newJob.customerName}
                        onChange={e => setNewJob({ ...newJob, customerName: e.target.value })}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">
                      {customerMode === "existing" ? "Dịch vụ" : "Số điện thoại"} <span className="text-error">*</span>
                    </label>
                    {customerMode === "existing" ? (
                      <>
                      <HierarchicalServiceSelector
                        services={services}
                        value={selectedServiceIds}
                        onChange={updateSelectedServices}
                      />
                      <select
                        className="hidden"
                        multiple
                        value={selectedServiceIds}
                        onChange={e => updateSelectedServices(Array.from(e.target.selectedOptions).map(option => option.value))}
                      >
                        {selectableServices.map(s => (
                          <option key={s.id} value={s.id}>{getServicePathLabel(s, services)} ({Number(s.base_price || 0).toLocaleString('vi-VN')}đ)</option>
                        ))}
                      </select>
                      </>
                    ) : (
                      <input
                        type="tel"
                        placeholder="VD: 0912345678"
                        className="input-field"
                        required
                        value={newJob.customerPhone}
                        onChange={e => setNewJob({ ...newJob, customerPhone: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                {customerMode === "new" && (
                  <div className="rounded-xl border border-primary-container/20 bg-primary-fixed/40 p-3 text-sm text-on-surface-variant">
                    <div className="font-bold text-on-surface">Tài khoản khách mới</div>
                    <div className="mt-1">
                      TK là SĐT đã nhập. MK mặc định:{" "}
                      <span className="font-mono font-bold text-primary-container">
                        123@123456
                      </span>
                    </div>
                  </div>
                )}

                {customerMode === "new" && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Dịch vụ <span className="text-error">*</span></label>
                    <HierarchicalServiceSelector
                      services={services}
                      value={selectedServiceIds}
                      onChange={updateSelectedServices}
                    />
                    <select
                      className="hidden"
                      multiple
                      value={selectedServiceIds}
                      onChange={e => updateSelectedServices(Array.from(e.target.selectedOptions).map(option => option.value))}
                    >
                      {selectableServices.map(s => (
                        <option key={s.id} value={s.id}>{getServicePathLabel(s, services)} ({Number(s.base_price || 0).toLocaleString('vi-VN')}đ)</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-primary-container/20 bg-primary-fixed/30 p-3">
                    {selectedServices.map(service => (
                      <span key={service.id} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-primary-container">
                        {getServicePathLabel(service, services)}
                      </span>
                    ))}
                  </div>
                )}

                <DynamicServiceWorkflowForm
                  services={selectedServices}
                  value={workflowData}
                  onChange={setWorkflowData}
                  excludeSectionKeys={handoverWorkflowSectionKeys}
                />

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Địa chỉ thi công <span className="text-error">*</span></label>
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ chi tiết"
                    className="input-field"
                    required
                    value={newJob.address}
                    onChange={e => setNewJob({ ...newJob, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Thời gian dự kiến <span className="text-error">*</span></label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      required
                      value={newJob.scheduledAt}
                      onChange={e => setNewJob({ ...newJob, scheduledAt: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Báo giá tạm tính (VNĐ)</label>
                    <input
                      type="number"
                      placeholder="VD: 250000"
                      className="input-field"
                      value={newJob.quotedPrice}
                      onChange={e => setNewJob({ ...newJob, quotedPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Mô tả chi tiết / Ghi chú</label>
                  <textarea
                    placeholder="Tình trạng hỏng hóc, lưu ý đường đi..."
                    className="input-field min-h-[100px] resize-none"
                    value={newJob.description}
                    onChange={e => setNewJob({ ...newJob, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">File đính kèm</label>
                  <label className="flex min-h-20 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 py-4 text-center transition-colors hover:bg-surface-container-low">
                    <span className="text-sm font-bold text-primary-container">Chọn tệp</span>
                    <span className="mt-1 text-xs text-on-surface-variant">Có thể chọn nhiều file, tối đa 10 file/công việc</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleAttachmentChange}
                      disabled={isSubmitting || selectedAttachments.length >= MAX_TASK_ATTACHMENTS}
                    />
                  </label>
                  {selectedAttachments.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-outline-variant/35 bg-white p-3">
                      {selectedAttachments.map((file, index) => (
                        <div key={getAttachmentKey(file)} className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-on-surface" title={file.name}>{file.name}</p>
                            <p className="text-xs font-medium text-on-surface-variant">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
                            disabled={isSubmitting}
                            aria-label={`Xóa file ${file.name}`}
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button
                onClick={() => { setIsModalOpen(false); setSelectedAttachments([]); }}
                className="btn-outline !py-2.5 !px-5"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="createJobForm"
                className="btn-primary !py-2.5 !px-5 min-w-[140px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {selectedAttachments.length > 0 ? "Đang tải file..." : "Đang tạo..."}
                  </span>
                ) : "Tạo Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {assignWorkerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">Gán thợ phụ trách</h2>
              <button
                onClick={() => setAssignWorkerModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-body-sm text-on-surface-variant mb-4">
                Vui lòng chọn một thợ đang hoạt động để gán cho Job này:
              </p>

              {/* Worker Search Bar */}
              <div className="relative mb-4 animate-fade-in">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                  <SearchIcon size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm thợ theo tên, số điện thoại..."
                  className="input-field !pl-9 !py-2 !rounded-xl w-full text-sm"
                  value={workerSearchQuery}
                  onChange={(e) => setWorkerSearchQuery(e.target.value)}
                />
                {workerSearchQuery && (
                  <button
                    onClick={() => setWorkerSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {workersList.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-4">Đang tải danh sách thợ...</p>
                ) : filteredWorkers.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-4">Không tìm thấy thợ phù hợp.</p>
                ) : filteredWorkers.map(worker => {
                  const profile = getWorkerProfile(worker);

                  return (
                    <label
                      key={worker.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedWorkerId === worker.id
                        ? 'border-primary-container bg-primary-fixed'
                        : 'border-outline-variant hover:bg-surface-container-low'
                        }`}
                    >
                      <input
                        type="radio"
                        name="worker"
                        value={worker.id}
                        checked={selectedWorkerId === worker.id}
                        onChange={() => setSelectedWorkerId(worker.id)}
                        className="w-4 h-4 text-primary bg-surface border-outline focus:ring-primary focus:ring-2"
                      />
                      <div className="w-10 h-10 rounded-full bg-secondary-container flex flex-shrink-0 items-center justify-center text-on-secondary-container font-bold">
                        {profile?.full_name ? profile.full_name[0] : 'T'}
                      </div>
                      <div>
                        <div className="text-body-sm font-bold text-on-surface">{profile?.full_name || 'Thợ chưa có tên'}</div>
                        <div className="text-label-sm text-on-surface-variant">{profile?.phone || 'Chưa cập nhật SĐT'}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button
                onClick={() => setAssignWorkerModalOpen(false)}
                className="btn-outline !py-2 !px-4"
                disabled={isAssigning}
              >
                Hủy
              </button>
              <button
                onClick={handleAssignWorker}
                className="btn-primary !py-2 !px-4 min-w-[120px]"
                disabled={isAssigning || !selectedWorkerId}
              >
                {isAssigning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gán...
                  </span>
                ) : "Xác nhận gán"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

