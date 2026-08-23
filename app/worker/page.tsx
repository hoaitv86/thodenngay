"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AirVent,
  Blocks,
  Bolt,
  Cable,
  Cpu,
  Cctv,
  Droplets,
  Hammer,
  Laptop,
  Monitor,
  Network,
  PlusCircle,
  Printer,
  Router,
  Settings,
  ShieldCheck,
  Smartphone,
  Sofa,
  Star,
  Truck,
  Users,
  Wifi,
  Wrench,
} from "lucide-react";
import {
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XIcon,
  ChevronRightIcon,
  PhoneIcon,
  StarIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  BellIcon,
  CalendarIcon,
  DollarSignIcon,
  PlusIcon
} from "../components/icons";

import { createClient } from "@/lib/supabase/client";
import { getCachedDataset, logOfflineDebug, setCachedDataset } from "@/lib/offline/cache";
import { isBrowserOffline, makeWorkerDatasetKey, makeWorkerUserDatasetKey, type WorkerOfflineScope } from "@/lib/offline/worker-data";
import { getRouteEstimate, isGpsPoint } from "@/lib/location";
import { normalizeServiceText, serviceMatchesSpecialties } from "@/lib/service-categories";
import { applyDefaultServiceParents, getCompactServicePathLabel, groupServicesForDisplay, searchSelectableServices } from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import {
  BILLGO_CYCLE_OPTIONS,
  BillGoCycle,
  buildBillGoReceiptCode,
  buildBillGoReceiptLookupCode,
  formatBillGoCurrency,
  getBillGoBillingPeriod,
  getBillGoBillingParts,
  getBillGoCollectableAmount,
  getBillGoCycleOption,
  getBillGoNextDueDate,
  getBillGoNextPeriodStartDate,
  getBillGoReceivableSummary,
  getBillGoStoredStatus,
  toBillGoDateInput,
  toMoneyNumber,
} from "@/lib/billgo";
import {
  BILLGO_SIGNUP_CYCLES,
  getBillGoPackagePrice,
  getBillGoPackageTypeLabel,
  type BillGoPackage,
} from "@/lib/billgo-packages";
import { Worker } from "@/lib/types";
import { handoverWorkflowSectionKeys, pruneWorkflowData, type WorkflowData } from "@/config/serviceWorkflows";
import PendingApproval from "./pending-approval";
import { isMissingWorkerInventorySchemaError, type InventoryProduct } from "@/lib/worker-inventory";
import {
  buildSalesRpcItems,
  validateSalesDraft,
  type SalesDraftItem,
} from "@/lib/worker-sales";
import { getJobServices, isMissingWorkflowColumn, normalizeServiceIds, type JobWithWorkflow } from "@/lib/job-workflow";
import {
  filterWorkerDashboardJobs,
  getWorkerDashboardJobDate,
  type WorkerDashboardJobFilter,
} from "@/lib/worker-dashboard-job-filters";
import { isDemoAccount } from "@/lib/demo-accounts";
import { readVietnameseMoney } from "@/lib/vietnamese-money";
import { CmsPlacement } from "@/app/components/CmsPlacement";
import { TaskAttachmentList } from "@/app/components/TaskAttachmentList";
import type { TaskAttachment } from "@/lib/task-attachments";

const DynamicServiceWorkflowForm = dynamic(() =>
  import("@/app/components/DynamicServiceWorkflowForm").then(mod => mod.DynamicServiceWorkflowForm)
);

interface ServiceOption {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | string | null;
  icon?: string | null;
  parent_service_id?: string | null;
  parentName?: string | null;
}

type QuickServiceGroup = {
  parent: ServiceOption;
  category: {
    id: string;
    name: string;
    emoji: string;
  };
  services: ServiceOption[];
  directServices: ServiceOption[];
  childGroups: Array<{
    child: ServiceOption;
    services: ServiceOption[];
  }>;
};

const QUICK_FREQUENT_SERVICE_NAMES = ["Sửa mất mạng", "Lắp camera", "Cài Windows", "Sửa máy in"];

type QuickCustomerOption = {
  id: string;
  name: string;
  phone?: string | null;
  account?: string | null;
  address?: string | null;
};

const WORKER_DASHBOARD_JOB_LIMIT = 100;
const WORKER_DASHBOARD_BILLGO_LIMIT = 300;
const WORKER_DASHBOARD_JOB_BASE_SELECT = "id, service_id, service_detail_id, job_code, status, customer_id, gps_location, customer_gps_location, worker_gps_location, description, created_at, assigned_at, scheduled_at, quoted_price, address, images, completion_items, final_amount, warranty_days, warranty_note, workflow_data";
const WORKER_DASHBOARD_JOB_RELATION_SELECT = "service:services!jobs_service_id_fkey(id, name, description, base_price, icon, parent_service_id), customer:profiles!customer_id(id, full_name, phone, address, gps_location)";
const WORKER_DASHBOARD_JOB_ATTACHMENTS_SELECT = "task_attachments(id, task_id, original_name, storage_path, mime_type, file_size, created_at)";
const WORKER_DASHBOARD_JOB_PAYMENTS_SELECT = "payments(id, amount, method, status, paid_at, note)";
const WORKER_DASHBOARD_JOB_SERVICES_SELECT = "job_services(service:services(id, name, description, base_price, icon, parent_service_id))";
const WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS = `${WORKER_DASHBOARD_JOB_BASE_SELECT}, ${WORKER_DASHBOARD_JOB_RELATION_SELECT}`;
const WORKER_DASHBOARD_JOB_SELECT = `${WORKER_DASHBOARD_JOB_BASE_SELECT}, ${WORKER_DASHBOARD_JOB_ATTACHMENTS_SELECT}, ${WORKER_DASHBOARD_JOB_RELATION_SELECT}`;
const WORKER_DASHBOARD_JOB_WITH_SERVICES_SELECT = `${WORKER_DASHBOARD_JOB_SELECT}, ${WORKER_DASHBOARD_JOB_SERVICES_SELECT}, ${WORKER_DASHBOARD_JOB_PAYMENTS_SELECT}`;
const WORKER_DASHBOARD_JOB_WITH_SERVICES_SELECT_WITHOUT_ATTACHMENTS = `${WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS}, ${WORKER_DASHBOARD_JOB_SERVICES_SELECT}, ${WORKER_DASHBOARD_JOB_PAYMENTS_SELECT}`;

interface WorkerJob {
  id: string;
  service_id?: string | null;
  service_detail_id?: string | null;
  job_code?: string;
  status?: string;
  customer_id?: string;
  gps_location?: GpsLocation | null;
  customer_gps_location?: GpsLocation | null;
  worker_gps_location?: GpsLocation | null;
  customerName?: string;
  serviceName?: string;
  description?: string | null;
  created_at?: string;
  assigned_at?: string;
  scheduled_at?: string;
  quoted_price: number;
  address?: string;
  images: string[];
  completion_items?: CompletionItem[];
  final_amount?: number | null;
  warranty_days?: number | null;
  warranty_note?: string | null;
  workflow_data?: WorkflowData | null;
  task_attachments?: TaskAttachment[] | null;
  service?: ServiceOption | null;
  job_services?: JobWithWorkflow["job_services"];
  payments?: Array<{
    id: string;
    amount: number | string;
    method: string;
    status: string;
    paid_at?: string | null;
    note?: string | null;
  }> | null;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  price?: string;
  time?: string;
  distance?: string;
  eta?: string;
  hasGpsEstimate?: boolean;
  customer?: {
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
    gps_location?: GpsLocation | null;
  } | null;
  [key: string]: unknown;
}

type WorkerDashboardJobQueryResult = {
  data: WorkerJob[] | null;
  error: { message: string } | null;
};

const DASHBOARD_JOB_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { ZapIcon, DropletIcon, CameraIcon, CogIcon, Bolt, Droplets, Cctv, Network, Laptop, Printer, Cpu, Router, Wifi, Cable, PlusCircle, Settings, ShieldCheck, Smartphone, Users, AirVent, Truck, Sofa, Hammer, Monitor, Star, Blocks, Wrench };

const withDashboardJobIcon = (job: WorkerJob): WorkerJob => ({
  ...job,
  icon: DASHBOARD_JOB_ICON_MAP[job.service?.icon || ""] || BriefcaseIcon,
});

const stripDashboardJobForCache = (job: WorkerJob): WorkerJob => {
  const clone = { ...job };
  delete clone.icon;
  return clone;
};

type WorkerBillGoReceivable = {
  id: string;
  customer_id: string;
  worker_id?: string | null;
  job_id?: string | null;
  subscription_id?: string | null;
  type?: string | null;
  title?: string | null;
  package_id?: string | null;
  package_name_at_collection?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  billing_months?: number | null;
  bonus_months?: number | null;
  service_months?: number | null;
  paid_amount?: number | string | null;
  monthly_fee_at_collection?: number | string | null;
  cycle_at_collection?: BillGoCycle | string | null;
  next_period_start?: string | null;
  next_due_date?: string | null;
  status?: string | null;
  note?: string | null;
  customer?: {
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  subscription?: {
    customer_name?: string | null;
    phone?: string | null;
    internet_account?: string | null;
    customer_address?: string | null;
    package_name?: string | null;
    cycle?: string | null;
    current_cycle?: string | null;
    next_due_date?: string | null;
  } | null;
  payments?: Array<{
    id: string;
    amount: number | string;
    method: string;
    status: string;
    paid_at?: string | null;
    note?: string | null;
  }> | null;
};

type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at?: string;
};

const getJobCustomerGps = (job: WorkerJob) => {
  if (isGpsPoint(job.customer_gps_location)) return job.customer_gps_location;
  if (isGpsPoint(job.gps_location)) return job.gps_location;

  const customer = job.customer as { gps_location?: unknown } | null | undefined;
  return isGpsPoint(customer?.gps_location) ? customer.gps_location : null;
};

const getJobDirectionDestination = (job: WorkerJob) => {
  const customerGps = getJobCustomerGps(job);
  return customerGps
    ? `${customerGps.lat},${customerGps.lng}`
    : job.address?.trim() || null;
};

const buildDirectionsExternalUrl = (destination: string, origin?: GpsLocation | null) => {
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });

  if (isGpsPoint(origin)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildDirectionsEmbedUrl = (destination: string, origin?: GpsLocation | null) => {
  if (!destination) return null;

  const params = new URLSearchParams({
    output: "embed",
    daddr: destination,
    dirflg: "d",
  });

  if (isGpsPoint(origin)) {
    params.set("saddr", `${origin.lat},${origin.lng}`);
  }

  return `https://maps.google.com/maps?${params.toString()}`;
};

interface CompletionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  warrantyDays: number;
  inventoryProductId?: string;
  sku?: string;
  category?: string;
  unit?: string;
  source?: "manual" | "inventory";
}

interface WorkerCreateJobResponse {
  error?: string;
  job?: WorkerJob;
  loginPhone?: string;
  defaultPassword?: string | null;
  customerAlreadyExists?: boolean;
  mock?: boolean;
  approvalRequired?: boolean;
}

interface WorkerUpdateJobResponse {
  error?: string;
  job?: WorkerJob;
  customerAlreadyExists?: boolean;
}

type ToastType = "success" | "error" | "info";

type ToastState = {
  message: string;
  type: ToastType | null;
  customerLogin?: string | null;
  customerPassword?: string | null;
};

type CompletionPaymentStatus = "paid" | "partial" | "unpaid";

type WorkerWithProfile = Worker & {
  user?: {
    full_name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

type WorkerDashboardStats = {
  jobsDone: number;
  income: number;
  rating: number;
  todayCustomers: number;
  todayIncome: number;
  todayRating: number;
  monthlyCustomers: number;
  monthlyNewCustomers: number;
  monthlyIncome: number;
  monthlyRating: number;
};

type WorkerDashboardData = {
  worker: Worker | null;
  newJobs: WorkerJob[];
  pendingApprovalJobs: WorkerJob[];
  activeJobs: WorkerJob[];
  inventoryProducts: InventoryProduct[];
  workerBillGoReceivables: WorkerBillGoReceivable[];
  billGoPackages: BillGoPackage[];
  services: ServiceOption[];
  workerStats: WorkerDashboardStats;
};

const initialWorkerDashboardStats: WorkerDashboardStats = {
  jobsDone: 0,
  income: 0,
  rating: 0,
  todayCustomers: 0,
  todayIncome: 0,
  todayRating: 0,
  monthlyCustomers: 0,
  monthlyNewCustomers: 0,
  monthlyIncome: 0,
  monthlyRating: 0,
};

type WorkerMonthlyGoal = {
  id?: string;
  worker_id: string;
  goal_month: string;
  revenue_target: number;
  total_customers_target: number;
  new_customers_target: number;
  skipped: boolean;
};

type WorkerMonthlyGoalDraft = {
  revenueTarget: string;
  totalCustomersTarget: string;
  newCustomersTarget: string;
};

type WorkerProfileCache = {
  worker?: WorkerWithProfile | null;
  storeId?: string | null;
};

type WorkerDashboardOfflineSnapshot = {
  worker: WorkerWithProfile;
  newJobs: WorkerJob[];
  pendingApprovalJobs: WorkerJob[];
  activeJobs: WorkerJob[];
  inventoryProducts: InventoryProduct[];
  workerBillGoReceivables: WorkerBillGoReceivable[];
  billGoPackages: BillGoPackage[];
  services: ServiceOption[];
  workerStats: WorkerDashboardStats;
  monthlyGoal: WorkerMonthlyGoal | null;
  monthlyGoalDraft: WorkerMonthlyGoalDraft;
  monthlyGoalFormOpen: boolean;
};

type WorkerMonthlyGoalState = Pick<WorkerDashboardOfflineSnapshot, "monthlyGoal" | "monthlyGoalDraft" | "monthlyGoalFormOpen">;

const DEFAULT_WORKER_MONTHLY_GOAL = {
  revenueTarget: 20000000,
  totalCustomersTarget: 40,
  newCustomersTarget: 10,
};

const initialWorkerDashboardData: WorkerDashboardData = {
  worker: null,
  newJobs: [],
  pendingApprovalJobs: [],
  activeJobs: [],
  inventoryProducts: [],
  workerBillGoReceivables: [],
  billGoPackages: [],
  services: [],
  workerStats: initialWorkerDashboardStats,
};

const WORKER_DASHBOARD_REALTIME_DEBOUNCE_MS = 450;
const MOBILE_FEW_JOBS_THRESHOLD = 1;
const INTERNET_INSTALL_FEE_OPTIONS = [300000, 400000];
const VIETTEL_GIFT_CAMERA_OPTIONS = [
  "Camera Viettel trong nhà",
  "Camera Viettel ngoài trời",
];
const INTERNET_COMPLETION_CYCLES: BillGoCycle[] = ["monthly", "two_months", "three_months", "six_months", "yearly"];

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

const getPreviousMonthKey = (date: Date) =>
  getMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));

const makeGoalDraft = (goal: {
  revenueTarget: number;
  totalCustomersTarget: number;
  newCustomersTarget: number;
}): WorkerMonthlyGoalDraft => ({
  revenueTarget: String(goal.revenueTarget),
  totalCustomersTarget: String(goal.totalCustomersTarget),
  newCustomersTarget: String(goal.newCustomersTarget),
});

const getDefaultScheduledAt = () => {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  const tzoffset = nextHour.getTimezoneOffset() * 60000;
  return new Date(nextHour.getTime() - tzoffset).toISOString().slice(0, 16);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}tr`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return `${amount || 0}`;
};

const compareServicesByName = (a: ServiceOption, b: ServiceOption) =>
  (a.name || "").localeCompare(b.name || "", "vi");

const buildAdminServiceGroups = (services: ServiceOption[]): QuickServiceGroup[] => {
  return groupServicesForDisplay(services).map(group => ({
    parent: {
      id: group.category.id,
      name: group.category.name,
    },
    category: {
      id: group.category.id,
      name: group.category.name,
      emoji: group.category.emoji,
    },
    services: [...group.services].sort(compareServicesByName),
    directServices: [...group.directServices].sort(compareServicesByName),
    childGroups: group.childGroups.map(childGroup => ({
      child: childGroup.child,
      services: [...childGroup.services].sort(compareServicesByName),
    })),
  }));
};

const filterServicesForWorkerSpecialties = (services: ServiceOption[], specialties: string[]) => {
  if (specialties.length === 0) return [];

  const serviceById = new Map(services.map(service => [service.id, service]));
  const serviceWithParentNames = services.map(service => ({
    ...service,
    parentName: service.parent_service_id ? serviceById.get(service.parent_service_id)?.name || null : service.parentName || null,
  }));
  const matchedIds = new Set<string>();

  serviceWithParentNames.forEach(service => {
    if (!serviceMatchesSpecialties(service, specialties, { allowEmptySpecialties: false })) return;

    matchedIds.add(service.id);
    let parentId = service.parent_service_id || null;
    const visited = new Set<string>([service.id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      matchedIds.add(parentId);
      parentId = serviceById.get(parentId)?.parent_service_id || null;
    }
  });

  return serviceWithParentNames.filter(service => matchedIds.has(service.id));
};

const getQuickServicePathLabel = (service: ServiceOption | null, services: ServiceOption[]) => {
  if (!service) return "";
  const serviceById = new Map(services.map(item => [item.id, item]));
  const names = [service.name || "Dịch vụ"];
  const visited = new Set<string>([service.id]);
  let parentId = service.parent_service_id || null;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = serviceById.get(parentId);
    if (!parent) break;
    names.unshift(parent.name || "Danh mục");
    parentId = parent.parent_service_id || null;
  }

  return names.join(" / ");
};

const getQuickServiceSuggestionLabel = (service: ServiceOption, services: ServiceOption[]) =>
  getCompactServicePathLabel(service, services, 3);

const getJobCreatedDate = getWorkerDashboardJobDate;

const sortJobsNewestFirst = <T extends Pick<WorkerJob, "created_at" | "scheduled_at">>(jobs: T[]) =>
  [...jobs].sort((a, b) => {
    const aTime = getJobCreatedDate(a)?.getTime() || 0;
    const bTime = getJobCreatedDate(b)?.getTime() || 0;
    return bTime - aTime;
  });

const getUnworkedAgeLabel = (job: Pick<WorkerJob, "created_at" | "scheduled_at">) => {
  const createdDate = getJobCreatedDate(job);
  if (!createdDate) return "Chưa làm";

  const diffMs = Date.now() - createdDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  if (diffDays === 0) return "Chưa làm hôm nay";
  if (diffDays === 1) return "Chưa làm 1 ngày";
  return `Chưa làm ${diffDays} ngày`;
};

const makeCompletionItem = (name = "", unitPrice = 0): CompletionItem => ({
  id: crypto.randomUUID(),
  name,
  quantity: 1,
  unitPrice,
  warrantyDays: 30,
  source: "manual",
});

const makeInventoryCompletionItem = (): CompletionItem => ({
  id: crypto.randomUUID(),
  name: "",
  quantity: 1,
  unitPrice: 0,
  warrantyDays: 0,
  source: "inventory",
});

const getCurrentBrowserLocation = () => {
  return new Promise<GpsLocation | null>((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          captured_at: new Date().toISOString(),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
};

export default function WorkerDashboard() {
  const [tab, setTab] = useState<"new" | "pending" | "active" | "billgo">("new");
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<WorkerDashboardData>(initialWorkerDashboardData);
  const {
    worker,
    newJobs,
    pendingApprovalJobs,
    activeJobs,
    inventoryProducts,
    workerBillGoReceivables,
    billGoPackages,
    services,
    workerStats,
  } = dashboardData;
  const setWorker = React.useCallback((updater: React.SetStateAction<Worker | null>) => {
    setDashboardData(prev => ({
      ...prev,
      worker: typeof updater === "function" ? (updater as (current: Worker | null) => Worker | null)(prev.worker) : updater,
    }));
  }, []);
  const setNewJobs = React.useCallback((updater: React.SetStateAction<WorkerJob[]>) => {
    setDashboardData(prev => ({
      ...prev,
      newJobs: typeof updater === "function" ? (updater as (current: WorkerJob[]) => WorkerJob[])(prev.newJobs) : updater,
    }));
  }, []);
  const setPendingApprovalJobs = React.useCallback((updater: React.SetStateAction<WorkerJob[]>) => {
    setDashboardData(prev => ({
      ...prev,
      pendingApprovalJobs: typeof updater === "function" ? (updater as (current: WorkerJob[]) => WorkerJob[])(prev.pendingApprovalJobs) : updater,
    }));
  }, []);
  const setActiveJobs = React.useCallback((updater: React.SetStateAction<WorkerJob[]>) => {
    setDashboardData(prev => ({
      ...prev,
      activeJobs: typeof updater === "function" ? (updater as (current: WorkerJob[]) => WorkerJob[])(prev.activeJobs) : updater,
    }));
  }, []);
  const setWorkerBillGoReceivables = React.useCallback((updater: React.SetStateAction<WorkerBillGoReceivable[]>) => {
    setDashboardData(prev => ({
      ...prev,
      workerBillGoReceivables: typeof updater === "function" ? (updater as (current: WorkerBillGoReceivable[]) => WorkerBillGoReceivable[])(prev.workerBillGoReceivables) : updater,
    }));
  }, []);
  const setWorkerStats = React.useCallback((updater: React.SetStateAction<WorkerDashboardStats>) => {
    setDashboardData(prev => ({
      ...prev,
      workerStats: typeof updater === "function" ? (updater as (current: WorkerDashboardStats) => WorkerDashboardStats)(prev.workerStats) : updater,
    }));
  }, []);
  const [expandedMobileJobFilter, setExpandedMobileJobFilter] = useState<WorkerDashboardJobFilter | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [toast, setToast] = useState<ToastState>({ message: "", type: null, customerLogin: null, customerPassword: null });
  const [directionsView, setDirectionsView] = useState<{
    job: WorkerJob;
    embedUrl: string | null;
    externalUrl: string | null;
    origin: GpsLocation | null;
    destinationInput: string;
    destinationLat: string;
    destinationLng: string;
  } | null>(null);
  const [quickFormOpen, setQuickFormOpen] = useState(false);
  const [creatingQuickJob, setCreatingQuickJob] = useState(false);
  const [expandedQuickServiceGroup, setExpandedQuickServiceGroup] = useState("internet");
  const [quickServiceSearch, setQuickServiceSearch] = useState("");
  const [quickJob, setQuickJob] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    serviceId: "",
    serviceIds: [] as string[],
    address: "",
    scheduledAt: getDefaultScheduledAt(),
    quotedPrice: "",
    description: "",
  });
  const [quickWorkflowData, setQuickWorkflowData] = useState<WorkflowData>({});
  const [editingQuickJob, setEditingQuickJob] = useState<WorkerJob | null>(null);
  const [savingQuickJobEdit, setSavingQuickJobEdit] = useState(false);
  const [editQuickCustomerQuery, setEditQuickCustomerQuery] = useState("");
  const [editQuickServiceSearch, setEditQuickServiceSearch] = useState("");
  const [editQuickServicePickerOpen, setEditQuickServicePickerOpen] = useState(false);
  const [expandedEditQuickServiceGroup, setExpandedEditQuickServiceGroup] = useState("internet");
  const [editQuickJob, setEditQuickJob] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    serviceId: "",
    serviceIds: [] as string[],
    address: "",
    description: "",
  });
  const supabase = React.useMemo(() => createClient(), []);
  const currentGoalMonth = React.useMemo(() => getMonthKey(new Date()), []);
  const previousGoalMonth = React.useMemo(() => getPreviousMonthKey(new Date()), []);
  const [monthlyGoal, setMonthlyGoal] = useState<WorkerMonthlyGoal | null>(null);
  const [monthlyGoalDraft, setMonthlyGoalDraft] = useState<WorkerMonthlyGoalDraft>(
    makeGoalDraft(DEFAULT_WORKER_MONTHLY_GOAL)
  );
  const [monthlyGoalFormOpen, setMonthlyGoalFormOpen] = useState(false);
  const [monthlyGoalExpanded, setMonthlyGoalExpanded] = useState(false);
  const [monthlyGoalSaving, setMonthlyGoalSaving] = useState(false);
  const [monthlyGoalError, setMonthlyGoalError] = useState("");
  const applyDashboardOfflineSnapshot = React.useCallback((snapshot: WorkerDashboardOfflineSnapshot) => {
    setDashboardData({
      worker: snapshot.worker,
      newJobs: snapshot.newJobs.map(withDashboardJobIcon),
      pendingApprovalJobs: snapshot.pendingApprovalJobs,
      activeJobs: snapshot.activeJobs,
      inventoryProducts: snapshot.inventoryProducts,
      workerBillGoReceivables: snapshot.workerBillGoReceivables,
      billGoPackages: snapshot.billGoPackages,
      services: snapshot.services,
      workerStats: snapshot.workerStats,
    });
    setMonthlyGoalError("");
    setMonthlyGoal(snapshot.monthlyGoal);
    setMonthlyGoalDraft(snapshot.monthlyGoalDraft);
    setMonthlyGoalFormOpen(snapshot.monthlyGoalFormOpen);
  }, []);

  const restoreDashboardOfflineSnapshot = React.useCallback(async (userId: string) => {
    const profileKey = makeWorkerUserDatasetKey("worker-profile", userId);
    const cachedProfile = await getCachedDataset<WorkerProfileCache>(profileKey);
    const cachedWorkerId = cachedProfile?.data.worker?.id || null;
    if (!cachedWorkerId) {
      logOfflineDebug("dataset load", { dataset: "dashboard-summary", userId, snapshotFound: false, reason: "missing-worker-profile" });
      return false;
    }

    const cacheScope: WorkerOfflineScope = {
      userId,
      workerId: cachedWorkerId,
      storeId: cachedProfile?.data.storeId || null,
    };
    const cacheKey = makeWorkerDatasetKey("dashboard-summary", cacheScope);
    const cachedDashboard = await getCachedDataset<WorkerDashboardOfflineSnapshot>(cacheKey);
    if (!cachedDashboard) return false;

    applyDashboardOfflineSnapshot(cachedDashboard.data);
    logOfflineDebug("hydrated from cache", {
      dataset: "dashboard-summary",
      cacheKey,
      recordCount: cachedDashboard.data.activeJobs.length + cachedDashboard.data.pendingApprovalJobs.length + cachedDashboard.data.newJobs.length,
    });
    return true;
  }, [applyDashboardOfflineSnapshot]);
  const quickServiceGroups = React.useMemo(() => buildAdminServiceGroups(services), [services]);
  const getTechnicalDetailOptions = React.useCallback((serviceId?: string | null) =>
    services
      .filter(service => service.parent_service_id === serviceId)
      .sort(compareServicesByName),
    [services]
  );

  const getServiceName = React.useCallback((serviceId?: string | null) =>
    services.find(service => service.id === serviceId)?.name || "",
    [services]
  );
  const quickSuggestedServices = React.useMemo(() => {
    const leafServiceIds = new Set(quickServiceGroups.flatMap(group => group.services.map(service => service.id)));
    const serviceById = new Map(services.map(service => [service.id, service]));
    const recentIds = [...pendingApprovalJobs, ...activeJobs]
      .map(job => typeof job.service_id === "string" ? job.service_id : "")
      .filter(Boolean);
    const suggestions: ServiceOption[] = [];

    [...recentIds, quickJob.serviceId].forEach(serviceId => {
      const service = serviceById.get(serviceId);
      if (service && leafServiceIds.has(service.id) && !suggestions.some(item => item.id === service.id)) {
        suggestions.push(service);
      }
    });

    if (suggestions.length < 4) {
      QUICK_FREQUENT_SERVICE_NAMES.forEach(serviceName => {
        const normalizedName = normalizeServiceText(serviceName);
        const service = services.find(item =>
          leafServiceIds.has(item.id) &&
          normalizeServiceText(item.name).includes(normalizedName) &&
          !suggestions.some(selected => selected.id === item.id)
        );
        if (service) suggestions.push(service);
      });
    }

    if (suggestions.length < 4) {
      quickServiceGroups.flatMap(group => group.services).forEach(service => {
        if (suggestions.length >= 4) return;
        if (!suggestions.some(item => item.id === service.id)) suggestions.push(service);
      });
    }

    return suggestions.slice(0, 6);
  }, [activeJobs, pendingApprovalJobs, quickJob.serviceId, quickServiceGroups, services]);

  const quickServiceSearchResults = React.useMemo(() =>
    searchSelectableServices(services, quickServiceSearch, 12),
    [quickServiceSearch, services]
  );

  const editQuickServiceSearchResults = React.useMemo(() =>
    searchSelectableServices(services, editQuickServiceSearch, 12),
    [editQuickServiceSearch, services]
  );
  const quickCustomerOptions = React.useMemo<QuickCustomerOption[]>(() => {
    const customerMap = new Map<string, QuickCustomerOption>();
    const addCustomer = (customer: QuickCustomerOption) => {
      if (!customer.id) return;
      const current = customerMap.get(customer.id);
      customerMap.set(customer.id, {
        id: customer.id,
        name: customer.name || current?.name || "Khách hàng",
        phone: customer.phone || current?.phone || null,
        account: customer.account || current?.account || null,
        address: customer.address || current?.address || null,
      });
    };

    [...activeJobs, ...pendingApprovalJobs, ...newJobs].forEach(job => {
      const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
      addCustomer({
        id: job.customer_id || "",
        name: customer?.full_name || job.customerName || "Khách hàng",
        phone: customer?.phone || null,
        address: customer?.address || job.address || null,
      });
    });

    workerBillGoReceivables.forEach(receivable => {
      const subscription = receivable.subscription;
      addCustomer({
        id: receivable.customer_id,
        name: subscription?.customer_name || receivable.customer?.full_name || "Khách BillGo",
        phone: subscription?.phone || receivable.customer?.phone || null,
        account: subscription?.internet_account || null,
        address: subscription?.customer_address || receivable.customer?.address || null,
      });
    });

    return [...customerMap.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [activeJobs, newJobs, pendingApprovalJobs, workerBillGoReceivables]);

  const quickCustomerResults = React.useMemo(() => {
    const query = normalizeServiceText(quickJob.customerName);
    if (!query) return quickCustomerOptions.slice(0, 6);
    const queryParts: string[] = query.split(/\s+/).filter(Boolean);
    return quickCustomerOptions
      .filter(customer => {
        const searchText = normalizeServiceText([
          customer.name,
          customer.phone,
          customer.account,
          customer.address,
        ].filter(Boolean).join(" "));
        return queryParts.every(part => searchText.includes(part));
      })
      .slice(0, 8);
  }, [quickCustomerOptions, quickJob.customerName]);

  const editQuickCustomerResults = React.useMemo(() => {
    const query = normalizeServiceText(editQuickCustomerQuery);
    if (!query) return quickCustomerOptions.slice(0, 6);
    const queryParts: string[] = query.split(/\s+/).filter(Boolean);
    return quickCustomerOptions
      .filter(customer => {
        const searchText = normalizeServiceText([
          customer.name,
          customer.phone,
          customer.account,
          customer.address,
        ].filter(Boolean).join(" "));
        return queryParts.every(part => searchText.includes(part));
      })
      .slice(0, 8);
  }, [editQuickCustomerQuery, quickCustomerOptions]);

  // Completion modal states
  const [activeJobToComplete, setActiveJobToComplete] = useState<WorkerJob | null>(null);
  const [jobToCancel, setJobToCancel] = useState<WorkerJob | null>(null);
  const [cancelReason, setCancelReason] = useState("Khách hàng từ chối lắp đặt/sửa chữa");
  const [requestingCancel, setRequestingCancel] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([]);
  const [warrantyNote, setWarrantyNote] = useState("Bảo hành theo hạng mục đã ghi trên phiếu, không áp dụng cho lỗi phát sinh do sử dụng sai cách.");
  const [collectingPaymentJobId, setCollectingPaymentJobId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCycle, setPaymentCycle] = useState<BillGoCycle>("monthly");
  const [paymentCyclesByReceivable, setPaymentCyclesByReceivable] = useState<Record<string, BillGoCycle>>({});
  const [paymentNote, setPaymentNote] = useState("");
  const [completionPaymentStatus, setCompletionPaymentStatus] = useState<CompletionPaymentStatus>("paid");
  const [completionPaymentAmount, setCompletionPaymentAmount] = useState("");
  const [completionPaymentMethod, setCompletionPaymentMethod] = useState("cash");
  const [completionPaymentNote, setCompletionPaymentNote] = useState("");
  const [completionHandoverData, setCompletionHandoverData] = useState<WorkflowData>({});
  const [completionInternetInstallFeeInput, setCompletionInternetInstallFeeInput] = useState("300000");
  const [completionGiftCamera, setCompletionGiftCamera] = useState("");
  const [completionGiftCameraPassword, setCompletionGiftCameraPassword] = useState("");
  const [completionInternetCycle, setCompletionInternetCycle] = useState<BillGoCycle>("monthly");
  const [completionInternetMonthlyFee, setCompletionInternetMonthlyFee] = useState("");
  const [completionAddOnPackageId, setCompletionAddOnPackageId] = useState("");
  const [completionAddOnCycle, setCompletionAddOnCycle] = useState<BillGoCycle>("monthly");
  const [completionAddOnNote, setCompletionAddOnNote] = useState("");
  const billGoRows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const grouped = new Map<string, { item: WorkerBillGoReceivable; summary: ReturnType<typeof getBillGoReceivableSummary> }>();

    workerBillGoReceivables.forEach(item => {
      if (item.status === "deleted" || item.status === "cancelled") return;
      const summary = getBillGoReceivableSummary(item);
      if (summary.debt <= 0) return;

      const dueDate = item.due_date || item.next_due_date || item.subscription?.next_due_date || null;
      const dueTime = dueDate ? new Date(dueDate).getTime() : null;
      if (dueTime && dueTime > monthEnd.getTime()) return;

      const key = item.subscription_id || item.id;
      const current = grouped.get(key);
      const currentDue = current?.item.due_date ? new Date(current.item.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const nextDue = dueTime || Number.MAX_SAFE_INTEGER;
      if (!current || nextDue < currentDue) grouped.set(key, { item, summary });
    });

    return [...grouped.values()].sort((a, b) => {
      const aDue = a.item.due_date ? new Date(a.item.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.item.due_date ? new Date(b.item.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [workerBillGoReceivables]);
  const selectedQuickServices = React.useMemo(
    () => quickJob.serviceIds
      .map(serviceId => services.find(service => service.id === serviceId))
      .filter((service): service is ServiceOption => Boolean(service)),
    [quickJob.serviceIds, services]
  );
  const selectedEditQuickServices = React.useMemo(
    () => editQuickJob.serviceIds
      .map(serviceId => services.find(service => service.id === serviceId))
      .filter((service): service is ServiceOption => Boolean(service)),
    [editQuickJob.serviceIds, services]
  );
  const getWorkflowServicesForJob = React.useCallback((job: WorkerJob) => {
    const linkedServiceIds = getJobServices(job).map(service => service.id).filter((serviceId): serviceId is string => Boolean(serviceId));
    const ids = [
      ...linkedServiceIds,
      job.service_id,
      job.service_detail_id,
    ].filter((serviceId): serviceId is string => Boolean(serviceId));

    return ids
      .map(serviceId => services.find(service => service.id === serviceId))
      .filter((service): service is ServiceOption => Boolean(service))
      .filter((service, index, list) => list.findIndex(item => item.id === service.id) === index);
  }, [services]);
  const isInternetInstallCompletionJob = React.useCallback((job: WorkerJob) => {
    const workflowServices = getWorkflowServicesForJob(job);
    const serviceText = normalizeServiceText([
      job.serviceName,
      job.service?.name,
      ...workflowServices.map(service => service.name),
    ].filter(Boolean).join(" "));
    const hasInternetSignal = ["internet", "wifi", "wi-fi", "mang internet", "cap quang"].some(keyword => serviceText.includes(keyword));
    const hasInstallSignal = ["lap moi", "lap dat", "lap internet", "lap dat internet", "hoa mang"].some(keyword => serviceText.includes(keyword));
    return hasInternetSignal && hasInstallSignal;
  }, [getWorkflowServicesForJob]);
  const completionWorkflowServices = React.useMemo(
    () => activeJobToComplete ? getWorkflowServicesForJob(activeJobToComplete) : [],
    [activeJobToComplete, getWorkflowServicesForJob]
  );
  const completionBillGoAddOnPackages = React.useMemo(
    () => billGoPackages.filter(item => item.is_active && (item.type === "tv360" || item.type === "receiver")),
    [billGoPackages]
  );
  const selectedCompletionAddOnPackage = React.useMemo(
    () => completionBillGoAddOnPackages.find(item => item.id === completionAddOnPackageId) || null,
    [completionAddOnPackageId, completionBillGoAddOnPackages]
  );
  const completionAddOnCycleOptions = React.useMemo(() => {
    const allowedCycles = new Set([
      ...(selectedCompletionAddOnPackage?.allowed_cycles || []),
      ...BILLGO_SIGNUP_CYCLES,
    ]);
    return BILLGO_CYCLE_OPTIONS.filter(option =>
      BILLGO_SIGNUP_CYCLES.includes(option.value) && allowedCycles.has(option.value)
    );
  }, [selectedCompletionAddOnPackage]);
  const completionAddOnMonthlyFee = getBillGoPackagePrice(selectedCompletionAddOnPackage);
  const completionAddOnTotal = selectedCompletionAddOnPackage
    ? getBillGoCollectableAmount(completionAddOnMonthlyFee, completionAddOnCycle)
    : 0;
  const completionAddOnGrandTotal = completionAddOnTotal;
  const isInternetCompletionJob = React.useMemo(() => {
    return activeJobToComplete ? isInternetInstallCompletionJob(activeJobToComplete) : false;
  }, [activeJobToComplete, isInternetInstallCompletionJob]);
  const billGoTotals = useMemo(
    () => billGoRows.reduce(
      (acc, row) => {
        acc.receivable += row.summary.receivable;
        acc.paid += row.summary.paid;
        acc.debt += row.summary.debt;
        if (row.summary.debt > 0) acc.debtItems += 1;
        return acc;
      },
      { receivable: 0, paid: 0, debt: 0, debtItems: 0 }
    ),
    [billGoRows]
  );
  const statPeriodLabels = useMemo(() => {
    const now = new Date();
    return {
      today: `Hôm nay ${now.toLocaleDateString("vi-VN", { day: "2-digit" })}`,
      month: `Tháng ${now.getMonth() + 1}`,
    };
  }, []);
  const [addToBillGo, setAddToBillGo] = useState(false);

  const toastTimeoutRef = React.useRef<number | null>(null);

  const closeToast = () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message: "", type: null, customerLogin: null, customerPassword: null });
  };

  const showToast = (
    message: string,
    type: ToastType = "info",
    options: { durationMs?: number | null; customerLogin?: string | null; customerPassword?: string | null } = {}
  ) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setToast({
      message,
      type,
      customerLogin: options.customerLogin || null,
      customerPassword: options.customerPassword || null,
    });

    if (options.durationMs !== null) {
      toastTimeoutRef.current = window.setTimeout(() => {
        setToast({ message: "", type: null, customerLogin: null, customerPassword: null });
        toastTimeoutRef.current = null;
      }, options.durationMs ?? 3000);
    }
  };

  const openDirections = async (job: WorkerJob) => {
    const destination = getJobDirectionDestination(job);
    const browserLocation = await getCurrentBrowserLocation();
    const origin = browserLocation || (isGpsPoint(job.worker_gps_location) ? job.worker_gps_location : null);
    const embedUrl = destination ? buildDirectionsEmbedUrl(destination, origin) : null;
    const externalUrl = destination ? buildDirectionsExternalUrl(destination, origin) : null;

    if (!destination) {
      showToast("Công việc này chưa có vị trí khách hàng. Vui lòng nhập điểm đến để chỉ đường.", "info");
    }

    setDirectionsView({
      job,
      embedUrl,
      externalUrl,
      origin,
      destinationInput: job.address?.trim() || "",
      destinationLat: "",
      destinationLng: "",
    });
  };

  const setDirectionsField = (field: "destinationInput" | "destinationLat" | "destinationLng", value: string) => {
    setDirectionsView(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const showDirectionsForDraft = () => {
    setDirectionsView(prev => {
      if (!prev) return prev;

      const lat = Number(prev.destinationLat.trim());
      const lng = Number(prev.destinationLng.trim());
      const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
      const destination = hasCoordinates
        ? `${lat},${lng}`
        : prev.destinationInput.trim();

      if (!destination) {
        showToast("Vui lòng nhập địa điểm hoặc tọa độ điểm đến.", "error");
        return prev;
      }

      return {
        ...prev,
        embedUrl: buildDirectionsEmbedUrl(destination, prev.origin),
        externalUrl: buildDirectionsExternalUrl(destination, prev.origin),
      };
    });
  };

  const useCurrentLocationAsOrigin = async () => {
    const currentLocation = await getCurrentBrowserLocation();
    if (!currentLocation) {
      showToast("Không lấy được vị trí hiện tại của thợ. Vui lòng cho phép trình duyệt lấy vị trí.", "error");
      return;
    }

    setDirectionsView(prev => {
      if (!prev) return prev;

      const lat = Number(prev.destinationLat.trim());
      const lng = Number(prev.destinationLng.trim());
      const destination = Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat},${lng}`
        : getJobDirectionDestination(prev.job) || prev.destinationInput.trim();

      return {
        ...prev,
        origin: currentLocation,
        embedUrl: destination ? buildDirectionsEmbedUrl(destination, currentLocation) : null,
        externalUrl: destination ? buildDirectionsExternalUrl(destination, currentLocation) : null,
      };
    });
  };

  const newJobsRef = React.useRef<WorkerJob[]>([]);
  const mockActiveJobsRef = React.useRef<WorkerJob[]>([]);
  const refreshTimerRef = React.useRef<number | null>(null);
  const refreshInFlightRef = React.useRef(false);
  const refreshQueuedRef = React.useRef(false);

  useEffect(() => {
    newJobsRef.current = newJobs;
  }, [newJobs]);

  useEffect(() => {
    const openQuickJob = () => setQuickFormOpen(true);
    window.addEventListener("worker:open-quick-job", openQuickJob);
    return () => window.removeEventListener("worker:open-quick-job", openQuickJob);
  }, []);

  const loadWorkerMonthlyGoal = React.useCallback(async (workerId: string, isBackground = false): Promise<WorkerMonthlyGoalState | null> => {
    const { data, error } = await supabase
      .from("worker_monthly_goals")
      .select("id, worker_id, goal_month, revenue_target, total_customers_target, new_customers_target, skipped")
      .eq("worker_id", workerId)
      .in("goal_month", [currentGoalMonth, previousGoalMonth])
      .order("goal_month", { ascending: false });

    if (error) {
      if (!isBackground) {
        setMonthlyGoalError("Chưa tải được mục tiêu tháng. Hãy chạy migration worker_monthly_goals.");
      }
      return null;
    }

    const goals = (data || []) as unknown as WorkerMonthlyGoal[];
    const currentGoal = goals.find(goal => goal.goal_month === currentGoalMonth) || null;
    const previousGoal = goals.find(goal => goal.goal_month === previousGoalMonth) || null;
    const suggestion = currentGoal
      ? {
        revenueTarget: Number(currentGoal.revenue_target || DEFAULT_WORKER_MONTHLY_GOAL.revenueTarget),
        totalCustomersTarget: Number(currentGoal.total_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.totalCustomersTarget),
        newCustomersTarget: Number(currentGoal.new_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.newCustomersTarget),
      }
      : previousGoal
        ? {
          revenueTarget: Number(previousGoal.revenue_target || DEFAULT_WORKER_MONTHLY_GOAL.revenueTarget),
          totalCustomersTarget: Number(previousGoal.total_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.totalCustomersTarget),
          newCustomersTarget: Number(previousGoal.new_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.newCustomersTarget),
        }
        : DEFAULT_WORKER_MONTHLY_GOAL;

    const nextDraft = makeGoalDraft(suggestion);
    const nextFormOpen = !currentGoal ? true : currentGoal.skipped ? false : false;
    setMonthlyGoalError("");
    setMonthlyGoal(currentGoal);
    setMonthlyGoalDraft(nextDraft);
    if (!currentGoal) setMonthlyGoalFormOpen(true);
    if (currentGoal?.skipped) setMonthlyGoalFormOpen(false);

    return {
      monthlyGoal: currentGoal,
      monthlyGoalDraft: nextDraft,
      monthlyGoalFormOpen: nextFormOpen,
    };
  }, [currentGoalMonth, previousGoalMonth, supabase]);
  const saveWorkerMonthlyGoal = async (skipped = false) => {
    if (!worker?.id) return;

    const revenueTarget = Math.max(0, Number(monthlyGoalDraft.revenueTarget || 0));
    const totalCustomersTarget = Math.max(0, Math.round(Number(monthlyGoalDraft.totalCustomersTarget || 0)));
    const newCustomersTarget = Math.max(0, Math.round(Number(monthlyGoalDraft.newCustomersTarget || 0)));

    setMonthlyGoalSaving(true);
    setMonthlyGoalError("");

    const { data, error } = await supabase
      .from("worker_monthly_goals")
      .upsert({
        worker_id: worker.id,
        goal_month: currentGoalMonth,
        revenue_target: revenueTarget,
        total_customers_target: totalCustomersTarget,
        new_customers_target: newCustomersTarget,
        skipped,
      }, { onConflict: "worker_id,goal_month" })
      .select("id, worker_id, goal_month, revenue_target, total_customers_target, new_customers_target, skipped")
      .single();

    setMonthlyGoalSaving(false);

    if (error) {
      const action = skipped ? "bỏ qua" : "lưu";
      setMonthlyGoalError(`Không thể ${action} mục tiêu tháng. Vui lòng kiểm tra migration worker_monthly_goals.`);
      return;
    }

    setMonthlyGoal(data as unknown as WorkerMonthlyGoal);
    setMonthlyGoalFormOpen(false);
    showToast(skipped ? "Đã bỏ qua mục tiêu tháng này." : "Đã lưu mục tiêu tháng.", "success");
  };

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isBrowserOffline()) {
      const restored = await restoreDashboardOfflineSnapshot(user.id);
      if (!restored) {
        logOfflineDebug("server fetch skipped", { dataset: "dashboard-summary", userId: user.id, reason: "offline-no-cache" });
      } else {
        logOfflineDebug("server fetch skipped", { dataset: "dashboard-summary", userId: user.id, reason: "offline" });
      }
      if (!isBackground) setLoading(false);
      return;
    }

    // 2. Get worker profile
    const { data: workerData } = await supabase
      .from('workers')
      .select('id, user_id, specialties, status, is_available, avg_rating, total_jobs, certificates, approved_at, created_at, user:profiles(id, full_name, phone, email, address, gps_location, latitude, longitude)')
      .eq('user_id', user.id)
      .single();

    const normalizedWorkerData = workerData
      ? {
        ...workerData,
        user: Array.isArray(workerData.user) ? workerData.user[0] || null : workerData.user,
      } as unknown as WorkerWithProfile
      : null;

    if (normalizedWorkerData) {
      const workerData = normalizedWorkerData;
      const monthlyGoalState = await loadWorkerMonthlyGoal(workerData.id, isBackground);
      const workerIsAvailable = workerData.is_available !== false;
      const workerSpecialties = workerData.specialties || [];
      const isDemoWorker = isDemoAccount(workerData.user);
      const workerProfileGps = isGpsPoint(workerData.user?.gps_location) ? workerData.user.gps_location : null;
      let nextInventoryProducts: InventoryProduct[] = [];
      let nextServices: ServiceOption[] = [];
      let nextBillGoPackages: BillGoPackage[] = [];
      let nextWorkerBillGoReceivables: WorkerBillGoReceivable[] = [];

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("worker_inventory_products")
        .select("id, worker_id, name, sku, category, purchase_price, default_sale_price, stock_quantity, unit, warranty_months, is_recurring_billgo, recurring_cycle, note, created_at, updated_at")
        .eq("worker_id", workerData.id)
        .gt("stock_quantity", 0)
        .order("name", { ascending: true });

      if (inventoryError) {
        if (!isMissingWorkerInventorySchemaError(inventoryError) && !isBackground) {
          showToast("Không thể tải kho hàng: " + inventoryError.message, "error");
        }
      } else {
        nextInventoryProducts = (inventoryData || []) as InventoryProduct[];
      }

      let { data: serviceOptions, error: servicesError } = await supabase
        .from('services')
        .select('id, name, description, base_price, icon, parent_service_id')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (servicesError) {
        const fallback = await supabase
          .from('services')
          .select('id, name, description, base_price, icon')
          .eq('is_active', true)
          .order('name', { ascending: true });
        serviceOptions = fallback.data?.map(service => ({ ...service, parent_service_id: null })) || null;
        servicesError = fallback.error;
      }

      let servicesForMatching: ServiceOption[] = [];

      if (servicesError) {
        if (!isBackground) {
          showToast("Không thể tải danh sách dịch vụ: " + servicesError.message, "error");
        }
      } else {
        const servicesWithParents = filterStandardServiceCatalog(applyDefaultServiceParents(serviceOptions || []));
        servicesForMatching = (isDemoWorker
          ? servicesWithParents
          : filterServicesForWorkerSpecialties(servicesWithParents, workerSpecialties))
            .sort(compareServicesByName);

        nextServices = servicesForMatching;
      }

      const { data: packageData, error: packageError } = await supabase
        .from("billgo_packages")
        .select("id, code, name, type, provider, monthly_price, setup_price, allowed_cycles, description, is_active, sort_order")
        .eq("is_active", true)
        .in("type", ["tv360", "receiver"])
        .order("type", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (packageError) {
        if (!isBackground) {
          showToast("Không thể tải danh mục gói cước: " + packageError.message, "error");
        }
      } else {
        nextBillGoPackages = (packageData || []) as BillGoPackage[];
      }

      // 3. Get New Jobs (Pending)
      let pendingJobsResult = await supabase
        .from('jobs')
        .select(WORKER_DASHBOARD_JOB_SELECT)
        .eq('status', 'pending')
        .is('worker_id', null)
        .order('created_at', { ascending: false }) as unknown as WorkerDashboardJobQueryResult;

      if (pendingJobsResult.error && isMissingWorkflowColumn(pendingJobsResult.error.message)) {
        pendingJobsResult = await supabase
          .from('jobs')
          .select(WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS)
          .eq('status', 'pending')
          .is('worker_id', null)
          .order('created_at', { ascending: false }) as unknown as WorkerDashboardJobQueryResult;
      }

      const pendingJobs = pendingJobsResult.data;

      // Filter pending jobs matching worker specialties
      const filteredPending = ((pendingJobs || []) as unknown as WorkerJob[]).filter(j => {
        if (isDemoWorker) return true;
        const matchedService = servicesForMatching.find(service => service.id === j.service_id);
        return j.service && serviceMatchesSpecialties({
          ...j.service,
          parentName: matchedService?.parentName || null,
        }, workerSpecialties, { allowEmptySpecialties: false });
      });

      // Map icon component
      const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { ZapIcon, DropletIcon, CameraIcon, CogIcon, Bolt, Droplets, Cctv, Network, Laptop, Printer, Cpu, Router, Wifi, Cable, PlusCircle, Settings, ShieldCheck, Smartphone, Users, AirVent, Truck, Sofa, Hammer, Monitor, Star, Blocks, Wrench };
      const mappedNew = workerIsAvailable ? sortJobsNewestFirst(filteredPending.map(j => {
        const route = getRouteEstimate(workerProfileGps, getJobCustomerGps(j));

        return {
          ...j,
          serviceName: j.service?.name || undefined,
          icon: iconMap[j.service?.icon || ""] || BriefcaseIcon,
          price: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(j.quoted_price),
          time: new Date(j.scheduled_at || j.created_at || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          distance: route.distance,
          eta: route.eta,
          hasGpsEstimate: route.hasGps,
        };
      })) : [];

      // Check if there are new jobs that weren't in the list before
      if (isBackground && mappedNew.length > 0) {
        const hasNew = mappedNew.some(nj => !newJobsRef.current.some(oj => oj.id === nj.id));
        if (hasNew) {
          showToast("Có khách vừa đặt việc mới!", "success");
        }
      }

      // 4. Get Worker Submitted Jobs (Waiting for Admin Approval)
      let workerPendingJobsResult = await supabase
        .from('jobs')
        .select(WORKER_DASHBOARD_JOB_SELECT)
        .eq('worker_id', workerData.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;

      if (workerPendingJobsResult.error && isMissingWorkflowColumn(workerPendingJobsResult.error.message)) {
        workerPendingJobsResult = await supabase
          .from('jobs')
          .select(WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS)
          .eq('worker_id', workerData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;
      }

      const workerPendingJobs = workerPendingJobsResult.data;

      const mappedPendingApproval = sortJobsNewestFirst(((workerPendingJobs || []) as unknown as WorkerJob[]).map(j => {
        const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
        const route = getRouteEstimate(workerProfileGps, getJobCustomerGps(j));
        return {
          ...j,
          customerName: custName || 'Khách hàng',
          serviceName: j.service?.name || undefined,
          time: new Date(j.scheduled_at || j.created_at || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          distance: route.distance,
          eta: route.eta,
          hasGpsEstimate: route.hasGps,
        };
      }));
      // 5. Get Active Jobs (Assigned to this worker)
      let assignedJobsResult = await supabase
        .from('jobs')
        .select(WORKER_DASHBOARD_JOB_WITH_SERVICES_SELECT)
        .eq('worker_id', workerData.id)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;

      if (assignedJobsResult.error && isMissingWorkflowColumn(assignedJobsResult.error.message)) {
        assignedJobsResult = await supabase
          .from('jobs')
          .select(WORKER_DASHBOARD_JOB_WITH_SERVICES_SELECT_WITHOUT_ATTACHMENTS)
          .eq('worker_id', workerData.id)
          .in('status', ['assigned', 'in_progress'])
          .order('created_at', { ascending: false })
          .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;
      }

      if (assignedJobsResult.error && isMissingWorkflowColumn(assignedJobsResult.error.message)) {
        assignedJobsResult = await supabase
          .from('jobs')
          .select(`${WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS}, ${WORKER_DASHBOARD_JOB_PAYMENTS_SELECT}`)
          .eq('worker_id', workerData.id)
          .in('status', ['assigned', 'in_progress'])
          .order('created_at', { ascending: false })
          .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;
      }

      if (assignedJobsResult.error && isMissingWorkflowColumn(assignedJobsResult.error.message)) {
        assignedJobsResult = await supabase
          .from('jobs')
          .select(WORKER_DASHBOARD_JOB_SELECT_WITHOUT_ATTACHMENTS)
          .eq('worker_id', workerData.id)
          .in('status', ['assigned', 'in_progress'])
          .order('created_at', { ascending: false })
          .range(0, WORKER_DASHBOARD_JOB_LIMIT - 1) as unknown as WorkerDashboardJobQueryResult;
      }
      const assignedJobs = (assignedJobsResult.data || []) as WorkerJob[];

      const mappedActive = sortJobsNewestFirst((assignedJobs || []).map(j => {
        const custName = Array.isArray(j.customer) ? j.customer[0]?.full_name : j.customer?.full_name;
        const route = getRouteEstimate(
          isGpsPoint(j.worker_gps_location) ? j.worker_gps_location : workerProfileGps,
          getJobCustomerGps(j)
        );
        return {
          ...j,
          customerName: custName || 'Khách vãng lai',
          serviceName: j.service?.name || undefined,
          time: new Date(j.scheduled_at || j.created_at || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          distance: route.distance,
          eta: route.eta,
          hasGpsEstimate: route.hasGps,
        };
      }));
      const mockActiveJobs = mockActiveJobsRef.current;
      const mappedActiveWithMocks = sortJobsNewestFirst([
        ...mockActiveJobs,
        ...mappedActive.filter(job => !mockActiveJobs.some(mockJob => mockJob.id === job.id)),
      ]);

      // 6. Calculate Real Stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { data: workerJobs, error: workerJobsError } = await supabase
        .from('jobs')
        .select('id, status, customer_id, quoted_price, final_amount, updated_at, payments(id, amount, status, paid_at)')
        .eq('worker_id', workerData.id);

      let income = 0;
      let jobsDone = 0;
      let monthlyIncome = 0;
      const servedCustomerIds = new Set<string>();
      const todayCustomerIds = new Set<string>();
      const monthlyCustomerIds = new Set<string>();
      let todayIncome = 0;
      let legacyTodayIncome = 0;
      let hasTodayJobPayments = false;
      let legacyMonthlyIncome = 0;
      let hasMonthlyJobPayments = false;
      const firstCompletedAtByCustomer = new Map<string, Date>();

      if (workerJobs) {
        workerJobs.forEach(j => {
          if (j.status === 'completed' || j.status === 'done') {
            const completedDate = j.updated_at ? new Date(j.updated_at) : null;
            const customerKey = j.customer_id || j.id;
            if (completedDate) {
              const firstCompletedAt = firstCompletedAtByCustomer.get(customerKey);
              if (!firstCompletedAt || completedDate < firstCompletedAt) {
                firstCompletedAtByCustomer.set(customerKey, completedDate);
              }
            }
            const completedToday = Boolean(
              completedDate &&
              completedDate >= todayStart &&
              completedDate < nextDayStart
            );
            const completedThisMonth = Boolean(
              completedDate &&
              completedDate >= monthStart &&
              completedDate < nextMonthStart
            );
            servedCustomerIds.add(customerKey);
            if (completedToday) todayCustomerIds.add(customerKey);
            if (completedThisMonth) monthlyCustomerIds.add(customerKey);

            income += Number(j.final_amount || j.quoted_price || 0);
            if (completedToday) {
              legacyTodayIncome += Number(j.final_amount || j.quoted_price || 0);
            }
            if (completedThisMonth) {
              legacyMonthlyIncome += Number(j.final_amount || j.quoted_price || 0);
            }

            (j.payments || []).forEach(payment => {
              if (payment.status !== "paid" || !payment.paid_at) return;
              const paidDate = new Date(payment.paid_at);
              if (paidDate >= todayStart && paidDate < nextDayStart) {
                hasTodayJobPayments = true;
                todayIncome += Number(payment.amount || 0);
              }
              if (paidDate >= monthStart && paidDate < nextMonthStart) {
                hasMonthlyJobPayments = true;
                monthlyIncome += Number(payment.amount || 0);
              }
            });
          }
        });
      }

      jobsDone = servedCustomerIds.size;
      if (!hasTodayJobPayments) todayIncome = legacyTodayIncome;
      if (!hasMonthlyJobPayments) monthlyIncome = legacyMonthlyIncome;
      const monthlyNewCustomerCount = [...firstCompletedAtByCustomer.values()]
        .filter(firstCompletedAt => firstCompletedAt >= monthStart && firstCompletedAt < nextMonthStart)
        .length;

      const { data: todayRatings, error: todayRatingsError } = await supabase
        .from("ratings")
        .select("score, created_at")
        .eq("worker_id", workerData.id)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", nextDayStart.toISOString());

      const { data: monthlyRatings, error: monthlyRatingsError } = await supabase
        .from("ratings")
        .select("score, created_at")
        .eq("worker_id", workerData.id)
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", nextMonthStart.toISOString());

      const todayRating = todayRatings && todayRatings.length > 0
        ? Number((todayRatings.reduce((sum, item) => sum + Number(item.score || 0), 0) / todayRatings.length).toFixed(1))
        : 0;

      const monthlyRating = monthlyRatings && monthlyRatings.length > 0
        ? Number((monthlyRatings.reduce((sum, item) => sum + Number(item.score || 0), 0) / monthlyRatings.length).toFixed(1))
        : 0;

      const billGoMonthEnd = toBillGoDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const { data: billGoReceivablesData, error: billGoReceivablesError } = await supabase
        .from("billgo_receivables")
        .select("id, customer_id, worker_id, job_id, subscription_id, type, title, package_id, package_name_at_collection, total_amount, due_date, period_start, period_end, billing_months, bonus_months, service_months, paid_amount, monthly_fee_at_collection, cycle_at_collection, next_period_start, next_due_date, status, note, customer:profiles!customer_id(full_name, phone, address), subscription:billgo_subscriptions(customer_name, phone, internet_account, customer_address, package_name, cycle, current_cycle, next_due_date)")
        .eq("worker_id", workerData.id)
        .is("deleted_at", null)
        .in("status", ["unpaid", "partial", "overdue", "due"])
        .lte("due_date", billGoMonthEnd)
        .order("due_date", { ascending: true })
        .range(0, WORKER_DASHBOARD_BILLGO_LIMIT - 1);

      if (billGoReceivablesError) {
        if (!isBackground) {
          showToast("Không thể tải danh sách khách BillGo: " + billGoReceivablesError.message, "error");
        }
      } else {
        nextWorkerBillGoReceivables = (billGoReceivablesData || []) as unknown as WorkerBillGoReceivable[];
      }

      const nextDashboardData: WorkerDashboardData = {
        worker: workerData,
        newJobs: mappedNew,
        pendingApprovalJobs: mappedPendingApproval,
        activeJobs: mappedActiveWithMocks,
        inventoryProducts: nextInventoryProducts,
        workerBillGoReceivables: nextWorkerBillGoReceivables,
        billGoPackages: nextBillGoPackages,
        services: nextServices,
        workerStats: {
          jobsDone: workerJobs ? jobsDone : workerData.total_jobs || 0,
          income: income,
          rating: workerData.avg_rating || 0,
          todayCustomers: todayCustomerIds.size,
          todayIncome,
          todayRating,
          monthlyCustomers: monthlyCustomerIds.size,
          monthlyNewCustomers: monthlyNewCustomerCount,
          monthlyIncome,
          monthlyRating,
        },
      };

      setDashboardData(prev => ({
        ...prev,
        ...nextDashboardData,
      }));

      if (!isBackground) setLoading(false);

      void (async () => {
        const profileKey = makeWorkerUserDatasetKey("worker-profile", user.id);
        const cachedProfile = await getCachedDataset<WorkerProfileCache>(profileKey);
        const storeId = cachedProfile?.data.storeId || null;
        const cacheScope: WorkerOfflineScope = { userId: user.id, workerId: workerData.id, storeId };
        const fallbackMonthlyGoalState: WorkerMonthlyGoalState = {
          monthlyGoal: null,
          monthlyGoalDraft: makeGoalDraft(DEFAULT_WORKER_MONTHLY_GOAL),
          monthlyGoalFormOpen: false,
        };
        const dashboardSnapshot: WorkerDashboardOfflineSnapshot = {
          worker: workerData,
          newJobs: mappedNew.map(stripDashboardJobForCache),
          pendingApprovalJobs: mappedPendingApproval.map(stripDashboardJobForCache),
          activeJobs: mappedActive.map(stripDashboardJobForCache),
          inventoryProducts: nextInventoryProducts,
          workerBillGoReceivables: nextWorkerBillGoReceivables,
          billGoPackages: nextBillGoPackages,
          services: nextServices,
          workerStats: nextDashboardData.workerStats,
          ...(monthlyGoalState || fallbackMonthlyGoalState),
        };
        const cacheWrites: Promise<unknown>[] = [
          setCachedDataset(profileKey, { worker: workerData, storeId } satisfies WorkerProfileCache, { dataset: "worker-profile", userId: user.id, workerId: workerData.id, storeId }),
          setCachedDataset(makeWorkerDatasetKey("store", cacheScope), { userId: user.id, workerId: workerData.id, storeId }, { dataset: "store", userId: user.id, workerId: workerData.id, storeId }),
        ];

        const canCacheDashboard = !pendingJobsResult.error && !workerPendingJobsResult.error && !assignedJobsResult.error && !workerJobsError && !todayRatingsError && !monthlyRatingsError && !servicesError && !billGoReceivablesError;
        if (canCacheDashboard) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("dashboard-summary", cacheScope), dashboardSnapshot, { dataset: "dashboard-summary", userId: user.id, workerId: workerData.id, storeId }));
        } else {
          logOfflineDebug("skipped cache overwrite", { dataset: "dashboard-summary", cacheKey: makeWorkerDatasetKey("dashboard-summary", cacheScope), reason: "partial-fetch-error" });
        }

        if (!pendingJobsResult.error) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "available"), filteredPending, { dataset: "jobs", variant: "available", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!workerPendingJobsResult.error) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "pending"), (workerPendingJobs || []) as WorkerJob[], { dataset: "jobs", variant: "pending", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!assignedJobsResult.error) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "active"), assignedJobs.map(stripDashboardJobForCache), { dataset: "jobs", variant: "active", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!pendingJobsResult.error && !workerPendingJobsResult.error && !assignedJobsResult.error) {
          const dashboardJobs = [
            ...filteredPending,
            ...((workerPendingJobs || []) as WorkerJob[]),
            ...assignedJobs,
          ].map(stripDashboardJobForCache);
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("jobs", cacheScope, "dashboard"), dashboardJobs, { dataset: "jobs", variant: "dashboard", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!servicesError) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("categories", cacheScope), nextServices, { dataset: "categories", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!packageError) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("packages", cacheScope), nextBillGoPackages, { dataset: "packages", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!billGoReceivablesError) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("billgo", cacheScope, "dashboard"), nextWorkerBillGoReceivables, { dataset: "billgo", variant: "dashboard", userId: user.id, workerId: workerData.id, storeId }));
        }
        if (!inventoryError) {
          cacheWrites.push(setCachedDataset(makeWorkerDatasetKey("inventory", cacheScope), nextInventoryProducts, { dataset: "inventory", userId: user.id, workerId: workerData.id, storeId }));
        }
        await Promise.allSettled(cacheWrites);
      })().catch((error) => {
        console.warn("[TDN-OFFLINE]", "dashboard cache write error", error);
      });
    } else {
      setDashboardData(initialWorkerDashboardData);
    }

    if (!isBackground) setLoading(false);
  };

  const fetchDataRef = React.useRef(fetchData);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  useEffect(() => {
    const refreshDashboard = async (isBackground = true) => {
      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true;
        return;
      }

      refreshInFlightRef.current = true;
      try {
        await fetchDataRef.current(isBackground);
      } finally {
        refreshInFlightRef.current = false;
        if (refreshQueuedRef.current) {
          refreshQueuedRef.current = false;
          void refreshDashboard(true);
        }
      }
    };

    const scheduleRealtimeRefresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refreshDashboard(true);
      }, WORKER_DASHBOARD_REALTIME_DEBOUNCE_MS);
    };

    const initialFetch = window.setTimeout(() => {
      void refreshDashboard(false);
    }, 0);

    const jobsChannel = supabase
      .channel("worker-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_services" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_inventory_products" },
        () => {
          scheduleRealtimeRefresh();
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialFetch);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(jobsChannel);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [supabase]);

  const handleAcceptJob = async (jobId: string) => {
    if (!worker) return;
    if (worker.is_available === false) {
      showToast("Bạn đang Offline nên không thể nhận việc mới. Bật Online để nhận việc.", "info");
      return;
    }
    const jobToAssign = newJobs.find(j => j.id === jobId);
    const workerBrowserLocation = await getCurrentBrowserLocation();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: workerProfile } = user
      ? await supabase
        .from('profiles')
        .select('gps_location')
        .eq('id', user.id)
        .single()
      : { data: null };
    let customerGpsLocation = jobToAssign?.customer_gps_location || jobToAssign?.gps_location || null;

    if (jobToAssign?.customer_id) {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('gps_location')
        .eq('id', jobToAssign.customer_id)
        .single();
      customerGpsLocation = customerProfile?.gps_location || customerGpsLocation;
    }

    const workerGpsLocation = workerBrowserLocation || workerProfile?.gps_location || null;
    const { data: acceptedJobData, error } = await supabase.rpc("worker_accept_job", {
      p_job_id: jobId,
      p_customer_gps_location: customerGpsLocation,
      p_worker_gps_location: workerGpsLocation,
    });

    if (error) {
      console.error(error);
      const jobAlreadyAccepted =
        error.message?.includes("Công việc đã được thợ khác nhận") ||
        error.message?.includes("JOB_ALREADY_ACCEPTED");
      const workerOffline = error.message?.includes("WORKER_OFFLINE");
      const acceptJobRpcMissing =
        error.code === "PGRST202" ||
        error.message?.includes("worker_accept_job");
      const acceptJobSchemaMissing =
        error.code === "42703" &&
        (error.message?.includes("customer_gps_location") || error.message?.includes("worker_gps_location"));

      showToast(
        jobAlreadyAccepted
          ? "Công việc đã được thợ khác nhận."
          : workerOffline
            ? "Bạn đang Offline nên không thể nhận việc mới. Bật Online để nhận việc."
          : acceptJobRpcMissing || acceptJobSchemaMissing
            ? "Chức năng nhận việc chưa được bật trong database. Vui lòng chạy migration worker_accept_job trước."
          : "Lỗi khi nhận việc: " + error.message,
        jobAlreadyAccepted || workerOffline ? "info" : "error"
      );

      if (jobAlreadyAccepted || workerOffline) {
        setNewJobs(prev => prev.filter(j => j.id !== jobId));
      }

      fetchData(true);
      return;
    }

    const acceptedJob = newJobs.find(j => j.id === jobId);
    const acceptedJobRecord = (acceptedJobData || {}) as Partial<WorkerJob>;
    const acceptedRoute = getRouteEstimate(workerGpsLocation, customerGpsLocation);
    const normalizedAcceptedJob: WorkerJob = {
      ...(acceptedJob || {}),
      ...acceptedJobRecord,
      id: jobId,
      status: "assigned",
      worker_id: worker.id,
      customerName: acceptedJobRecord.customerName || acceptedJob?.customerName || "Khách hàng",
      serviceName: acceptedJobRecord.serviceName || acceptedJob?.serviceName || "Dịch vụ",
      customer: acceptedJobRecord.customer || acceptedJob?.customer || null,
      customer_gps_location: customerGpsLocation,
      worker_gps_location: workerGpsLocation,
      distance: acceptedRoute.distance,
      eta: acceptedRoute.eta,
      hasGpsEstimate: acceptedRoute.hasGps,
      images: acceptedJobRecord.images || acceptedJob?.images || [],
      quoted_price: Number(acceptedJobRecord.quoted_price || acceptedJob?.quoted_price || 0),
      time: acceptedJobRecord.scheduled_at
        ? new Date(acceptedJobRecord.scheduled_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : acceptedJob?.time,
    };

    showToast("Đã nhận việc thành công.", "success");
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
    setPendingApprovalJobs(prev => prev.filter(j => j.id !== jobId));
    setActiveJobs(prev => {
      if (prev.some(job => job.id === jobId)) return prev;
      return sortJobsNewestFirst([normalizedAcceptedJob, ...prev]);
    });
    setTab("active");
    fetchData(true);
  };

  const handleDeclineJob = (jobId: string) => {
    // Just hide from feed (don't change job status)
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
    showToast('Đã bỏ qua công việc này.', 'info');
  };

  const handleToggleAvailability = async () => {
    if (!worker || availabilitySaving) return;

    const nextAvailable = worker.is_available === false;
    setAvailabilitySaving(true);

    const { error } = await supabase
      .from("workers")
      .update({ is_available: nextAvailable })
      .eq("id", worker.id);

    if (error) {
      showToast(
        error.code === "42703"
          ? "Database chưa có cột is_available. Vui lòng chạy migration worker availability trước."
          : "Không thể cập nhật trạng thái nhận việc: " + error.message,
        "error"
      );
      setAvailabilitySaving(false);
      return;
    }

    setWorker(current => current ? { ...current, is_available: nextAvailable } : current);
    window.dispatchEvent(new CustomEvent("worker:availability-changed", {
      detail: { isAvailable: nextAvailable },
    }));

    if (!nextAvailable) {
      setNewJobs([]);
      setTab(current => current === "new" ? "active" : current);
    }

    showToast(
      nextAvailable
        ? "Bạn đã Online, hệ thống sẽ hiển thị việc mới phù hợp."
        : "Bạn đã Offline, hệ thống sẽ tạm ẩn việc mới để bạn nghỉ ngơi.",
      "success"
    );
    setAvailabilitySaving(false);
    fetchData(true);
  };

  const handleToggleAvailabilityRef = React.useRef<() => void>(() => {});

  useEffect(() => {
    handleToggleAvailabilityRef.current = () => {
      void handleToggleAvailability();
    };
  });

  useEffect(() => {
    const handleAvailabilityToggleRequest = () => handleToggleAvailabilityRef.current();
    window.addEventListener("worker:toggle-availability-request", handleAvailabilityToggleRequest);
    return () => window.removeEventListener("worker:toggle-availability-request", handleAvailabilityToggleRequest);
  }, []);

  const handleQuickServiceChange = (serviceId: string) => {
    setQuickJob(prev => {
      const nextIds = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      const nextServices = nextIds
        .map(id => services.find(service => service.id === id))
        .filter((service): service is ServiceOption => Boolean(service));
      const totalPrice = nextServices.reduce((sum, service) => sum + Number(service.base_price || 0), 0);
      setQuickWorkflowData(current => pruneWorkflowData(current, nextServices, { excludeSectionKeys: handoverWorkflowSectionKeys }));
      return {
        ...prev,
        serviceId: nextIds[0] || "",
        serviceIds: nextIds,
        quotedPrice: totalPrice > 0 ? String(totalPrice) : "",
      };
    });
  };

  const handleQuickServiceSuggestionClick = (service: ServiceOption) => {
    handleQuickServiceChange(service.id);
    setQuickServiceSearch(getQuickServicePathLabel(service, services));
  };

  const selectQuickCustomer = (customer: QuickCustomerOption) => {
    setQuickJob(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || prev.customerPhone,
      address: customer.address || prev.address,
    }));
  };

  const selectEditQuickCustomer = (customer: QuickCustomerOption) => {
    setEditQuickJob(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || prev.customerPhone,
      address: customer.address || prev.address,
    }));
    setEditQuickCustomerQuery([
      customer.name,
      customer.phone,
      customer.account ? `Account ${customer.account}` : "",
    ].filter(Boolean).join(" - "));
  };

  const handleEditQuickServiceChange = (serviceId: string) => {
    setEditQuickJob(prev => {
      const nextIds = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return {
        ...prev,
        serviceId: nextIds[0] || "",
        serviceIds: nextIds,
      };
    });
  };

  const openQuickJobEdit = (job: WorkerJob) => {
    if (!["assigned", "in_progress"].includes(String(job.status))) {
      showToast("Công việc đã hoàn thành hoặc đã khóa, không thể sửa.", "error");
      return;
    }

    const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
    const linkedServiceIds = getJobServices(job)
      .map(service => service.id)
      .filter((serviceId): serviceId is string => Boolean(serviceId));
    const serviceIds = normalizeServiceIds(job.service_id, linkedServiceIds);
    const firstService = serviceIds[0] ? services.find(service => service.id === serviceIds[0]) : null;
    const customerName = customer?.full_name || job.customerName || "";
    const customerPhone = customer?.phone || "";

    setEditingQuickJob(job);
    setEditQuickJob({
      customerId: job.customer_id || "",
      customerName,
      customerPhone,
      serviceId: serviceIds[0] || job.service_id || "",
      serviceIds,
      address: job.address || customer?.address || "",
      description: job.description || "",
    });
    setEditQuickCustomerQuery([customerName, customerPhone].filter(Boolean).join(" - "));
    setEditQuickServiceSearch(firstService ? getQuickServicePathLabel(firstService, services) : "");
    setEditQuickServicePickerOpen(false);
    setExpandedEditQuickServiceGroup(quickServiceGroups[0]?.category.id || "internet");
  };

  const updateEditedJobInState = (updatedJob: WorkerJob) => {
    setActiveJobs(prev => prev.map(item =>
      item.id === updatedJob.id ? { ...item, ...updatedJob } : item
    ));
    setPendingApprovalJobs(prev => prev.map(item =>
      item.id === updatedJob.id ? { ...item, ...updatedJob } : item
    ));
    mockActiveJobsRef.current = mockActiveJobsRef.current.map(item =>
      item.id === updatedJob.id ? { ...item, ...updatedJob } : item
    );
  };

  const handleSaveQuickJobEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingQuickJob || savingQuickJobEdit) return;

    if (!["assigned", "in_progress"].includes(String(editingQuickJob.status))) {
      showToast("Công việc đã hoàn thành hoặc đã khóa, không thể sửa.", "error");
      return;
    }

    if ((!editQuickJob.customerId && (!editQuickJob.customerName.trim() || !editQuickJob.customerPhone.trim())) || !editQuickJob.serviceId || !editQuickJob.address.trim()) {
      showToast("Vui lòng chọn khách, dịch vụ và địa chỉ hợp lệ.", "error");
      return;
    }

    const selectedServices = selectedEditQuickServices.length > 0
      ? selectedEditQuickServices
      : services.filter(service => editQuickJob.serviceIds.includes(service.id));
    const firstService = selectedServices[0] || services.find(service => service.id === editQuickJob.serviceId);
    const currentCustomer = Array.isArray(editingQuickJob.customer) ? editingQuickJob.customer[0] : editingQuickJob.customer;
    const nextCustomer = {
      ...(currentCustomer || {}),
      full_name: editQuickJob.customerName,
      phone: editQuickJob.customerPhone,
      address: editQuickJob.address,
    };

    const normalizedJob: WorkerJob = {
      ...editingQuickJob,
      customer_id: editQuickJob.customerId || editingQuickJob.customer_id,
      customerName: editQuickJob.customerName,
      customer: nextCustomer,
      service_id: editQuickJob.serviceId,
      serviceName: firstService?.name || editingQuickJob.serviceName,
      service: firstService || editingQuickJob.service,
      job_services: selectedServices.map(service => ({ service })),
      address: editQuickJob.address,
      description: editQuickJob.description || null,
    };

    if (String(editingQuickJob.id).startsWith("mock-")) {
      updateEditedJobInState(normalizedJob);
      setEditingQuickJob(null);
      showToast("Đã cập nhật công việc demo.", "success");
      return;
    }

    setSavingQuickJobEdit(true);
    try {
      const res = await fetch("/api/worker/jobs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: editingQuickJob.id,
          customerId: editQuickJob.customerId || null,
          customerName: editQuickJob.customerName,
          customerPhone: editQuickJob.customerPhone,
          serviceId: editQuickJob.serviceId,
          serviceIds: editQuickJob.serviceIds,
          address: editQuickJob.address,
          description: editQuickJob.description,
        }),
      });

      const data = (await res.json()) as WorkerUpdateJobResponse;
      if (!res.ok) {
        throw new Error(data.error || "Không thể cập nhật công việc.");
      }

      const returnedJob: Partial<WorkerJob> = data.job || {};
      updateEditedJobInState({
        ...normalizedJob,
        ...returnedJob,
        customerName: returnedJob.customerName || returnedJob.customer?.full_name || normalizedJob.customerName,
        serviceName: returnedJob.serviceName || returnedJob.service?.name || normalizedJob.serviceName,
        job_services: selectedServices.map(service => ({ service })),
      });
      setEditingQuickJob(null);
      setEditQuickServicePickerOpen(false);
      showToast("Đã cập nhật thông tin công việc.", "success");
      fetchData(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Không thể cập nhật công việc.", "error");
    } finally {
      setSavingQuickJobEdit(false);
    }
  };

  const handleUpdateServiceDetail = async (job: WorkerJob, serviceDetailId: string) => {
    const nextDetailId = serviceDetailId || null;
    const { error } = await supabase
      .from("jobs")
      .update({ service_detail_id: nextDetailId })
      .eq("id", job.id);

    if (error) {
      showToast("Không thể cập nhật chi tiết kỹ thuật: " + error.message, "error");
      return;
    }

    setActiveJobs(prev => prev.map(item =>
      item.id === job.id ? { ...item, service_detail_id: nextDetailId } : item
    ));
    setPendingApprovalJobs(prev => prev.map(item =>
      item.id === job.id ? { ...item, service_detail_id: nextDetailId } : item
    ));
    showToast("Đã cập nhật chi tiết kỹ thuật.", "success");
  };

  const handleCollectBillGoReceivable = async (receivable: WorkerBillGoReceivable) => {
    if (collectingPaymentJobId) return;
    const parsedAmount = toMoneyNumber(paymentAmount);

    if (parsedAmount <= 0) {
      showToast("Số tiền thu phải lớn hơn 0.", "error");
      return;
    }

    setCollectingPaymentJobId(receivable.id);
    const { data: { user } } = await supabase.auth.getUser();
    const effectivePaymentCycle = paymentCyclesByReceivable[receivable.id]
      || receivable.cycle_at_collection as BillGoCycle
      || receivable.subscription?.current_cycle as BillGoCycle
      || receivable.subscription?.cycle as BillGoCycle
      || paymentCycle;
    const cycle = getBillGoCycleOption(effectivePaymentCycle);
    const baseDate = receivable.period_end
      ? getBillGoNextPeriodStartDate(receivable.period_end)
      : receivable.period_start || new Date().toISOString().slice(0, 10);
    const nextBillingPeriod = getBillGoBillingPeriod(baseDate, effectivePaymentCycle);

    const { data, error } = await supabase
      .from("payments")
      .insert({
        receivable_id: receivable.id,
        job_id: receivable.job_id || null,
        amount: parsedAmount,
        method: paymentMethod,
        status: "paid",
        paid_at: new Date().toISOString(),
        collected_by: user?.id || null,
        note: [`Thu ${cycle.label}`, paymentNote.trim()].filter(Boolean).join(" · ") || null,
      })
      .select("id, amount, method, status, paid_at, note")
      .single();

    if (error) {
      showToast("Không thể ghi nhận thanh toán: " + error.message, "error");
      setCollectingPaymentJobId(null);
      return;
    }

    const currentSummary = getBillGoReceivableSummary(receivable);
    const nextPaid = currentSummary.paid + parsedAmount;
    const totalAmount = toMoneyNumber(receivable.total_amount);
    const nextStatus = getBillGoStoredStatus(totalAmount, nextPaid, receivable.due_date);
    const receiptCode = buildBillGoReceiptCode(data.id, data.paid_at || new Date());
    const lookupCode = buildBillGoReceiptLookupCode(receiptCode);
    const receiptUrl = `${window.location.origin}/billgo/receipt/${lookupCode}`;
    const customerName = receivable.subscription?.customer_name || receivable.customer?.full_name || null;
    const customerPhone = receivable.subscription?.phone || receivable.customer?.phone || null;
    const customerAddress = receivable.subscription?.customer_address || receivable.customer?.address || null;
    const packageName = receivable.package_name_at_collection || receivable.subscription?.package_name || receivable.title || null;

    const { error: receiptError } = await supabase
      .from("billgo_receipts")
      .insert({
        receipt_code: receiptCode,
        lookup_code: lookupCode,
        qr_payload: receiptUrl,
        payment_id: data.id,
        receivable_id: receivable.id,
        subscription_id: receivable.subscription_id || null,
        worker_id: receivable.worker_id || worker?.id || null,
        collected_by: user?.id || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        internet_account: receivable.subscription?.internet_account || null,
        customer_address: customerAddress,
        package_name: packageName,
        cycle_at_collection: effectivePaymentCycle,
        period_start: receivable.period_start || null,
        period_end: receivable.period_end || null,
        total_amount: totalAmount,
        paid_amount: parsedAmount,
        remaining_amount: Math.max(totalAmount - nextPaid, 0),
        payment_method: paymentMethod,
        paid_at: data.paid_at || new Date().toISOString(),
        collector_name: worker?.user?.phone || null,
        note: paymentNote.trim() || null,
      });

    if (receiptError) {
      showToast("Đã thu tiền nhưng chưa tạo được phiếu thu BillGo: " + receiptError.message, "error");
      setCollectingPaymentJobId(null);
      return;
    }

    const isFullyPaid = totalAmount > 0 && nextPaid >= totalAmount;
    const nextPeriodStart = receivable.period_end
      ? getBillGoNextPeriodStartDate(receivable.period_end)
      : nextBillingPeriod.periodStart;
    const nextCycleBilling = getBillGoBillingPeriod(nextPeriodStart, effectivePaymentCycle);
    const monthlyFee = toMoneyNumber(receivable.monthly_fee_at_collection)
      || (cycle.paidMonths > 0 ? Math.round(totalAmount / cycle.paidMonths) : totalAmount);
    const nextTotalAmount = getBillGoCollectableAmount(monthlyFee, effectivePaymentCycle);

    const { error: updateError } = await supabase
      .from("billgo_receivables")
      .update({
        status: nextStatus,
        billing_months: cycle.paidMonths,
        bonus_months: cycle.bonusMonths,
        paid_amount: nextPaid,
      })
      .eq("id", receivable.id);

    if (updateError) {
      showToast("Đã thu tiền nhưng chưa cập nhật được công nợ: " + updateError.message, "error");
      setCollectingPaymentJobId(null);
      return;
    }

    if (receivable.subscription_id) {
      await supabase
        .from("billgo_subscriptions")
        .update({
          cycle: effectivePaymentCycle,
          current_cycle: effectivePaymentCycle,
          next_due_date: nextCycleBilling.dueDate,
          next_period_start: nextPeriodStart,
          covered_until: receivable.period_end || null,
        })
        .eq("id", receivable.subscription_id);
    }

    let nextReceivable: WorkerBillGoReceivable | null = null;
    if (isFullyPaid && receivable.subscription_id && nextTotalAmount > 0) {
      const billingParts = getBillGoBillingParts(nextCycleBilling.collectionMonth);
      const { data: existingNextReceivable } = await supabase
        .from("billgo_receivables")
        .select("id")
        .eq("subscription_id", receivable.subscription_id)
        .eq("period_start", nextCycleBilling.periodStart)
          .eq("type", receivable.type || "subscription_fee")
        .maybeSingle();

      if (!existingNextReceivable) {
        const { data: createdNextReceivable, error: nextReceivableError } = await supabase
          .from("billgo_receivables")
          .insert({
            customer_id: receivable.customer_id,
            worker_id: receivable.worker_id || worker?.id || null,
            job_id: receivable.job_id || null,
            subscription_id: receivable.subscription_id,
            type: receivable.type || "subscription_fee",
            package_id: receivable.package_id || null,
            package_name_at_collection: receivable.package_name_at_collection || receivable.subscription?.package_name || null,
            title: receivable.title || `Thu cước ${receivable.subscription?.package_name || "BillGo"}`,
            total_amount: nextTotalAmount,
            due_date: nextCycleBilling.dueDate,
            period_start: nextCycleBilling.periodStart,
            period_end: nextCycleBilling.periodEnd,
            collection_month: nextCycleBilling.collectionMonth,
            usage_month: nextCycleBilling.usageMonth,
            billing_month: billingParts.billingMonth,
            billing_year: billingParts.billingYear,
            billing_months: cycle.paidMonths,
            bonus_months: cycle.bonusMonths,
            cycle_at_collection: effectivePaymentCycle,
            service_months: cycle.paidMonths + cycle.bonusMonths,
            paid_amount: 0,
            monthly_fee_at_collection: monthlyFee,
            next_period_start: getBillGoNextPeriodStartDate(nextCycleBilling.periodEnd),
            next_due_date: getBillGoNextDueDate(getBillGoNextPeriodStartDate(nextCycleBilling.periodEnd), effectivePaymentCycle),
            status: getBillGoStoredStatus(nextTotalAmount, 0, nextCycleBilling.dueDate),
            note: receivable.note || null,
            created_by: user?.id || null,
          })
          .select("id, customer_id, worker_id, job_id, subscription_id, type, title, package_id, package_name_at_collection, total_amount, due_date, period_start, period_end, billing_months, bonus_months, service_months, paid_amount, monthly_fee_at_collection, cycle_at_collection, next_period_start, next_due_date, status, note, customer:profiles!customer_id(full_name, phone, address), subscription:billgo_subscriptions(customer_name, phone, internet_account, customer_address, package_name, cycle, current_cycle, next_due_date)")
          .single();

        if (nextReceivableError) {
          showToast("Đã thu tiền nhưng chưa tạo được kỳ thu tiếp theo: " + nextReceivableError.message, "error");
        } else {
          nextReceivable = createdNextReceivable as unknown as WorkerBillGoReceivable;
        }
      }
    }

    setWorkerBillGoReceivables(prev => {
      const updated = prev.map(item =>
        item.id === receivable.id
          ? {
              ...item,
              status: nextStatus,
              billing_months: cycle.paidMonths,
              bonus_months: cycle.bonusMonths,
              paid_amount: nextPaid,
              payments: [...(item.payments || []), data],
              subscription: item.subscription ? { ...item.subscription, cycle: effectivePaymentCycle, current_cycle: effectivePaymentCycle, next_due_date: nextCycleBilling.dueDate } : item.subscription,
            }
          : item
      );
      return nextReceivable ? [...updated, nextReceivable] : updated;
    });
    setPaymentAmount("");
    setPaymentNote("");
    showToast("Đã ghi nhận thu cước BillGo.", "success");
    setCollectingPaymentJobId(null);
  };

  const handleCreateQuickJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || creatingQuickJob) return;

    if ((!quickJob.customerId && (!quickJob.customerName.trim() || !quickJob.customerPhone.trim())) || !quickJob.serviceId || !quickJob.address.trim()) {
      showToast("Vui lòng chọn khách đã có hoặc nhập tên, SĐT khách mới, dịch vụ và địa chỉ.", "error");
      return;
    }

    const quotedPrice = quickJob.quotedPrice ? Number(quickJob.quotedPrice) : null;
    if (quotedPrice !== null && (!Number.isFinite(quotedPrice) || quotedPrice < 0)) {
      showToast("Giá dịch vụ không hợp lệ.", "error");
      return;
    }

    setCreatingQuickJob(true);
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("/api/worker/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          customerId: quickJob.customerId || null,
          customerName: quickJob.customerName,
          customerPhone: quickJob.customerPhone,
          serviceId: quickJob.serviceId,
          serviceIds: quickJob.serviceIds,
          workflowData: pruneWorkflowData(quickWorkflowData, selectedQuickServices, { excludeSectionKeys: handoverWorkflowSectionKeys }),
          address: quickJob.address,
          scheduledAt: quickJob.scheduledAt,
          quotedPrice: quickJob.quotedPrice,
          description: quickJob.description,
        }),
      });

      const data = (await res.json()) as WorkerCreateJobResponse;
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo job.");
      }

      setQuickJob(prev => ({
        customerId: "",
        customerName: "",
        customerPhone: "",
        serviceId: prev.serviceId,
        serviceIds: prev.serviceIds,
        address: "",
        scheduledAt: getDefaultScheduledAt(),
        quotedPrice: prev.quotedPrice,
        description: "",
      }));
      setQuickWorkflowData({});
      setQuickFormOpen(false);
      const createdJob = data.job;
      const createdAsActive = createdJob?.status === "assigned" || createdJob?.status === "in_progress";
      if (createdAsActive && createdJob) {
        const normalizedCreatedJob: WorkerJob = {
          ...createdJob,
          customerName: createdJob.customerName || quickJob.customerName,
          serviceName: createdJob.serviceName || services.find(service => service.id === quickJob.serviceId)?.name || "Dịch vụ",
          job_services: selectedQuickServices.map(service => ({ service })),
          customer: createdJob.customer || { phone: quickJob.customerPhone },
          time: createdJob.scheduled_at
            ? new Date(createdJob.scheduled_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
            : new Date(quickJob.scheduledAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          images: createdJob.images || [],
        };

        if (data.mock) {
          mockActiveJobsRef.current = sortJobsNewestFirst([
            normalizedCreatedJob,
            ...mockActiveJobsRef.current.filter(job => job.id !== normalizedCreatedJob.id),
          ]);
        }

        setActiveJobs(prev => {
          if (prev.some(job => job.id === normalizedCreatedJob.id)) return prev;

          return sortJobsNewestFirst([normalizedCreatedJob, ...prev]);
        });
      }
      setTab(createdAsActive ? "active" : "pending");
      showToast(
        data.defaultPassword
          ? "Đã tạo việc nhanh. Nhớ gửi mật khẩu này cho khách."
          : data.customerAlreadyExists
            ? "Khách hàng đã có tài khoản. Đã tạo thêm công việc cho khách."
          : createdAsActive
            ? "Đã tạo việc nhanh cho khách quen."
            : "Đã tạo việc nhanh.",
        "success",
        data.defaultPassword
          ? {
              durationMs: null,
              customerLogin: data.loginPhone || null,
              customerPassword: data.defaultPassword,
            }
          : data.customerAlreadyExists
            ? {
                durationMs: null,
                customerLogin: data.loginPhone || null,
                customerPassword: "Giữ nguyên mật khẩu đã tạo trước",
              }
          : undefined
      );
      if (!data.mock) {
        fetchData(true);
      }
    } catch (err: unknown) {
      showToast(
        err instanceof DOMException && err.name === "AbortError"
          ? "Tạo việc nhanh quá lâu chưa phản hồi. Vui lòng thử lại."
          : err instanceof Error
            ? err.message
            : "Không thể tạo việc nhanh.",
        "error"
      );
    } finally {
      window.clearTimeout(requestTimeout);
      setCreatingQuickJob(false);
    }
  };

  const triggerCompleteJob = (job: WorkerJob, startWithMaterial = false) => {
    const workflowBillGo = job.workflow_data?.billgo as { cycle?: BillGoCycle; amount?: number | string } | undefined;
    const isInternetInstallJob = isInternetInstallCompletionJob(job);
    setActiveJobToComplete(job);
    setAddToBillGo(false);
    setCompletionPaymentStatus("paid");
    setCompletionPaymentAmount("");
    setCompletionPaymentMethod("cash");
    setCompletionPaymentNote("");
    setCompletionInternetInstallFeeInput("300000");
    setCompletionGiftCamera("");
    setCompletionGiftCameraPassword("");
    setCompletionInternetCycle(workflowBillGo?.cycle || "monthly");
    setCompletionInternetMonthlyFee(workflowBillGo?.amount ? String(workflowBillGo.amount) : "");
    setCompletionAddOnPackageId("");
    setCompletionAddOnCycle("monthly");
    setCompletionAddOnNote("");
    setCompletionHandoverData(pruneWorkflowData(
      job.workflow_data || {},
      getWorkflowServicesForJob(job),
      { includeSectionKeys: handoverWorkflowSectionKeys }
    ));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setCompletionItems([
      makeCompletionItem(job.serviceName || "Công dịch vụ", isInternetInstallJob ? 0 : Number(job.quoted_price || 0)),
      ...(startWithMaterial ? [makeInventoryCompletionItem()] : []),
    ]);
    setWarrantyNote("Bảo hành theo hạng mục đã ghi trên phiếu, không áp dụng cho lỗi phát sinh do sử dụng sai cách.");
  };

  const updateCompletionItem = (id: string, patch: Partial<CompletionItem>) => {
    setCompletionItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addCompletionItem = () => {
    setCompletionItems(prev => [...prev, makeCompletionItem()]);
  };

  const addInventoryCompletionItem = () => {
    setCompletionItems(prev => [
      ...prev,
      inventoryProducts.length > 0 ? makeInventoryCompletionItem() : makeCompletionItem("Vật tư", 0),
    ]);
  };

  const updateInventoryCompletionProduct = (id: string, productId: string) => {
    const product = inventoryProducts.find(item => item.id === productId);
    setCompletionItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (!product) {
        return {
          ...item,
          inventoryProductId: "",
          name: "",
          unitPrice: 0,
          warrantyDays: 0,
          sku: "",
          category: "",
          unit: "",
          source: "inventory",
        };
      }

      return {
        ...item,
        inventoryProductId: product.id,
        name: product.name,
        unitPrice: Number(product.default_sale_price || 0),
        warrantyDays: Number(product.warranty_months || 0) * 30,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        source: "inventory",
      };
    }));
  };

  const removeCompletionItem = (id: string) => {
    setCompletionItems(prev => prev.length > 1 ? prev.filter(item => item.id !== id) : prev);
  };

  const completionItemsTotal = completionItems.reduce((sum, item, index) => {
    if (isInternetCompletionJob && index === 0 && item.source !== "inventory") return sum;
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const selectedInternetInstallFee = INTERNET_INSTALL_FEE_OPTIONS.includes(toMoneyNumber(completionInternetInstallFeeInput))
    ? toMoneyNumber(completionInternetInstallFeeInput)
    : INTERNET_INSTALL_FEE_OPTIONS[0];
  const completionInternetInstallFee = isInternetCompletionJob ? selectedInternetInstallFee : 0;
  const completionInternetMonthlyFeeNumber = isInternetCompletionJob ? toMoneyNumber(completionInternetMonthlyFee) : 0;
  const completionInternetCycleTotal = completionInternetMonthlyFeeNumber > 0
    ? getBillGoCollectableAmount(completionInternetMonthlyFeeNumber, completionInternetCycle)
    : 0;
  const completionInternetReceiptTotal = completionInternetCycle === "monthly" ? 0 : completionInternetCycleTotal;
  const canGiftViettelCamera = isInternetCompletionJob && completionInternetInstallFee === 400000 && completionInternetCycle !== "monthly";
  const completionCustomerPhone = activeJobToComplete?.customer?.phone || "";
  const completionGiftCameraAccountValue = canGiftViettelCamera ? completionCustomerPhone.trim() : "";
  const completionTotal = completionItemsTotal + completionInternetInstallFee + completionInternetReceiptTotal;
  const completionAllInTotal = completionTotal + completionAddOnGrandTotal;
  const completionPaidAmount =
    completionPaymentStatus === "paid"
      ? completionTotal
      : completionPaymentStatus === "unpaid"
        ? 0
        : toMoneyNumber(completionPaymentAmount);
  const completionRemainingAmount = Math.max(completionTotal - completionPaidAmount, 0);
  const hasCompletionExtraSale = completionItems.some((item, index) =>
    (index > 0 || item.source === "inventory") && item.name.trim() && (Number(item.quantity) || 0) > 0
  );
  const completionWarrantyNote = hasCompletionExtraSale ? warrantyNote.trim() : "";

  const openCancelRequestModal = (job: WorkerJob) => {
    setJobToCancel(job);
    setCancelReason("Khách hàng từ chối lắp đặt/sửa chữa");
  };

  const handleRequestCancelJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobToCancel || requestingCancel) return;

    const reason = cancelReason.trim();
    if (!reason) {
      showToast("Vui lòng nhập lý do huỷ.", "error");
      return;
    }

    setRequestingCancel(true);
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
        .eq("id", jobToCancel.id)
        .in("status", ["assigned", "in_progress"])
        .select("id");

      if (error) {
        throw new Error("Không thể gửi yêu cầu huỷ: " + error.message);
      }

      if (!updatedJobs || updatedJobs.length === 0) {
        throw new Error("Job không còn ở trạng thái có thể yêu cầu huỷ.");
      }

      setActiveJobs(prev => prev.filter(job => job.id !== jobToCancel.id));
      setJobToCancel(null);
      setCancelReason("Khách hàng từ chối lắp đặt/sửa chữa");
      showToast("Đã gửi yêu cầu huỷ, chờ admin duyệt.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Không thể gửi yêu cầu huỷ.", "error");
    } finally {
      setRequestingCancel(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    // Add to selected files
    setSelectedFiles(prev => [...prev, ...files]);

    // Create preview URLs
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Revoke URL to avoid memory leak
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const ensureBillGoFromWorkflow = async (
    job: WorkerJob,
    billgoOverride?: {
      cycle?: BillGoCycle;
      startDate?: string;
      amount?: number | string;
      note?: string;
      packageId?: string | null;
      packageName?: string | null;
      packageType?: string | null;
      provider?: string | null;
    }
  ) => {
    const billgo = billgoOverride || job.workflow_data?.billgo;
    if (!billgo || typeof billgo !== "object" || !worker?.id || !job.customer_id) return false;

    const billgoData = billgo as {
      cycle?: BillGoCycle;
      startDate?: string;
      amount?: number | string;
      note?: string;
      packageId?: string | null;
      packageName?: string | null;
      packageType?: string | null;
      provider?: string | null;
    };
    const amount = toMoneyNumber(billgoData.amount);
    const startDate = billgoData.startDate || new Date().toISOString().slice(0, 10);
    const cycleKey = billgoData.cycle || "monthly";
    const cycle = getBillGoCycleOption(cycleKey);
    const billingPeriod = getBillGoBillingPeriod(startDate, cycleKey);
    const totalAmount = getBillGoCollectableAmount(amount, cycleKey);

    if (amount <= 0) return false;

    const { data: existingSubscription } = await supabase
      .from("billgo_subscriptions")
      .select("id")
      .eq("job_id", job.id)
      .maybeSingle();

    let subscriptionId = existingSubscription?.id || null;
    if (!subscriptionId) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from("billgo_subscriptions")
        .insert({
          customer_id: job.customer_id,
          worker_id: worker.id,
          job_id: job.id,
          service_id: job.service_id || null,
          customer_name: job.customerName || job.customer?.full_name || null,
          phone: job.customer?.phone || null,
          customer_address: job.address || job.customer?.address || null,
          provider: billgoData.provider || null,
          package_id: billgoData.packageId || null,
          package_name: billgoData.packageName || job.serviceName || "Cước Internet",
          service_type: billgoData.packageType || "internet",
          cycle: cycleKey,
          current_cycle: cycleKey,
          amount_per_cycle: amount,
          monthly_fee: amount,
          start_date: billingPeriod.periodStart,
          next_due_date: billingPeriod.dueDate,
          next_period_start: billingPeriod.periodStart,
          note: billgoData.note || null,
          created_by: worker.user_id,
        })
        .select("id")
        .single();

      if (subscriptionError) {
        console.warn("[workflow] Cannot create BillGo subscription", subscriptionError.message);
        return false;
      }
      subscriptionId = subscription.id;
    }

    const { data: existingReceivable } = await supabase
      .from("billgo_receivables")
      .select("id")
      .eq("job_id", job.id)
      .eq("type", "subscription_fee")
      .maybeSingle();

    if (existingReceivable) return false;

    const { error: receivableError } = await supabase.from("billgo_receivables").insert({
      customer_id: job.customer_id,
      worker_id: worker.id,
      job_id: job.id,
      subscription_id: subscriptionId,
      type: "subscription_fee",
      package_id: billgoData.packageId || null,
      package_name_at_collection: billgoData.packageName || null,
      title: `Thu cước ${billgoData.packageName || job.serviceName || "Internet"}`,
      total_amount: totalAmount,
      due_date: billingPeriod.dueDate,
      period_start: billingPeriod.periodStart,
      period_end: billingPeriod.periodEnd,
      billing_months: cycle.paidMonths,
      bonus_months: cycle.bonusMonths,
      cycle_at_collection: cycleKey,
      service_months: cycle.paidMonths + cycle.bonusMonths,
      paid_amount: 0,
      monthly_fee_at_collection: amount,
      status: getBillGoStoredStatus(totalAmount, 0, billingPeriod.dueDate),
      note: billgoData.note || null,
      created_by: worker.user_id,
    });

    if (receivableError) {
      console.warn("[workflow] Cannot create BillGo receivable", receivableError.message);
      return false;
    }

    return true;
  };

  const ensureBillGoAddOnFromCompletion = async (job: WorkerJob) => {
    if (!selectedCompletionAddOnPackage || !worker?.id || !job.customer_id) return;

    const allowedCycles = new Set([
      ...(selectedCompletionAddOnPackage.allowed_cycles || []),
      ...BILLGO_SIGNUP_CYCLES,
    ]);
    if (!allowedCycles.has(completionAddOnCycle)) {
      throw new Error("Chu kỳ gói cước phát sinh không hợp lệ.");
    }

    const monthlyFee = getBillGoPackagePrice(selectedCompletionAddOnPackage);
    if (monthlyFee <= 0) {
      throw new Error("Gói cước phát sinh chưa có giá hợp lệ.");
    }

    const { data: existingReceivable } = await supabase
      .from("billgo_receivables")
      .select("id")
      .eq("job_id", job.id)
      .eq("package_id", selectedCompletionAddOnPackage.id)
      .eq("type", "subscription_fee")
      .maybeSingle();

    if (existingReceivable) return;

    const startDate = toBillGoDateInput(new Date());
    const billingPeriod = getBillGoBillingPeriod(startDate, completionAddOnCycle);
    const billingParts = getBillGoBillingParts(billingPeriod.collectionMonth);
    const cycle = getBillGoCycleOption(completionAddOnCycle);
    const nextPeriodStart = getBillGoNextPeriodStartDate(billingPeriod.periodEnd);
    const nextBilling = getBillGoBillingPeriod(nextPeriodStart, completionAddOnCycle);
    const totalAmount = getBillGoCollectableAmount(monthlyFee, completionAddOnCycle);
    const note = [
      `Khách chọn thêm khi hoàn thành job ${job.job_code || job.id}`,
      completionAddOnNote.trim(),
    ].filter(Boolean).join(" · ");

    const { data: subscription, error: subscriptionError } = await supabase
      .from("billgo_subscriptions")
      .insert({
        customer_id: job.customer_id,
        worker_id: worker.id,
        job_id: job.id,
        service_id: job.service_id || null,
        customer_name: job.customerName || job.customer?.full_name || null,
        phone: job.customer?.phone || null,
        customer_address: job.address || job.customer?.address || null,
        provider: selectedCompletionAddOnPackage.provider || null,
        package_id: selectedCompletionAddOnPackage.id,
        package_name: selectedCompletionAddOnPackage.name,
        service_type: selectedCompletionAddOnPackage.type,
        cycle: completionAddOnCycle,
        current_cycle: completionAddOnCycle,
        amount_per_cycle: monthlyFee,
        monthly_fee: monthlyFee,
        start_date: billingPeriod.periodStart,
        next_due_date: billingPeriod.dueDate,
        next_period_start: billingPeriod.periodStart,
        status: "active",
        note: note || null,
        created_by: worker.user_id,
      })
      .select("id")
      .single();

    if (subscriptionError) {
      throw new Error("Không thể tạo thuê bao gói phát sinh: " + subscriptionError.message);
    }

    const { error: receivableError } = await supabase.from("billgo_receivables").insert({
      customer_id: job.customer_id,
      worker_id: worker.id,
      job_id: job.id,
      subscription_id: subscription.id,
      type: "subscription_fee",
      package_id: selectedCompletionAddOnPackage.id,
      package_name_at_collection: selectedCompletionAddOnPackage.name,
      title: `Thu cước ${selectedCompletionAddOnPackage.name}`,
      total_amount: totalAmount,
      due_date: billingPeriod.dueDate,
      period_start: billingPeriod.periodStart,
      period_end: billingPeriod.periodEnd,
      collection_month: billingPeriod.collectionMonth,
      usage_month: billingPeriod.usageMonth,
      billing_month: billingParts.billingMonth,
      billing_year: billingParts.billingYear,
      cycle_at_collection: completionAddOnCycle,
      billing_months: cycle.paidMonths,
      bonus_months: cycle.bonusMonths,
      service_months: cycle.paidMonths + cycle.bonusMonths,
      paid_amount: 0,
      monthly_fee_at_collection: monthlyFee,
      next_period_start: nextPeriodStart,
      next_due_date: nextBilling.dueDate,
      status: getBillGoStoredStatus(totalAmount, 0, billingPeriod.dueDate),
      note: note || null,
      created_by: worker.user_id,
    });

    if (receivableError) {
      await supabase.from("billgo_subscriptions").delete().eq("id", subscription.id);
      throw new Error("Không thể tạo khoản thu gói phát sinh: " + receivableError.message);
    }
  };

  const handleConfirmCompleteJob = async () => {
    if (!activeJobToComplete) return;

    const cleanedItems = completionItems
      .map(item => ({
        name: item.name.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        warrantyDays: Number(item.warrantyDays) || 0,
        inventoryProductId: item.inventoryProductId || null,
        sku: item.sku || null,
        category: item.category || null,
        unit: item.unit || null,
        source: item.source || "manual",
      }))
      .filter(item => item.name && item.quantity > 0);

    if (cleanedItems.length === 0) {
      showToast("Vui lòng nhập ít nhất một dòng sản phẩm hoặc công dịch vụ.", "error");
      return;
    }

    if (cleanedItems.some(item => item.unitPrice < 0 || item.warrantyDays < 0)) {
      showToast("Đơn giá và số ngày bảo hành không được âm.", "error");
      return;
    }

    setUploadingImages(true);
    const job = activeJobToComplete;
    const imageUrls: string[] = [];
    const finalAmount = cleanedItems.reduce((sum, item, index) => {
      if (isInternetCompletionJob && index === 0 && item.source !== "inventory") return sum;
      return sum + item.quantity * item.unitPrice;
    }, 0) + completionInternetInstallFee + completionInternetReceiptTotal;
    const paidAmount =
      completionPaymentStatus === "paid"
        ? finalAmount
        : completionPaymentStatus === "unpaid"
          ? 0
          : toMoneyNumber(completionPaymentAmount);
    const remainingAmount = Math.max(finalAmount - paidAmount, 0);
    const existingPaidAmount = (job.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const amountToRecord = Math.max(paidAmount - existingPaidAmount, 0);
    const maxWarrantyDays = cleanedItems.reduce((max, item) => Math.max(max, item.warrantyDays), 0);
    const handoverWorkflowData = pruneWorkflowData(
      completionHandoverData,
      getWorkflowServicesForJob(job),
      { includeSectionKeys: handoverWorkflowSectionKeys }
    );
    const materialDraftItems: SalesDraftItem[] = cleanedItems
      .filter(item => item.source === "inventory")
      .map(item => ({
        draftId: crypto.randomUUID(),
        productId: item.inventoryProductId || "",
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      }));

    if (paidAmount < 0) {
      showToast("Số tiền đã thu không được âm.", "error");
      setUploadingImages(false);
      return;
    }

    if (paidAmount > finalAmount) {
      showToast("Số tiền đã thu không được lớn hơn tổng tiền hóa đơn.", "error");
      setUploadingImages(false);
      return;
    }

    if (isInternetCompletionJob && completionInternetMonthlyFeeNumber < 0) {
      showToast("Cước Internet/tháng không được âm.", "error");
      setUploadingImages(false);
      return;
    }

    if (isInternetCompletionJob && !INTERNET_COMPLETION_CYCLES.includes(completionInternetCycle)) {
      showToast("Chu kỳ đóng cước Internet không hợp lệ.", "error");
      setUploadingImages(false);
      return;
    }

    if (isInternetCompletionJob && !INTERNET_INSTALL_FEE_OPTIONS.includes(completionInternetInstallFee)) {
      showToast("Phí lắp đặt Internet không hợp lệ.", "error");
      setUploadingImages(false);
      return;
    }

    if (canGiftViettelCamera && !completionGiftCamera) {
      showToast("Còn thiếu mục: Camera Viettel tặng kèm.", "error");
      setUploadingImages(false);
      return;
    }

    if (canGiftViettelCamera && !completionGiftCameraAccountValue) {
      showToast("Còn thiếu mục: Tài khoản camera (SĐT khách hàng). Vui lòng cập nhật SĐT khách trước.", "error");
      setUploadingImages(false);
      return;
    }

    if (canGiftViettelCamera && !completionGiftCameraPassword.trim()) {
      showToast("Còn thiếu mục: Mật khẩu camera.", "error");
      setUploadingImages(false);
      return;
    }

    if (completionAddOnPackageId && !selectedCompletionAddOnPackage) {
      showToast("Gói cước phát sinh không còn khả dụng. Vui lòng chọn lại.", "error");
      setUploadingImages(false);
      return;
    }

    if (selectedCompletionAddOnPackage && !isInternetCompletionJob) {
      showToast("Chỉ chọn thêm gói cước khi hoàn thành việc lắp mới Internet.", "error");
      setUploadingImages(false);
      return;
    }

    if (selectedCompletionAddOnPackage && !completionAddOnCycleOptions.some(option => option.value === completionAddOnCycle)) {
      showToast("Chu kỳ gói cước phát sinh không hợp lệ. Vui lòng chọn lại.", "error");
      setUploadingImages(false);
      return;
    }

    const materialValidation = materialDraftItems.length > 0
      ? validateSalesDraft(job.customer_id || "", materialDraftItems, inventoryProducts)
      : "";

    if (materialValidation) {
      showToast(materialValidation, "error");
      setUploadingImages(false);
      return;
    }

    try {
      // 1. Upload images to Supabase Storage if any are selected
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${file.lastModified}_${file.size}_${i}.${fileExt}`;
        const filePath = `jobs/${job.id}/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error("Không thể tải hình ảnh lên: " + uploadError.message);
        }

        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-photos')
            .getPublicUrl(filePath);
          imageUrls.push(publicUrl);
        }
      }

      if (materialDraftItems.length > 0) {
        const { error: completeWithMaterialsError } = await supabase.rpc("complete_worker_job_with_materials", {
          p_job_id: job.id,
          p_images: imageUrls,
          p_completion_items: cleanedItems,
          p_final_amount: finalAmount,
          p_warranty_days: maxWarrantyDays,
          p_warranty_note: completionWarrantyNote,
          p_material_items: buildSalesRpcItems(materialDraftItems),
        });

        if (completeWithMaterialsError) {
          const fallbackResponse = await fetch("/api/worker/job-completion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: job.id,
              images: imageUrls,
              completionItems: cleanedItems,
              finalAmount,
              warrantyDays: maxWarrantyDays,
              warrantyNote: completionWarrantyNote,
              materialItems: buildSalesRpcItems(materialDraftItems),
            }),
          });
          const fallbackData = await fallbackResponse.json().catch(() => ({}));

          if (!fallbackResponse.ok) {
            throw new Error("Không thể hoàn thành công việc với vật tư: " + (fallbackData.error || completeWithMaterialsError.message));
          }
        }
      }

      // 2. Update job status to completed & save images
      const { data: updatedJobs, error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          images: imageUrls,
          completion_items: cleanedItems,
          final_amount: finalAmount,
          warranty_days: maxWarrantyDays,
          warranty_note: completionWarrantyNote,
          workflow_data: {
            ...(job.workflow_data || {}),
            ...handoverWorkflowData,
            payment: {
              status: completionPaymentStatus,
              totalAmount: finalAmount,
              paidAmount,
              remainingAmount,
              method: completionPaymentMethod,
              note: completionPaymentNote.trim() || null,
              recordedAt: new Date().toISOString(),
            },
            billgo: isInternetCompletionJob && completionInternetMonthlyFeeNumber > 0 ? {
              ...(job.workflow_data?.billgo || {}),
              cycle: completionInternetCycle,
              amount: completionInternetMonthlyFeeNumber,
              startDate: new Date().toISOString().slice(0, 10),
              totalAmount: completionInternetCycleTotal,
              receiptAmount: completionInternetReceiptTotal,
              note: "Cước Internet lắp mới",
            } : job.workflow_data?.billgo,
            internetInstall: isInternetCompletionJob ? {
              installFee: completionInternetInstallFee,
              giftCamera: canGiftViettelCamera ? completionGiftCamera : null,
              giftCameraAccount: canGiftViettelCamera ? completionGiftCameraAccountValue : null,
              giftCameraPassword: canGiftViettelCamera ? completionGiftCameraPassword.trim() : null,
            } : job.workflow_data?.internetInstall,
            billgoAddOn: selectedCompletionAddOnPackage ? {
              packageId: selectedCompletionAddOnPackage.id,
              packageName: selectedCompletionAddOnPackage.name,
              packageType: selectedCompletionAddOnPackage.type,
              monthlyFee: completionAddOnMonthlyFee,
              cycle: completionAddOnCycle,
              subscriptionAmount: completionAddOnTotal,
              totalAmount: completionAddOnGrandTotal,
              totalAmountInWords: readVietnameseMoney(completionAddOnGrandTotal),
              note: completionAddOnNote.trim() || null,
              selectedAt: new Date().toISOString(),
            } : undefined,
          },
        })
        .eq('id', job.id)
        .select();

      if (updateError) {
        throw new Error("Không thể cập nhật trạng thái: " + updateError.message);
      }

      if (!updatedJobs || updatedJobs.length === 0) {
        throw new Error("Cập nhật thất bại. Vui lòng kiểm tra chính sách bảo mật RLS hoặc cấu trúc bảng của dữ liệu.");
      }

      let billGoChanged = false;
      if (addToBillGo || (isInternetCompletionJob && completionInternetMonthlyFeeNumber > 0)) {
        const createdBillGo = await ensureBillGoFromWorkflow(job, isInternetCompletionJob && completionInternetMonthlyFeeNumber > 0 ? {
          cycle: completionInternetCycle,
          amount: completionInternetMonthlyFeeNumber,
          startDate: new Date().toISOString().slice(0, 10),
          packageName: job.serviceName || "Cước Internet",
          packageType: "internet",
          note: "Cước Internet lắp mới",
        } : undefined);
        billGoChanged = Boolean(createdBillGo);
      }

      if (selectedCompletionAddOnPackage) {
        await ensureBillGoAddOnFromCompletion(job);
        billGoChanged = true;
      }

      if (amountToRecord > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            job_id: job.id,
            amount: amountToRecord,
            method: completionPaymentMethod,
            status: "paid",
            paid_at: new Date().toISOString(),
            collected_by: user?.id || null,
            note: completionPaymentNote.trim() || null,
          });

        if (paymentError) {
          throw new Error("Công việc đã hoàn thành nhưng chưa ghi được thanh toán: " + paymentError.message);
        }
      }

      // 3. Optimistic UI update
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      setWorkerStats(prev => ({
        ...prev,
        jobsDone: prev.jobsDone + 1,
        income: prev.income + amountToRecord,
        monthlyCustomers: prev.monthlyCustomers + 1,
        monthlyIncome: prev.monthlyIncome + amountToRecord,
      }));
      if (billGoChanged) {
        void fetchDataRef.current(true);
      }
      showToast("Đã hoàn thành công việc thành công!", "success");
      setActiveJobToComplete(null);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setCompletionItems([]);
      setCompletionHandoverData({});
      setCompletionPaymentAmount("");
      setCompletionPaymentNote("");
      setCompletionInternetInstallFeeInput("300000");
      setCompletionGiftCamera("");
      setCompletionGiftCameraPassword("");
      setCompletionInternetCycle("monthly");
      setCompletionInternetMonthlyFee("");
      setCompletionAddOnPackageId("");
      setCompletionAddOnCycle("monthly");
      setCompletionAddOnNote("");
      setAddToBillGo(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Đã xảy ra lỗi khi hoàn thành công việc.", "error");
      console.error(err);
    } finally {
      setUploadingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check worker status — show pending/blocked screen
  if (worker && (worker.status === 'pending' || worker.status === 'blocked')) {
    return <PendingApproval worker={worker} workerName={(worker as WorkerWithProfile).user?.full_name || 'Thợ'} />;
  }

  const isWorkerAvailable = worker?.is_available !== false;
  const monthlyGoalTargets = monthlyGoal
    ? {
      revenueTarget: Number(monthlyGoal.revenue_target || DEFAULT_WORKER_MONTHLY_GOAL.revenueTarget),
      totalCustomersTarget: Number(monthlyGoal.total_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.totalCustomersTarget),
      newCustomersTarget: Number(monthlyGoal.new_customers_target || DEFAULT_WORKER_MONTHLY_GOAL.newCustomersTarget),
    }
    : {
      revenueTarget: Math.max(0, Number(monthlyGoalDraft.revenueTarget || DEFAULT_WORKER_MONTHLY_GOAL.revenueTarget)),
      totalCustomersTarget: Math.max(0, Number(monthlyGoalDraft.totalCustomersTarget || DEFAULT_WORKER_MONTHLY_GOAL.totalCustomersTarget)),
      newCustomersTarget: Math.max(0, Number(monthlyGoalDraft.newCustomersTarget || DEFAULT_WORKER_MONTHLY_GOAL.newCustomersTarget)),
    };
  const monthlyRevenueTarget = monthlyGoalTargets.revenueTarget || DEFAULT_WORKER_MONTHLY_GOAL.revenueTarget;
  const monthlyTotalCustomerTarget = monthlyGoalTargets.totalCustomersTarget || DEFAULT_WORKER_MONTHLY_GOAL.totalCustomersTarget;
  const monthlyNewCustomerTarget = monthlyGoalTargets.newCustomersTarget || DEFAULT_WORKER_MONTHLY_GOAL.newCustomersTarget;
  const monthlyRevenueProgress = Math.min(100, Math.round((workerStats.monthlyIncome / monthlyRevenueTarget) * 100));
  const totalCustomers = workerStats.monthlyCustomers;
  const monthNewCustomers = workerStats.monthlyNewCustomers;
  const monthlyTotalCustomerProgress = Math.min(100, Math.round((totalCustomers / monthlyTotalCustomerTarget) * 100));
  const monthlyNewCustomerProgress = Math.min(100, Math.round((monthNewCustomers / monthlyNewCustomerTarget) * 100));
  const returningCustomers = Math.max(totalCustomers - monthNewCustomers, 0);
  const showMonthlyGoalDetails = monthlyGoalExpanded || monthlyGoalFormOpen || Boolean(monthlyGoalError);
  const mobileDashboardJobs = [...newJobs, ...pendingApprovalJobs, ...activeJobs];
  const mobileTodoJobs = filterWorkerDashboardJobs(mobileDashboardJobs, "todo");
  const mobileTodayBacklogJobs = filterWorkerDashboardJobs(mobileDashboardJobs, "today");
  const mobileMonthBacklogJobs = filterWorkerDashboardJobs(mobileDashboardJobs, "month");
  const mobileTodoCount = mobileTodoJobs.length;
  const mobileTodayBacklogCount = mobileTodayBacklogJobs.length;
  const mobileMonthBacklogCount = mobileMonthBacklogJobs.length;
  const mobileGoalOffset = 100 - monthlyRevenueProgress;
  const mobilePriorityJobs = sortJobsNewestFirst(mobileDashboardJobs).slice(0, mobileTodoCount > MOBILE_FEW_JOBS_THRESHOLD ? 2 : 1);
  const showMobilePriorityJobs = mobileTodoCount > MOBILE_FEW_JOBS_THRESHOLD && mobilePriorityJobs.length > 0;
  const mobileJobsByFilter: Record<WorkerDashboardJobFilter, WorkerJob[]> = {
    todo: mobileTodoJobs,
    today: mobileTodayBacklogJobs,
    month: mobileMonthBacklogJobs,
  };
  const mobileJobFilterLabels: Record<WorkerDashboardJobFilter, string> = {
    todo: "Cần làm",
    today: "Tồn hôm nay",
    month: "Tồn tháng",
  };
  const expandedMobileJobs = expandedMobileJobFilter ? sortJobsNewestFirst(mobileJobsByFilter[expandedMobileJobFilter]) : [];

  return (
    <div className="flex flex-col w-full relative">
      <div className="py-3">
        <CmsPlacement location="featured_notice" variant="banner" limit={1} />
      </div>
      <CmsPlacement location="popup" variant="popup" limit={1} />
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md rounded-xl border px-4 py-3 shadow-lg animate-fade-in ${toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' :
          toast.type === 'error' ? 'bg-error-container text-on-error-container border-error/30' :
            'bg-surface-container-high text-on-surface border-outline-variant'
          }`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' ? <CheckCircleIcon size={20} /> :
                toast.type === 'error' ? <XIcon size={20} /> :
                  <BellIcon size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold leading-tight">{toast.message}</p>
              {(toast.customerLogin || toast.customerPassword) && (
                <div className="mt-3 rounded-lg border border-success/25 bg-white/80 p-3 text-on-surface shadow-sm">
                  {toast.customerLogin && (
                    <>
                      <div className="text-[10px] font-bold uppercase text-on-surface-variant">Tài khoản khách</div>
                      <div className="mt-1 break-all font-mono text-sm font-extrabold text-primary-container">
                        {toast.customerLogin}
                      </div>
                    </>
                  )}
                  <div className="text-[10px] font-bold uppercase text-on-surface-variant">Mật khẩu khách</div>
                  <div className="mt-1 break-all font-mono text-lg font-extrabold text-primary-container">
                    {toast.customerPassword}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="shrink-0 rounded-lg p-1.5 text-current/70 transition-colors hover:bg-white/50 hover:text-current"
              aria-label="Đóng thông báo"
              title="Đóng thông báo"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}


      <section className="relative z-10 -mt-6 space-y-4 px-3 pb-2 md:hidden">
        <div className="rounded-xl border border-primary/10 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                <ZapIcon size={22} />
              </span>
              <h1 className="truncate text-xl font-extrabold text-on-surface">Mục tiêu tháng</h1>
            </div>
            <button
              type="button"
              onClick={() => setMonthlyGoalExpanded(current => !current)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-primary"
            >
              Xem chi tiết
              <ChevronRightIcon size={16} />
            </button>
          </div>

          <div className="grid grid-cols-[6.75rem_1fr] items-center gap-3 min-[390px]:grid-cols-[7.25rem_1fr]">
            <div className="relative mx-auto h-24 w-24 min-[390px]:h-28 min-[390px]:w-28">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgb(219 234 254)" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="rgb(37 99 235)"
                  strokeLinecap="round"
                  strokeWidth="12"
                  strokeDasharray="314"
                  strokeDashoffset={String((mobileGoalOffset / 100) * 314)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <strong className="text-2xl leading-none text-on-surface min-[390px]:text-3xl">{monthlyRevenueProgress}%</strong>
                <span className="mt-1 text-[11px] font-bold text-on-surface-variant">Đã hoàn thành</span>
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-outline-variant/50 bg-primary-fixed/35 p-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-on-surface">
                <DollarSignIcon size={18} className="text-primary" />
                Doanh thu tháng
              </div>
              <p className="mt-2 truncate text-xl font-extrabold text-on-surface min-[390px]:text-2xl">{formatBillGoCurrency(workerStats.monthlyIncome)}</p>
              <div className="progress mt-3 h-2">
                <div className="progress-bar" style={{ width: monthlyRevenueProgress + "%" }} />
              </div>
              {showMonthlyGoalDetails && (
                <p className="mt-2 truncate text-xs font-bold text-on-surface-variant">Mục tiêu: {formatBillGoCurrency(monthlyRevenueTarget)}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Cần làm", value: mobileTodoCount, tone: "error", icon: BellIcon, filter: "todo" as WorkerDashboardJobFilter },
            { label: "Tồn hôm nay", value: mobileTodayBacklogCount, tone: "warning", icon: CalendarIcon, filter: "today" as WorkerDashboardJobFilter },
            { label: "Tồn tháng", value: mobileMonthBacklogCount, tone: "primary", icon: CalendarIcon, filter: "month" as WorkerDashboardJobFilter },
          ].map(item => {
            const Icon = item.icon;
            const toneClass = item.tone === "error"
              ? "border-error/30 bg-error-container/45 text-error"
              : item.tone === "warning"
                ? "border-warning/30 bg-warning-container/45 text-warning"
                : "border-primary/30 bg-primary-fixed/65 text-primary";

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setExpandedMobileJobFilter(current => current === item.filter ? null : item.filter)}
                aria-expanded={expandedMobileJobFilter === item.filter}
                aria-controls="mobile-dashboard-job-list"
                aria-label={(expandedMobileJobFilter === item.filter ? "Thu gọn " : "Hiển thị ") + item.label}
                data-dashboard-job-count={item.value}
                data-dashboard-job-filter={item.filter}
                className={"block min-h-32 w-full rounded-xl border p-2.5 text-left shadow-sm transition-all active:scale-[0.98] min-[390px]:p-3 " + toneClass + (expandedMobileJobFilter === item.filter ? " ring-2 ring-primary/35" : "")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70">
                    <Icon size={20} />
                  </span>
                  <ChevronRightIcon size={18} className={"rounded-full bg-white/80 p-0.5 text-on-surface-variant shadow-sm transition-transform " + (expandedMobileJobFilter === item.filter ? "rotate-90 text-primary" : "")} />
                </div>
                <p className="mt-2 text-xs font-extrabold uppercase leading-tight">{item.label}</p>
                <p className="mt-1 text-4xl font-extrabold leading-none min-[390px]:text-5xl">{item.value}</p>
                <p className="mt-1 text-base font-extrabold leading-none">việc</p>
              </button>
            );
          })}
        </div>

        {expandedMobileJobFilter && (
          <div
            id="mobile-dashboard-job-list"
            data-dashboard-inline-filter={expandedMobileJobFilter}
            data-dashboard-inline-count={expandedMobileJobs.length}
            className="overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase text-on-surface-variant">Danh sách công việc</p>
                <h2 className="truncate text-base font-extrabold text-on-surface">{mobileJobFilterLabels[expandedMobileJobFilter]}</h2>
              </div>
              <span className="shrink-0 rounded-full bg-primary-fixed px-3 py-1 text-xs font-extrabold text-primary-container">{expandedMobileJobs.length} việc</span>
            </div>
            {expandedMobileJobs.length > 0 ? (
              <div className="divide-y divide-outline-variant/40">
                {expandedMobileJobs.map(job => {
                  const isNewJob = newJobs.some(item => item.id === job.id);
                  const isPendingJob = pendingApprovalJobs.some(item => item.id === job.id);
                  const statusLabel = isNewJob ? "Mới" : isPendingJob ? "Chờ duyệt" : job.status === "in_progress" ? "Đang làm" : "Đã nhận";
                  const statusClass = isNewJob ? "bg-error text-white" : isPendingJob ? "bg-warning text-white" : "bg-primary-fixed text-primary";

                  return (
                    <Link
                      key={job.id}
                      href={`/worker/history/${job.id}`}
                      data-dashboard-inline-job
                      className="block px-3 py-3 transition-colors active:bg-surface-container-low"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex min-w-0 items-center gap-2">
                            <span className={"shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase " + statusClass}>{statusLabel}</span>
                            <span className="truncate text-[11px] font-bold text-on-surface-variant">{getUnworkedAgeLabel(job)}</span>
                          </div>
                          <h3 className="line-clamp-2 text-sm font-extrabold leading-tight text-on-surface">{job.serviceName || job.description || job.job_code}</h3>
                          <p className="mt-1 truncate text-xs font-bold text-on-surface-variant">{job.customerName || job.job_code}</p>
                          <div className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-on-surface-variant">
                            <MapPinIcon size={13} className="mt-0.5 shrink-0 text-primary" />
                            <span className="line-clamp-1">{job.address || "Chưa có địa chỉ"}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                          <strong className="max-w-[6.8rem] truncate text-sm text-error">{job.price || formatCurrency(Number(job.quoted_price || 0))}</strong>
                          <ChevronRightIcon size={18} className="text-on-surface-variant" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div data-dashboard-inline-empty className="px-4 py-6 text-center text-sm font-bold text-on-surface-variant">
                Chưa có công việc phù hợp.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Monthly Goal */}
      <section className="hidden px-3 pt-3 md:block sm:px-6 sm:pt-4 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-primary/10 bg-white shadow-sm sm:rounded-xl">
          <div className="hero-gradient px-4 py-3 text-white sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-white/75">{statPeriodLabels.month}</p>
                <h1 className="mt-0.5 text-xl font-extrabold leading-tight text-primary-fixed sm:mt-1 sm:text-2xl">Mục tiêu tháng</h1>
                <p className="mt-2 hidden max-w-xl text-sm leading-6 text-white/80 sm:block">
                  Theo dõi doanh thu, khách hàng và tiến độ trong tháng hiện tại.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={availabilitySaving}
                className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold shadow-sm transition-all active:scale-95 disabled:cursor-wait disabled:opacity-70 ${
                  isWorkerAvailable
                    ? "bg-white/95 text-success"
                    : "bg-white/80 text-on-surface-variant"
                }`}
                aria-pressed={isWorkerAvailable}
                title={isWorkerAvailable ? "Bấm để chuyển Offline" : "Bấm để chuyển Online"}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${isWorkerAvailable ? "animate-pulse bg-success" : "bg-outline-variant"}`} />
                {availabilitySaving ? "Đang lưu..." : isWorkerAvailable ? "Online" : "Offline"}
              </button>
            </div>
          </div>

          <div className="space-y-3 p-3 sm:space-y-5 sm:p-6">
            {(monthlyGoalFormOpen || monthlyGoalError) && (
              <div className="rounded-lg border border-primary-container/20 bg-primary-fixed/35 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-on-surface">Đặt mục tiêu tháng này</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Gợi ý tự lấy từ tháng trước, nếu chưa có sẽ là 20 triệu, 40 khách, 10 khách mới.
                    </p>
                  </div>
                  {monthlyGoal?.skipped && (
                    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-container">
                      Đã bỏ qua
                    </span>
                  )}
                </div>
                {monthlyGoalError && (
                  <div className="mt-3 rounded-lg border border-error/20 bg-error-container p-3 text-sm font-bold text-error">
                    {monthlyGoalError}
                  </div>
                )}
                {monthlyGoalFormOpen && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <label className="grid gap-1.5 text-xs font-bold uppercase text-on-surface-variant">
                      Doanh thu
                      <input
                        type="number"
                        min="0"
                        className="input-field !py-2.5"
                        value={monthlyGoalDraft.revenueTarget}
                        onChange={event => setMonthlyGoalDraft(current => ({ ...current, revenueTarget: event.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase text-on-surface-variant">
                      Tổng khách phục vụ
                      <input
                        type="number"
                        min="0"
                        className="input-field !py-2.5"
                        value={monthlyGoalDraft.totalCustomersTarget}
                        onChange={event => setMonthlyGoalDraft(current => ({ ...current, totalCustomersTarget: event.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-bold uppercase text-on-surface-variant">
                      Khách mới
                      <input
                        type="number"
                        min="0"
                        className="input-field !py-2.5"
                        value={monthlyGoalDraft.newCustomersTarget}
                        onChange={event => setMonthlyGoalDraft(current => ({ ...current, newCustomersTarget: event.target.value }))}
                      />
                    </label>
                    <div className="grid gap-2 self-end sm:grid-cols-2 lg:min-w-48 lg:grid-cols-1">
                      <button
                        type="button"
                        disabled={monthlyGoalSaving}
                        onClick={() => void saveWorkerMonthlyGoal(false)}
                        className="btn-primary !min-h-0 !py-2.5"
                      >
                        {monthlyGoalSaving ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button
                        type="button"
                        disabled={monthlyGoalSaving}
                        onClick={() => void saveWorkerMonthlyGoal(true)}
                        className="btn-outline !min-h-0 !py-2.5"
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sm:hidden">
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ["Doanh thu", monthlyRevenueProgress, formatBillGoCurrency(workerStats.monthlyIncome), formatBillGoCurrency(monthlyRevenueTarget)],
                  ["T\u1ed5ng kh\u00e1ch", monthlyTotalCustomerProgress, String(totalCustomers), String(monthlyTotalCustomerTarget)],
                  ["Kh\u00e1ch m\u1edbi", monthlyNewCustomerProgress, String(monthNewCustomers), String(monthlyNewCustomerTarget)],
                ].map(([label, progress, current, target]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMonthlyGoalExpanded(true)}
                    className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-left"
                    title={`${label}: ${current} / ${target}`}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <span className="min-w-0 truncate text-[10px] font-bold uppercase leading-none text-on-surface-variant">{label}</span>
                      <span className="shrink-0 text-[11px] font-extrabold leading-none text-primary-container">{progress}%</span>
                    </div>
                    <div className="progress mt-1.5 h-1.5">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    {showMonthlyGoalDetails && (
                      <p className="mt-1 truncate text-[10px] font-bold leading-none text-on-surface-variant">{current} / {target}</p>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMonthlyGoalExpanded(current => !current)}
                className="mt-1.5 w-full rounded-lg border border-primary-container/25 bg-primary-fixed px-3 py-1.5 text-[11px] font-extrabold text-primary-container"
              >
                {showMonthlyGoalDetails ? "Thu g\u1ecdn" : "Xem th\u00eam"}
              </button>
            </div>

            <div className={`${showMonthlyGoalDetails ? "grid" : "hidden"} grid-cols-3 gap-2 sm:grid sm:gap-3`}>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">Doanh thu</p>
                <p className="mt-1 truncate text-sm font-extrabold text-primary-container sm:text-2xl">{formatBillGoCurrency(workerStats.monthlyIncome)}</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">Chỉ tiêu</p>
                <p className="mt-1 truncate text-sm font-extrabold text-on-surface sm:text-2xl">{formatBillGoCurrency(monthlyRevenueTarget)}</p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">Trạng thái</p>
                <p className="mt-1 truncate text-sm font-extrabold text-success sm:text-2xl">{monthlyGoal?.skipped ? "Đã bỏ qua" : monthlyGoal ? "Đã đặt" : "Gợi ý"}</p>
                <button
                  type="button"
                  onClick={() => setMonthlyGoalFormOpen(true)}
                  className="mt-1 text-[11px] font-bold text-primary-container hover:underline sm:mt-2 sm:text-xs"
                >
                  Chỉnh lại
                </button>
              </div>
            </div>

            <div className="hidden space-y-4 sm:block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-on-surface-variant">Tiến độ doanh thu</span>
                <span className="text-sm font-extrabold text-primary-container">{monthlyRevenueProgress}%</span>
              </div>
              <div className="progress h-3">
                <div className="progress-bar" style={{ width: `${monthlyRevenueProgress}%` }} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase text-on-surface-variant">Tổng khách <span className="font-extrabold text-on-surface">({totalCustomers}/{monthlyTotalCustomerTarget})</span></span>
                    <span className="text-sm font-extrabold text-primary-container">{monthlyTotalCustomerProgress}%</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${monthlyTotalCustomerProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase text-on-surface-variant">Khách mới <span className="font-extrabold text-on-surface">({monthNewCustomers}/{monthlyNewCustomerTarget})</span></span>
                    <span className="text-sm font-extrabold text-primary-container">{monthlyNewCustomerProgress}%</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${monthlyNewCustomerProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-3 gap-2 sm:grid">
              <div className="rounded-lg bg-primary-fixed p-3 text-center">
                <p className="text-xl font-extrabold text-primary-container">{monthNewCustomers}</p>
                <p className="mt-1 text-[10px] font-bold uppercase text-primary-container/75">Khách mới / {monthlyNewCustomerTarget}</p>
              </div>
              <div className="rounded-lg bg-surface-container p-3 text-center">
                <p className="text-xl font-extrabold text-on-surface">{returningCustomers}</p>
                <p className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant">Khách cũ</p>
              </div>
              <div className="rounded-lg bg-secondary-fixed p-3 text-center">
                <p className="text-xl font-extrabold text-primary">{totalCustomers}</p>
                <p className="mt-1 text-[10px] font-bold uppercase text-primary/75">Tổng khách / {monthlyTotalCustomerTarget}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="hidden px-4 pt-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
          <div className="hero-gradient px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-white/75">Bảng điều khiển thợ</p>
                <h1 className="mt-1 text-2xl font-extrabold leading-tight drop-shadow-sm text-primary-fixed">
                  {isWorkerAvailable ? "Sẵn sàng nhận việc" : "Đang nghỉ nhận việc"}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                  {isWorkerAvailable
                    ? "Theo dõi việc mới, việc đang làm và tạo đơn nhanh cho khách quen."
                    : "Bạn đang Offline nên hệ thống tạm ẩn việc mới để bạn nghỉ ngơi."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={availabilitySaving}
                className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold shadow-sm transition-all active:scale-95 disabled:cursor-wait disabled:opacity-70 ${
                  isWorkerAvailable
                    ? "bg-white/95 text-success"
                    : "bg-white/80 text-on-surface-variant"
                }`}
                aria-pressed={isWorkerAvailable}
                title={isWorkerAvailable ? "Bấm để chuyển Offline" : "Bấm để chuyển Online"}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${isWorkerAvailable ? "animate-pulse bg-success" : "bg-outline-variant"}`} />
                {availabilitySaving ? "Đang lưu..." : isWorkerAvailable ? "Online" : "Offline"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-outline-variant/30 bg-white">
            <div className="px-3 py-4 text-center">
              <div className="text-2xl font-extrabold text-on-surface sm:text-3xl">{workerStats.jobsDone}</div>
              <div className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant">Khách hàng</div>
              <div className="mt-2 space-y-0.5 text-[11px] font-extrabold leading-4 text-primary-container">
                <p>{statPeriodLabels.month}: {workerStats.monthlyCustomers}</p>
                <p className="text-on-surface-variant">{statPeriodLabels.today}: {workerStats.todayCustomers}</p>
              </div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-on-surface sm:text-3xl">
                {workerStats.rating}
                <StarIcon size={16} className="fill-current text-warning" />
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant">Đánh giá</div>
              <div className="mt-2 space-y-0.5 text-[11px] font-extrabold leading-4 text-primary-container">
                <p>{statPeriodLabels.month}: {workerStats.monthlyRating > 0 ? workerStats.monthlyRating : "0"}★</p>
                <p className="text-on-surface-variant">{statPeriodLabels.today}: {workerStats.todayRating > 0 ? workerStats.todayRating : "0"}★</p>
              </div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-xl font-extrabold leading-9 text-primary-container sm:text-2xl">
                {formatCompactCurrency(workerStats.income)}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase text-on-surface-variant">Tổng tiền</div>
              <div className="mt-2 space-y-0.5 text-[11px] font-extrabold leading-4 text-primary-container">
                <p>{statPeriodLabels.month}: {formatCompactCurrency(workerStats.monthlyIncome)}</p>
                <p className="text-on-surface-variant">{statPeriodLabels.today}: {formatCompactCurrency(workerStats.todayIncome)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="space-y-3 px-3 pb-2 md:hidden">
        {showMobilePriorityJobs ? (
          <div className="rounded-xl border border-outline-variant/40 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ZapIcon size={24} className="shrink-0 fill-current text-error" />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold text-on-surface">Việc ưu tiên</h2>
                  <p className="text-xs font-bold text-on-surface-variant">Cần làm ngay</p>
                </div>
              </div>
              <button type="button" onClick={() => setTab("active")} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-primary">
                Xem tất cả
                <ChevronRightIcon size={16} />
              </button>
            </div>
            <div className="divide-y divide-outline-variant/40">
              {mobilePriorityJobs.map(job => {
                const isNewJob = newJobs.some(item => item.id === job.id);
                const isPendingJob = pendingApprovalJobs.some(item => item.id === job.id);
                const canCall = Boolean(job.customer?.phone);
                return (
                  <article key={job.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={"rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase " + (isNewJob ? "bg-error text-white" : isPendingJob ? "bg-warning text-white" : "bg-primary-fixed text-primary")}>{isNewJob ? "Mới" : isPendingJob ? "Chờ duyệt" : "Đã nhận"}</span>
                        <span className="truncate text-[11px] font-bold text-on-surface-variant">{getUnworkedAgeLabel(job)}</span>
                      </div>
                      <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-on-surface">{job.serviceName || job.description || job.job_code}</h3>
                      <p className="mt-1 truncate text-xs font-bold text-on-surface-variant">{job.customerName || job.job_code}</p>
                      <div className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-on-surface-variant"><MapPinIcon size={13} className="mt-0.5 shrink-0 text-primary" /><span className="line-clamp-1">{job.address || "Chưa có địa chỉ"}</span></div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-error"><ClockIcon size={13} /><span>{job.time || "Chưa hẹn giờ"}</span></div>
                    </div>
                    <div className="flex min-w-[6rem] flex-col items-end justify-between gap-2 text-right min-[390px]:min-w-[6.8rem]">
                      <strong className="max-w-[6.8rem] truncate text-sm text-error min-[390px]:text-base">{job.price || formatCurrency(Number(job.quoted_price || 0))}</strong>
                      <div className="flex items-center gap-2">
                        {canCall && <a href={"tel:" + job.customer?.phone} className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-white text-primary shadow-sm" aria-label="Gọi khách"><PhoneIcon size={18} /></a>}
                        {isNewJob ? <button type="button" onClick={() => handleAcceptJob(job.id)} className="rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-white shadow-sm">Nhận</button> : isPendingJob ? <button type="button" onClick={() => setTab("pending")} className="rounded-lg border border-warning/30 bg-warning-container px-3 py-2 text-xs font-extrabold text-warning">Xem</button> : <button type="button" onClick={() => openDirections(job)} className="rounded-lg bg-primary px-3 py-2 text-xs font-extrabold text-white shadow-sm">Đi ngay</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant/40 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-container text-success"><CheckCircleIcon size={42} /></div>
            <h2 className="mt-3 text-lg font-extrabold text-on-surface">Hôm nay bạn không có việc cần làm!</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-on-surface-variant">Hãy tạo việc mới để phục vụ khách hàng nhé.</p>
            <button type="button" onClick={() => setQuickFormOpen(true)} className="mt-4 flex w-full items-center justify-between rounded-full bg-primary px-4 py-3 text-left text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]"><span className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-primary"><PlusIcon size={28} /></span><span><span className="block text-base font-extrabold leading-tight">Tạo việc nhanh</span><span className="block text-xs font-semibold text-white/80">Khách quen · Khách mới</span></span></span><ChevronRightIcon size={24} /></button>
          </div>
        )}
        {billGoTotals.debtItems > 0 && <Link href="/worker/billgo" className="flex items-center justify-between rounded-xl border border-success/15 bg-success-container/55 px-4 py-3 text-success shadow-sm"><span className="flex min-w-0 items-center gap-3"><DollarSignIcon size={22} className="shrink-0" /><span className="truncate text-xs font-extrabold uppercase">Khách BillGo cần thu hôm nay</span></span><span className="shrink-0 text-base font-extrabold">{billGoTotals.debtItems} khách</span></Link>}
      </section>

      {/* Quick Job Creation */}
      <section id="worker-quick-job" className="scroll-mt-24 px-3 py-3 sm:px-6 md:py-4 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-primary-container/35 bg-primary p-0 text-white shadow-[0_14px_34px_rgba(37,99,235,0.22)] ring-1 ring-white/70 md:p-4">
          <button
            type="button"
            onClick={() => setQuickFormOpen(open => !open)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left md:p-0"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-md shadow-cyan-900/15 ring-2 ring-white md:h-12 md:w-12 md:rounded-lg md:bg-white md:text-primary">
                <PlusIcon size={30} strokeWidth={2.6} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold leading-tight text-white">Tạo việc nhanh</h2>
                <p className="mt-1 text-sm font-semibold leading-5 text-white/85">
                  Tạo việc mới cho khách hàng
                </p>
              </div>
            </div>
            <ChevronRightIcon
              size={22}
              strokeWidth={2.5}
              className={`shrink-0 rounded-full bg-white/95 p-1 text-primary shadow-sm transition-transform ${quickFormOpen ? "rotate-90" : ""}`}
            />
          </button>

          {quickFormOpen && (
            <form onSubmit={handleCreateQuickJob} className="worker-quick-job-surface m-3 mt-0 space-y-3 rounded-lg border border-primary-container/15 bg-white p-3 text-on-surface shadow-sm md:m-0 md:mt-4 md:bg-white/85">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Tên khách hàng
                </label>
                <input
                  value={quickJob.customerName}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, customerId: "", customerName: e.target.value }))}
                  placeholder="Gõ tên khách, chọn nếu đã có hoặc nhập mới"
                  className="input-field !py-2.5"
                />
                {quickJob.customerName.trim() && !quickJob.customerId && quickCustomerResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-outline-variant/40 bg-white shadow-sm">
                    {quickCustomerResults.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectQuickCustomer(customer)}
                        className="block w-full border-b border-outline-variant/20 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-container-low"
                      >
                        <span className="font-bold text-on-surface">{customer.name}</span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">
                          {[customer.phone, customer.account ? `Account ${customer.account}` : "", customer.address].filter(Boolean).join(" • ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {quickJob.customerId && (
                  <div className="rounded-lg bg-success-container px-3 py-2 text-xs font-bold text-success">
                    Đang dùng khách đã có: {quickJob.customerName}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  SĐT khách quen
                </label>
                <input
                  type="tel"
                  value={quickJob.customerPhone}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, customerId: "", customerPhone: e.target.value }))}
                  placeholder="VD: 0912345678"
                  className="input-field !py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Dịch vụ
                  </label>
                  <select
                    value={quickJob.serviceId}
                    onChange={(e) => handleQuickServiceChange(e.target.value)}
                    className="hidden"
                    disabled={services.length === 0}
                  >
                    <option value="">
                      {services.length === 0 ? "Chưa có dịch vụ khả dụng" : "Chọn dịch vụ"}
                    </option>
                    {quickServiceGroups.map(group => (
                      <optgroup key={group.parent.id} label={group.parent.name}>
                        {group.services.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {services.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-outline-variant/70 bg-surface-container-low px-3 py-4 text-sm font-semibold text-on-surface-variant">
                      Chưa có dịch vụ khả dụng
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                          Tìm nhanh dịch vụ
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="search"
                            value={quickServiceSearch}
                            onChange={(e) => setQuickServiceSearch(e.target.value)}
                            placeholder="Gõ tên dịch vụ: camera, internet, máy lạnh..."
                            className="input-field min-w-0 flex-1 !py-2.5"
                          />
                          {quickServiceSearch && (
                            <button
                              type="button"
                              onClick={() => setQuickServiceSearch("")}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-outline-variant/50 bg-white text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container"
                              aria-label="Xóa tìm kiếm dịch vụ"
                            >
                              <XIcon size={18} />
                            </button>
                          )}
                        </div>

                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {!quickServiceSearch.trim() ? (
                            <div className="rounded-lg border border-dashed border-outline-variant/60 bg-white px-3 py-4 text-sm font-semibold text-on-surface-variant">
                              Gõ vài chữ để tìm nhanh trong danh mục dịch vụ
                            </div>
                          ) : quickServiceSearchResults.length > 0 ? (
                            quickServiceSearchResults.map(service => {
                              const isSelected = quickJob.serviceIds.includes(service.id);
                              return (
                                <button
                                  key={`search-${service.id}`}
                                  type="button"
                                  onClick={() => handleQuickServiceSuggestionClick(service)}
                                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
                                    isSelected
                                      ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                      : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                  }`}
                                >
                                  <span className="block text-sm font-extrabold leading-5">{service.name}</span>
                                  <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                    {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-dashed border-outline-variant/60 bg-white px-3 py-4 text-sm font-semibold text-on-surface-variant">
                              Không tìm thấy dịch vụ phù hợp
                            </div>
                          )}
                        </div>
                      </div>

                    <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
                      {quickSuggestedServices.length > 0 && (
                        <div className="rounded-lg border border-secondary-container/20 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-sm font-extrabold text-on-surface">Việc dùng gần đây</p>
                            <span className="rounded-full bg-secondary-container/10 px-2.5 py-1 text-[10px] font-extrabold text-secondary-container">
                              Chọn nhanh
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {quickSuggestedServices.map(service => {
                              const isSelected = quickJob.serviceIds.includes(service.id);
                              return (
                                <button
                                  key={`suggested-${service.id}`}
                                  type="button"
                                  onClick={() => handleQuickServiceChange(service.id)}
                                  className={`min-h-[64px] rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                                    isSelected
                                      ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                      : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                  }`}
                                >
                                  <span className="block text-base font-extrabold leading-5">{service.name}</span>
                                  <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                    {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {quickServiceGroups.map(group => {
                          const isOpen = expandedQuickServiceGroup === group.category.id;
                          const hasSelectedService = group.services.some(service => quickJob.serviceIds.includes(service.id));

                          return (
                            <div key={group.parent.id} className="rounded-lg border border-outline-variant/30 bg-white">
                              <button
                                type="button"
                                onClick={() => setExpandedQuickServiceGroup(isOpen ? "" : group.category.id)}
                                className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                                  hasSelectedService ? "bg-secondary-container/10 text-secondary-container" : "text-on-surface hover:bg-surface-container-low"
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-base font-extrabold">{group.parent.name}</span>
                                  <span className="mt-0.5 block text-xs font-semibold text-on-surface-variant">
                                    {group.services.length} mục công việc
                                  </span>
                                </span>
                                <ChevronRightIcon
                                  size={18}
                                  className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                                />
                              </button>

                              {isOpen && (
                                <div className="space-y-3 border-t border-outline-variant/30 p-2">
                                  {group.directServices.length > 0 && (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {group.directServices.map(service => {
                                    const isSelected = quickJob.serviceIds.includes(service.id);
                                    return (
                                      <button
                                        key={service.id}
                                        type="button"
                                        onClick={() => handleQuickServiceChange(service.id)}
                                        className={`min-h-[64px] rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                                          isSelected
                                            ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                            : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                        }`}
                                      >
                                        <span className="block text-base font-extrabold leading-5">{service.name}</span>
                                        <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                          {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                        </span>
                                      </button>
                                    );
                                      })}
                                    </div>
                                  )}

                                  {group.childGroups.map(({ child, services: childServices }) => (
                                    <section key={child.id} className="space-y-2">
                                      <div className="flex items-center justify-between gap-2 px-1">
                                        <h4 className="text-sm font-extrabold text-on-surface">{child.name}</h4>
                                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-extrabold text-on-surface-variant">
                                          {childServices.length} dịch vụ
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {childServices.map(service => {
                                          const isSelected = quickJob.serviceIds.includes(service.id);
                                          return (
                                            <button
                                              key={service.id}
                                              type="button"
                                              onClick={() => handleQuickServiceChange(service.id)}
                                              className={`min-h-[64px] rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                                                isSelected
                                                  ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                                  : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                              }`}
                                            >
                                              <span className="block text-base font-extrabold leading-5">{service.name}</span>
                                              <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                                {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </section>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  )}
                  {selectedQuickServices.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-lg border border-secondary-container/20 bg-secondary-container/10 p-2">
                      {selectedQuickServices.map(service => (
                        <span key={service.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-secondary-container">
                          {getQuickServicePathLabel(service, services)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <DynamicServiceWorkflowForm
                  services={selectedQuickServices}
                  value={quickWorkflowData}
                  onChange={setQuickWorkflowData}
                  excludeSectionKeys={handoverWorkflowSectionKeys}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Giá thỏa thuận
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={quickJob.quotedPrice}
                    onChange={(e) => setQuickJob(prev => ({ ...prev, quotedPrice: e.target.value }))}
                    placeholder="VD: 200000"
                    className="input-field !py-2.5"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Địa chỉ làm việc
                </label>
                <input
                  value={quickJob.address}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Nhập địa chỉ thực tế"
                  className="input-field !py-2.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Thời gian hẹn
                </label>
                <input
                  type="datetime-local"
                  value={quickJob.scheduledAt}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  className="input-field !py-2.5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Mô tả việc cần làm
                </label>
                <textarea
                  value={quickJob.description}
                  onChange={(e) => setQuickJob(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ghi chú nhanh tình trạng, yêu cầu, vật tư..."
                  className="input-field min-h-20 resize-none !py-2.5"
                />
              </div>

              <button
                type="submit"
                disabled={creatingQuickJob || services.length === 0}
                className="btn-secondary w-full !min-h-12 !py-3.5 text-base font-extrabold shadow-lg shadow-cyan-900/15"
              >
                {creatingQuickJob ? "Đang tạo..." : "Tạo việc ngay"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Redesigned Worker Feed */}
      <div className="hidden space-y-5 p-4 sm:px-6 lg:px-8">
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="section-eyebrow">Công việc hôm nay</p>
              <h2 className="text-xl font-extrabold text-on-surface">Việc mới và chờ duyệt</h2>
            </div>
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-extrabold text-primary-container">
              {newJobs.length + pendingApprovalJobs.length}
            </span>
          </div>

          {newJobs.length > 0 || pendingApprovalJobs.length > 0 ? (
            <div className="grid gap-3">
              {newJobs.map(job => {
                const JobIcon = job.icon || BriefcaseIcon;
                return (
                  <div key={job.id} className="overflow-hidden rounded-xl border border-primary/15 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 bg-primary-fixed/45 px-4 py-3">
                      <span className="text-[10px] font-extrabold uppercase text-primary-container">Việc mới quanh bạn</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-error shadow-sm">{getUnworkedAgeLabel(job)}</span>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm">
                            <JobIcon size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-bold text-on-surface">{job.serviceName}</div>
                            <div className="text-label-sm text-on-surface-variant">{job.customerName || job.job_code}</div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-base font-bold text-primary-container">{job.price}</div>
                      </div>
                      <div className="grid gap-2 rounded-lg bg-surface-container-low p-3">
                        <div className="flex items-start gap-2 text-on-surface-variant">
                          <MapPinIcon size={15} className="mt-1 shrink-0 text-primary-container" />
                          <span className="min-w-0 flex-1 text-body-sm leading-6">{job.address || "Chưa cung cấp địa chỉ"}</span>
                          <button
                            type="button"
                            onClick={() => openDirections(job)}
                            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase text-primary-container shadow-sm transition-colors hover:bg-primary-container hover:text-white"
                          >
                            Chỉ đường
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <ClockIcon size={15} className="text-primary-container" />
                          <span className="text-body-sm">Hẹn lúc: {job.time}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_1.7fr] gap-3">
                        <button
                          onClick={() => handleDeclineJob(job.id)}
                          className="rounded-lg border border-error/25 bg-error-container px-4 py-3 text-sm font-extrabold text-error transition-all hover:bg-error hover:text-white active:scale-[0.98]"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => handleAcceptJob(job.id)}
                          className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-primary active:scale-[0.98]"
                        >
                          Nhận việc
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {pendingApprovalJobs.map(job => (
                <div key={job.id} className="overflow-hidden rounded-xl border border-warning/25 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-warning/20 bg-warning-container/80 px-4 py-3">
                    <span className="badge badge-pending uppercase text-[10px]">Chờ admin duyệt</span>
                    <span className="font-mono text-xs font-bold text-warning">{job.job_code}</span>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-extrabold text-on-surface">{job.customerName}</h3>
                        <p className="text-body-sm text-on-surface-variant">{job.serviceName}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container px-3 py-2 text-right text-xs font-bold text-on-surface-variant">{job.time}</div>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-label-sm text-on-surface-variant">
                      <MapPinIcon size={14} className="mt-0.5 shrink-0 text-primary-container" />
                      <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-12 text-center">
              <BriefcaseIcon size={32} className="mx-auto mb-3 text-on-surface-variant" />
              <p className="text-base font-bold text-on-surface">{isWorkerAvailable ? "Chưa có công việc hôm nay" : "Bạn đang Offline"}</p>
              <p className="text-body-sm text-on-surface-variant">
                {isWorkerAvailable ? "Việc mới và việc chờ duyệt sẽ hiển thị tại đây." : "Bật Online ở mục tiêu tháng để tiếp tục nhận việc."}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="section-eyebrow">Đang thực hiện</p>
              <h2 className="text-xl font-extrabold text-on-surface">Việc đã nhận</h2>
            </div>
            <span className="rounded-full bg-success-container px-3 py-1 text-xs font-extrabold text-success">{activeJobs.length}</span>
          </div>

          {activeJobs.length > 0 ? (
            <div className="grid gap-3">
              {activeJobs.map(job => {
                const detailOptions = getTechnicalDetailOptions(job.service_id);
                const selectedDetailName = getServiceName(job.service_detail_id);
                return (
                  <div key={job.id} className="overflow-hidden rounded-xl border border-success/20 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-success/20 bg-success-container px-4 py-3">
                      <span className={`badge ${job.status === 'assigned' ? 'badge-assigned' : 'badge-in_progress'} uppercase text-[10px]`}>
                        {job.status === 'assigned' ? 'Mới nhận' : 'Đang thực hiện'}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-secondary-container shadow-sm">{job.hasGpsEstimate ? `~${job.distance}` : job.distance}</span>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold text-on-surface">{job.customerName}</h3>
                          <p className="text-body-sm text-on-surface-variant">{job.serviceName}</p>
                          {selectedDetailName && <p className="mt-0.5 text-xs font-bold text-secondary-container">Chi tiết: {selectedDetailName}</p>}
                        </div>
                        <div className="rounded-lg bg-primary-fixed px-3 py-2 text-right text-xs font-bold text-primary-container">{job.time}</div>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-label-sm text-on-surface-variant">
                        <MapPinIcon size={14} className="mt-0.5 shrink-0 text-primary-container" />
                        <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                      </div>
                      {detailOptions.length > 0 && (
                        <select
                          className="input-field !py-2 text-sm"
                          value={job.service_detail_id || ""}
                          onChange={e => void handleUpdateServiceDetail(job, e.target.value)}
                        >
                          <option value="">Chưa chọn chi tiết</option>
                          {detailOptions.map(detail => (
                            <option key={detail.id} value={detail.id}>{detail.name}</option>
                          ))}
                        </select>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={job.customer?.phone ? `tel:${job.customer.phone}` : "#"}
                          onClick={(e) => {
                            if (!job.customer?.phone) {
                              e.preventDefault();
                              showToast("Khách hàng chưa cập nhật số điện thoại!", "error");
                            }
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg border border-success/25 bg-success-container px-4 py-3 text-sm font-extrabold text-success"
                        >
                          <PhoneIcon size={18} />
                          Gọi khách
                        </a>
                        <button
                          type="button"
                          onClick={() => openDirections(job)}
                          className="flex items-center justify-center gap-2 rounded-lg bg-primary-fixed px-4 py-3 text-sm font-extrabold text-primary-container"
                        >
                          <MapPinIcon size={18} />
                          Chỉ đường
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => openQuickJobEdit(job)}
                          className="rounded-lg border border-primary-container/25 bg-primary-fixed px-5 py-3.5 text-sm font-extrabold text-primary-container transition-all hover:bg-primary-container hover:text-white active:scale-[0.98]"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => openCancelRequestModal(job)}
                          className="rounded-lg border border-error/25 bg-error-container px-5 py-3.5 text-sm font-extrabold text-error transition-all hover:bg-error hover:text-white active:scale-[0.98]"
                        >
                          Yêu cầu huỷ
                        </button>
                        <button
                          onClick={() => triggerCompleteJob(job)}
                          className="rounded-lg bg-success px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                        >
                          Hoàn thành Job
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-12 text-center">
              <CheckCircleIcon size={32} className="mx-auto mb-3 text-on-surface-variant" />
              <p className="text-base font-bold text-on-surface">Chưa có việc đang làm</p>
              <p className="text-body-sm text-on-surface-variant">Việc đã nhận sẽ hiển thị tại đây.</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="section-eyebrow">BillGo cần thu</p>
              <h2 className="text-xl font-extrabold text-on-surface">Danh sách công nợ</h2>
            </div>
            <span className="rounded-full bg-error-container px-3 py-1 text-xs font-extrabold text-error">{billGoTotals.debtItems}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Phải thu</p>
              <p className="mt-1 text-xl font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.receivable)}</p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success-container p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-on-success-container/75">Đã thu</p>
              <p className="mt-1 text-xl font-extrabold text-success">{formatBillGoCurrency(billGoTotals.paid)}</p>
            </div>
            <div className="rounded-xl border border-error/20 bg-error-container p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-error/75">Còn nợ</p>
              <p className="mt-1 text-xl font-extrabold text-error">{formatBillGoCurrency(billGoTotals.debt)}</p>
            </div>
          </div>

          {billGoRows.length > 0 ? (
            <div className="grid gap-3">
              {billGoRows.map(({ item, summary }) => {
                const rowCycle = paymentCyclesByReceivable[item.id]
                  || (item.cycle_at_collection as BillGoCycle | undefined)
                  || (item.subscription?.current_cycle as BillGoCycle | undefined)
                  || (item.subscription?.cycle as BillGoCycle | undefined)
                  || "monthly";
                return (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 bg-primary-fixed/45 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-primary-container">Thu cước BillGo</p>
                        <p className="mt-1 text-sm font-bold text-on-surface">{item.title || item.subscription?.package_name || item.id.slice(0, 8)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${summary.status === "overdue" ? "bg-error-container text-error" : summary.debt > 0 ? "bg-warning-container text-warning" : "bg-success-container text-success"}`}>
                        {summary.statusLabel}
                      </span>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold text-on-surface">{item.subscription?.customer_name || item.customer?.full_name || "Khách hàng"}</h3>
                          <p className="text-body-sm text-on-surface-variant">{item.subscription?.phone || item.customer?.phone || "Chưa có SĐT"}</p>
                        </div>
                        <div className="rounded-lg bg-surface-container-low px-3 py-2 text-right text-xs font-bold text-on-surface-variant">
                          Hạn: {item.due_date || item.subscription?.next_due_date || "Chưa có"}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-on-surface-variant">
                        <span className="rounded-lg bg-surface-container-low p-3">Phải thu<br /><strong className="text-on-surface">{formatBillGoCurrency(summary.receivable)}</strong></span>
                        <span className="rounded-lg bg-success-container p-3">Đã thu<br /><strong className="text-success">{formatBillGoCurrency(summary.paid)}</strong></span>
                        <span className="rounded-lg bg-error-container p-3">Còn nợ<br /><strong className="text-error">{formatBillGoCurrency(summary.debt)}</strong></span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                        <select
                          className="input-field !py-2 text-sm sm:col-span-2"
                          value={rowCycle}
                          onChange={event => {
                            const nextCycle = event.target.value as BillGoCycle;
                            setPaymentCycle(nextCycle);
                            setPaymentCyclesByReceivable(current => ({ ...current, [item.id]: nextCycle }));
                          }}
                          disabled={collectingPaymentJobId === item.id}
                        >
                          {BILLGO_CYCLE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <input
                          className="input-field !py-2 text-sm"
                          type="number"
                          min="0"
                          value={paymentAmount}
                          onChange={event => setPaymentAmount(event.target.value)}
                          placeholder="Số tiền thu"
                          disabled={collectingPaymentJobId === item.id}
                        />
                        <select
                          className="input-field !py-2 text-sm"
                          value={paymentMethod}
                          onChange={event => setPaymentMethod(event.target.value)}
                          disabled={collectingPaymentJobId === item.id}
                        >
                          <option value="cash">Tiền mặt</option>
                          <option value="transfer">Chuyển khoản</option>
                          <option value="card">Thẻ</option>
                          <option value="momo">MoMo</option>
                          <option value="zalopay">ZaloPay</option>
                          <option value="other">Khác</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleCollectBillGoReceivable(item)}
                          disabled={collectingPaymentJobId === item.id}
                          className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60 sm:col-span-2"
                        >
                          {collectingPaymentJobId === item.id ? "Đang lưu..." : "Tích đóng kỳ này"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-12 text-center">
              <DollarSignIcon size={32} className="mx-auto mb-3 text-on-surface-variant" />
              <p className="text-base font-bold text-on-surface">Chưa có khoản BillGo</p>
              <p className="text-body-sm text-on-surface-variant">Các khách thu cước được admin phân công sẽ hiển thị tại đây.</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="section-eyebrow">Đánh giá</p>
            <h2 className="text-xl font-extrabold text-on-surface">Hiệu suất phục vụ</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Điểm trung bình</p>
              <p className="mt-1 flex items-center gap-1 text-2xl font-extrabold text-on-surface">
                {workerStats.rating}
                <StarIcon size={18} className="fill-current text-warning" />
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Tháng này</p>
              <p className="mt-1 text-2xl font-extrabold text-primary-container">{workerStats.monthlyRating > 0 ? workerStats.monthlyRating : "0"}★</p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Hôm nay</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{workerStats.todayRating > 0 ? workerStats.todayRating : "0"}★</p>
            </div>
          </div>
        </section>
      </div>

      {/* Tabs */}
      <div className="mx-4 hidden grid-cols-3 gap-2 rounded-xl border border-outline-variant/30 bg-white p-1 shadow-sm md:grid sm:mx-6 lg:mx-8">
        <button
          onClick={() => setTab("new")}
          className={`relative rounded-lg px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${tab === "new" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
        >
          Việc mới
          {newJobs.length > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === "new" ? "bg-white text-primary" : "bg-error text-white"}`}>{newJobs.length}</span>}
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`rounded-lg px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${tab === "pending" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
        >
          Chờ duyệt
          {pendingApprovalJobs.length > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === "pending" ? "bg-white text-primary" : "bg-warning text-white"}`}>{pendingApprovalJobs.length}</span>}
        </button>
        <button
          onClick={() => setTab("active")}
          className={`rounded-lg px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${tab === "active" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
        >
          Đang làm
          {activeJobs.length > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === "active" ? "bg-white text-primary" : "bg-success text-white"}`}>{activeJobs.length}</span>}
        </button>
        {false && <button
          onClick={() => setTab("billgo")}
          className={`rounded-lg px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${tab === "billgo" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
        >
          Thu cước BillGo
          {billGoTotals.debtItems > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${tab === "billgo" ? "bg-white text-primary" : "bg-error text-white"}`}>{billGoTotals.debtItems}</span>}
        </button>}
      </div>

      {/* Job Feed */}
      <div className="flex-1 space-y-4 p-4 sm:px-6 lg:px-8">
        {tab === "new" ? (
          newJobs.length > 0 ? (
            newJobs.map(job => {
              const JobIcon = job.icon || BriefcaseIcon;

              return (
              <div key={job.id} className="animate-fade-in overflow-hidden rounded-xl border border-outline-variant/25 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 bg-primary-fixed/45 px-4 py-3">
                  <span className="text-[10px] font-extrabold uppercase text-primary-container">Việc mới quanh bạn</span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-error shadow-sm">{getUnworkedAgeLabel(job)}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-secondary shadow-sm">{job.hasGpsEstimate ? `~${job.distance}` : job.distance}</span>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm">
                      <JobIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold text-on-surface">{job.serviceName}</div>
                      <div className="text-label-sm text-on-surface-variant">{job.job_code}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-base font-bold text-primary-container sm:text-lg">{job.price}</div>
                </div>

                <div className="grid gap-2 rounded-lg bg-surface-container-low p-3">
                  <div className="flex items-start gap-2 text-on-surface-variant">
                    <MapPinIcon size={15} className="mt-1 shrink-0 text-primary-container" />
                    <span className="min-w-0 flex-1 text-body-sm leading-6">{job.address}</span>
                    <button
                      type="button"
                      onClick={() => openDirections(job)}
                      className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase text-primary-container shadow-sm transition-colors hover:bg-primary-container hover:text-white"
                    >
                      Chỉ đường
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <ClockIcon size={15} className="text-primary-container" />
                    <span className="text-body-sm">Hẹn lúc: {job.time}</span>
                  </div>
                </div>

                <TaskAttachmentList attachments={job.task_attachments} />

                {job.images && job.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant uppercase tracking-wide">
                      <CameraIcon size={14} />
                      Ảnh khách gửi trước
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {job.images.slice(0, 3).map((imgUrl: string, idx: number) => (
                        <a
                          key={imgUrl}
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low"
                        >
                          <Image src={imgUrl} alt={`Ảnh hiện trạng ${idx + 1}`} fill sizes="(max-width: 640px) 33vw, 140px" className="object-cover" unoptimized />
                          {idx === 2 && job.images.length > 3 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">
                              +{job.images.length - 3}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[1fr_1.7fr] gap-3 pt-1">
                  <button
                    onClick={() => handleDeclineJob(job.id)}
                    className="rounded-lg border border-error/25 bg-error-container px-4 py-3 text-sm font-extrabold text-error transition-all hover:bg-error hover:text-white active:scale-[0.98]"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleAcceptJob(job.id)}
                    className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    Nhận việc
                  </button>
                </div>
                </div>
              </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <BriefcaseIcon size={32} />
              </div>
              <p className="text-base font-bold text-on-surface">
                {isWorkerAvailable ? "Chưa có việc mới" : "Bạn đang Offline"}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {isWorkerAvailable
                  ? "Chưa có việc mới nào quanh đây."
                  : "Bật Online ở bảng điều khiển để tiếp tục nhận việc mới."}
              </p>
            </div>
          )
        ) : tab === "pending" ? (
          pendingApprovalJobs.length > 0 ? (
            pendingApprovalJobs.map(job => (
              <div key={job.id} className="overflow-hidden rounded-xl border border-warning/25 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-warning/20 bg-warning-container/80 px-4 py-3">
                  <span className="badge badge-pending uppercase text-[10px]">Chờ admin duyệt</span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-error shadow-sm">{getUnworkedAgeLabel(job)}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-secondary shadow-sm">{job.hasGpsEstimate ? `~${job.distance}` : job.distance}</span>
                    <span className="font-mono text-xs font-bold text-warning">{job.job_code}</span>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold text-on-surface sm:text-lg">{job.customerName}</h3>
                      <p className="text-body-sm text-on-surface-variant">{job.serviceName}</p>
                    </div>
                    <div className="rounded-lg bg-surface-container px-3 py-2 text-right text-xs font-bold text-on-surface-variant">
                      {job.time}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-label-sm text-on-surface-variant">
                    <MapPinIcon size={14} className="shrink-0 mt-0.5 text-primary-container" />
                    <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                  </div>

                  <div className="rounded-lg border border-warning/20 bg-warning-container/40 px-3 py-2 text-xs font-semibold text-warning">
                    Job sẽ chuyển sang “Đang làm” sau khi admin duyệt.
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <ClockIcon size={32} />
              </div>
              <p className="text-base font-bold text-on-surface">Không có job chờ duyệt</p>
              <p className="text-body-sm text-on-surface-variant">Chưa có job nào đang chờ admin duyệt.</p>
            </div>
          )
        ) : tab === "billgo" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/25 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">Phải thu</p>
                <p className="mt-1 text-xl font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.receivable)}</p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success-container p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase text-on-success-container/75">Đã thu</p>
                <p className="mt-1 text-xl font-extrabold text-success">{formatBillGoCurrency(billGoTotals.paid)}</p>
              </div>
              <div className="rounded-xl border border-error/20 bg-error-container p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase text-error/75">Còn nợ</p>
                <p className="mt-1 text-xl font-extrabold text-error">{formatBillGoCurrency(billGoTotals.debt)}</p>
              </div>
            </div>

            {billGoRows.length > 0 ? (
              billGoRows.map(({ item, summary }) => {
                const paidCount = item.payments?.filter(payment => payment.status === "paid").length || 0;
                const rowCycle = paymentCyclesByReceivable[item.id]
                  || (item.cycle_at_collection as BillGoCycle | undefined)
                  || (item.subscription?.current_cycle as BillGoCycle | undefined)
                  || (item.subscription?.cycle as BillGoCycle | undefined)
                  || "monthly";

                return (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-outline-variant/25 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 bg-primary-fixed/45 px-4 py-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-primary-container">Thu cước BillGo</p>
                        <p className="mt-1 text-sm font-bold text-on-surface">{item.title || item.subscription?.package_name || item.id.slice(0, 8)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${summary.status === "overdue" ? "bg-error-container text-error" : summary.debt > 0 ? "bg-warning-container text-warning" : "bg-success-container text-success"}`}>
                        {summary.statusLabel}
                      </span>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-extrabold text-on-surface sm:text-lg">{item.subscription?.customer_name || item.customer?.full_name || "Khách hàng"}</h3>
                          <p className="text-body-sm text-on-surface-variant">{item.subscription?.phone || item.customer?.phone || "Chưa có SĐT"}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{item.subscription?.customer_address || item.customer?.address || "Chưa có địa chỉ"}</p>
                        </div>
                        <div className="rounded-lg bg-surface-container-low px-3 py-2 text-right text-xs font-bold text-on-surface-variant">
                          Hạn: {item.due_date || item.subscription?.next_due_date || "Chưa có"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-on-surface-variant">
                        <span className="rounded-lg bg-surface-container-low p-3">Phải thu<br /><strong className="text-on-surface">{formatBillGoCurrency(summary.receivable)}</strong></span>
                        <span className="rounded-lg bg-success-container p-3">Đã thu<br /><strong className="text-success">{formatBillGoCurrency(summary.paid)}</strong></span>
                        <span className="rounded-lg bg-error-container p-3">Còn nợ<br /><strong className="text-error">{formatBillGoCurrency(summary.debt)}</strong></span>
                      </div>

                      <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase text-on-surface-variant">Ghi nhận thu tiền</p>
                          <span className="text-xs font-bold text-primary-container">{paidCount} lần thu</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                          <select
                            className="input-field !py-2 text-sm sm:col-span-2"
                            value={rowCycle}
                            onChange={event => {
                              const nextCycle = event.target.value as BillGoCycle;
                              setPaymentCycle(nextCycle);
                              setPaymentCyclesByReceivable(current => ({ ...current, [item.id]: nextCycle }));
                            }}
                            disabled={collectingPaymentJobId === item.id}
                          >
                            {BILLGO_CYCLE_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <input
                            className="input-field !py-2 text-sm"
                            type="number"
                            min="0"
                            value={paymentAmount}
                            onChange={event => setPaymentAmount(event.target.value)}
                            placeholder="Số tiền thu"
                            disabled={collectingPaymentJobId === item.id}
                          />
                          <select
                            className="input-field !py-2 text-sm"
                            value={paymentMethod}
                            onChange={event => setPaymentMethod(event.target.value)}
                            disabled={collectingPaymentJobId === item.id}
                          >
                            <option value="cash">Tiền mặt</option>
                            <option value="transfer">Chuyển khoản</option>
                            <option value="card">Thẻ</option>
                            <option value="momo">MoMo</option>
                            <option value="zalopay">ZaloPay</option>
                            <option value="other">Khác</option>
                          </select>
                          <input
                            className="input-field !py-2 text-sm sm:col-span-2"
                            value={paymentNote}
                            onChange={event => setPaymentNote(event.target.value)}
                            placeholder="Ghi chú thanh toán"
                            disabled={collectingPaymentJobId === item.id}
                          />
                          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[auto_1fr]">
                            {summary.debt > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentAmount(String(summary.debt));
                                  setPaymentCyclesByReceivable(current => ({ ...current, [item.id]: rowCycle }));
                                }}
                                className="rounded-lg border border-primary-container/25 px-4 py-3 text-sm font-extrabold text-primary-container"
                                disabled={collectingPaymentJobId === item.id}
                              >
                                Thu đủ còn nợ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleCollectBillGoReceivable(item)}
                              disabled={collectingPaymentJobId === item.id}
                              className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                            >
                              {collectingPaymentJobId === item.id ? "Đang lưu..." : "Tích đóng kỳ này"}
                            </button>
                          </div>
                          <p className="text-xs text-on-surface-variant sm:col-span-2">
                            Hạn thanh toán kỳ tiếp theo: <strong>{getBillGoNextDueDate(item.period_end ? getBillGoNextPeriodStartDate(item.period_end) : item.period_start || new Date().toISOString().slice(0, 10), rowCycle)}</strong>
                          </p>
                        </div>
                      </div>

                      {(item.subscription?.phone || item.customer?.phone) && (
                        <a
                          href={`tel:${item.subscription?.phone || item.customer?.phone}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-extrabold text-white"
                        >
                          <PhoneIcon size={18} />
                          Gọi khách
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                  <DollarSignIcon size={32} />
                </div>
                <p className="text-base font-bold text-on-surface">Chưa có khoản BillGo</p>
                <p className="text-body-sm text-on-surface-variant">Các khách thu cước được admin phân công sẽ hiển thị tại đây.</p>
              </div>
            )}
          </>
        ) : (
          activeJobs.length > 0 ? (
          activeJobs.map(job => {
            const detailOptions = getTechnicalDetailOptions(job.service_id);
            const selectedDetailName = getServiceName(job.service_detail_id);

            return (
            <div key={job.id} className="overflow-hidden rounded-xl border border-success/20 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-success/20 bg-success-container px-4 py-3">
                <span className={`badge ${job.status === 'assigned' ? 'badge-assigned' : 'badge-in_progress'} uppercase text-[10px]`}>
                  {job.status === 'assigned' ? 'Mới nhận' : 'Đang thực hiện'}
                </span>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-secondary-container shadow-sm">{job.hasGpsEstimate ? `~${job.distance}` : job.distance}</span>
                  <button className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-primary-container shadow-sm">Chi tiết</button>
                </div>
              </div>

              <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-extrabold text-on-surface sm:text-lg">{job.customerName}</h3>
                  <p className="text-body-sm text-on-surface-variant">{job.serviceName}</p>
                  {selectedDetailName && (
                    <p className="mt-0.5 text-xs font-bold text-secondary-container">Chi tiết: {selectedDetailName}</p>
                  )}
                </div>
                <div className="rounded-lg bg-primary-fixed px-3 py-2 text-right text-xs font-bold text-primary-container">
                  {job.time}
                </div>
                <span className="rounded-lg bg-error-container px-3 py-2 text-right text-xs font-bold text-error">
                  {getUnworkedAgeLabel(job)}
                </span>
              </div>

                <div className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 text-label-sm text-on-surface-variant">
                  <MapPinIcon size={14} className="shrink-0 mt-0.5 text-primary-container" />
                  <span className="line-clamp-2">{job.address || "Chưa cung cấp địa chỉ"}</span>
                </div>

                {detailOptions.length > 0 && (
                  <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-on-surface-variant">
                      Chi tiết kỹ thuật nội bộ
                    </label>
                    <select
                      className="input-field !py-2 text-sm"
                      value={job.service_detail_id || ""}
                      onChange={e => void handleUpdateServiceDetail(job, e.target.value)}
                    >
                      <option value="">Chưa chọn chi tiết</option>
                      {detailOptions.map(detail => (
                        <option key={detail.id} value={detail.id}>{detail.name}</option>
                      ))}
                    </select>
                  </div>
                )}

              <TaskAttachmentList attachments={job.task_attachments} />

              {job.images && job.images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant uppercase tracking-wide">
                    <CameraIcon size={14} />
                    Ảnh khách gửi trước
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {job.images.slice(0, 3).map((imgUrl: string, idx: number) => (
                      <a
                        key={imgUrl}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low"
                      >
                        <Image src={imgUrl} alt={`Ảnh hiện trạng ${idx + 1}`} fill sizes="(max-width: 640px) 33vw, 140px" className="object-cover" unoptimized />
                        {idx === 2 && job.images.length > 3 && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">
                            +{job.images.length - 3}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-y border-outline-variant/50 py-3">
                <a
                  href={job.customer?.phone ? `tel:${job.customer.phone}` : "#"}
                  onClick={(e) => {
                    if (!job.customer?.phone) {
                      e.preventDefault();
                      showToast("Khách hàng chưa cập nhật số điện thoại!", "error");
                    }
                  }}
                  className="flex flex-col items-center gap-1 rounded-lg p-2 text-center text-decoration-none transition-colors hover:bg-surface-container select-none"
                >
                  <PhoneIcon size={20} className="text-success" />
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Gọi khách</span>
                </a>
                <div className="h-8 w-px bg-outline-variant/50" />
                <button
                  type="button"
                  onClick={() => openDirections(job)}
                  className="flex flex-col items-center gap-1 rounded-lg bg-primary-fixed p-2 text-primary-container transition-colors hover:bg-primary-container hover:text-white"
                >
                  <MapPinIcon size={20} />
                  <span className="text-[10px] font-bold uppercase">Chỉ đường</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => openQuickJobEdit(job)}
                  className="rounded-lg border border-primary-container/25 bg-primary-fixed px-5 py-3.5 text-sm font-extrabold text-primary-container transition-all hover:bg-primary-container hover:text-white active:scale-[0.98]"
                >
                  Sửa
                </button>
                <button
                  onClick={() => openCancelRequestModal(job)}
                  className="rounded-lg border border-error/25 bg-error-container px-5 py-3.5 text-sm font-extrabold text-error transition-all hover:bg-error hover:text-white active:scale-[0.98]"
                >
                  Yêu cầu huỷ
                </button>
                <button
                  onClick={() => triggerCompleteJob(job)}
                  className="rounded-lg bg-success px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Hoàn thành Job
                </button>
              </div>
              </div>
            </div>
          );
          })
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/70 bg-white px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <CheckCircleIcon size={32} />
              </div>
              <p className="text-base font-bold text-on-surface">Chưa có việc đang làm</p>
              <p className="text-body-sm text-on-surface-variant">Việc đã nhận sẽ hiển thị tại đây để gọi khách, chỉ đường và hoàn thành.</p>
            </div>
          )
        )}
      </div>

      {editingQuickJob && (
        <div className="fixed inset-0 z-[68] flex items-stretch justify-center overflow-hidden bg-black/60 backdrop-blur-sm sm:items-center sm:px-4">
          <form
            onSubmit={handleSaveQuickJobEdit}
            className="flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant/50 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase text-primary-container">Công việc đang làm</p>
                <h2 className="mt-1 text-lg font-extrabold text-on-surface">Sửa thông tin công việc</h2>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-on-surface-variant">
                  {editingQuickJob.job_code || editingQuickJob.customerName || "Việc nhanh"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!savingQuickJobEdit) setEditingQuickJob(null);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
                aria-label="Đóng sửa công việc"
                disabled={savingQuickJobEdit}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6 sm:p-5">
              <div className="rounded-xl border border-primary-container/15 bg-primary-fixed/45 p-3 text-xs font-semibold text-primary-container">
                Chỉ sửa dịch vụ, khách hàng, địa chỉ và ghi chú. Ảnh, vật tư, thu tiền và lịch sử công việc được giữ nguyên.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Tìm khách đã có
                </label>
                <input
                  value={editQuickCustomerQuery}
                  onChange={(e) => {
                    setEditQuickCustomerQuery(e.target.value);
                    if (editQuickJob.customerId) setEditQuickJob(prev => ({ ...prev, customerId: "" }));
                  }}
                  placeholder="Tìm theo tên, SĐT hoặc account"
                  className="input-field !py-2.5"
                  disabled={savingQuickJobEdit}
                />
                {editQuickCustomerQuery.trim() && editQuickCustomerResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-outline-variant/40 bg-white shadow-sm">
                    {editQuickCustomerResults.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectEditQuickCustomer(customer)}
                        className="block w-full border-b border-outline-variant/20 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-container-low"
                        disabled={savingQuickJobEdit}
                      >
                        <span className="font-bold text-on-surface">{customer.name}</span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">
                          {[customer.phone, customer.account ? `Account ${customer.account}` : "", customer.address].filter(Boolean).join(" • ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {editQuickJob.customerId && (
                  <div className="rounded-lg bg-success-container px-3 py-2 text-xs font-bold text-success">
                    Đang dùng khách đã có: {editQuickJob.customerName}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Tên khách hàng
                  </label>
                  <input
                    value={editQuickJob.customerName}
                    onChange={(e) => setEditQuickJob(prev => ({ ...prev, customerId: "", customerName: e.target.value }))}
                    placeholder="Nhập tên khách hàng"
                    className="input-field !py-2.5"
                    disabled={savingQuickJobEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    SĐT khách hàng
                  </label>
                  <input
                    type="tel"
                    value={editQuickJob.customerPhone}
                    onChange={(e) => setEditQuickJob(prev => ({ ...prev, customerId: "", customerPhone: e.target.value }))}
                    placeholder="Nhập SĐT"
                    className="input-field !py-2.5"
                    disabled={savingQuickJobEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Dịch vụ
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditQuickServicePickerOpen(open => !open)}
                    className="rounded-full bg-primary-container px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:brightness-110"
                    disabled={savingQuickJobEdit || services.length === 0}
                  >
                    Đổi dịch vụ
                  </button>
                </div>

                {selectedEditQuickServices.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-secondary-container/20 bg-secondary-container/10 p-2">
                    {selectedEditQuickServices.map(service => (
                      <span key={service.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-secondary-container">
                        {getQuickServicePathLabel(service, services)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low px-3 py-4 text-sm font-semibold text-on-surface-variant">
                    Chưa chọn dịch vụ
                  </div>
                )}

                {editQuickServicePickerOpen && (
                  <div className="space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                    <div className="flex gap-2">
                      <input
                        type="search"
                        value={editQuickServiceSearch}
                        onChange={(e) => setEditQuickServiceSearch(e.target.value)}
                        placeholder="Tìm dịch vụ: camera, internet, máy lạnh..."
                        className="input-field min-w-0 flex-1 !py-2.5"
                        disabled={savingQuickJobEdit}
                      />
                      {editQuickServiceSearch && (
                        <button
                          type="button"
                          onClick={() => setEditQuickServiceSearch("")}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-outline-variant/50 bg-white text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container"
                          aria-label="Xóa tìm kiếm dịch vụ"
                          disabled={savingQuickJobEdit}
                        >
                          <XIcon size={18} />
                        </button>
                      )}
                    </div>

                    {editQuickServiceSearch.trim() && (
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {editQuickServiceSearchResults.length > 0 ? (
                          editQuickServiceSearchResults.map(service => {
                            const isSelected = editQuickJob.serviceIds.includes(service.id);
                            return (
                              <button
                                key={`edit-search-${service.id}`}
                                type="button"
                                onClick={() => handleEditQuickServiceChange(service.id)}
                                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
                                  isSelected
                                    ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                    : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                }`}
                                disabled={savingQuickJobEdit}
                              >
                                <span className="block text-sm font-extrabold leading-5">{service.name}</span>
                                <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                  {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-outline-variant/60 bg-white px-3 py-4 text-sm font-semibold text-on-surface-variant">
                            Không tìm thấy dịch vụ phù hợp
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {quickServiceGroups.map(group => {
                        const isOpen = expandedEditQuickServiceGroup === group.category.id;
                        const hasSelectedService = group.services.some(service => editQuickJob.serviceIds.includes(service.id));
                        return (
                          <div key={`edit-${group.parent.id}`} className="rounded-lg border border-outline-variant/30 bg-white">
                            <button
                              type="button"
                              onClick={() => setExpandedEditQuickServiceGroup(isOpen ? "" : group.category.id)}
                              className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                                hasSelectedService ? "bg-secondary-container/10 text-secondary-container" : "text-on-surface hover:bg-surface-container-low"
                              }`}
                              disabled={savingQuickJobEdit}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-extrabold">{group.parent.name}</span>
                                <span className="mt-0.5 block text-xs font-semibold text-on-surface-variant">
                                  {group.services.length} mục công việc
                                </span>
                              </span>
                              <ChevronRightIcon size={18} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>

                            {isOpen && (
                              <div className="space-y-3 border-t border-outline-variant/30 p-2">
                                {group.directServices.length > 0 && (
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {group.directServices.map(service => {
                                      const isSelected = editQuickJob.serviceIds.includes(service.id);
                                      return (
                                        <button
                                          key={`edit-direct-${service.id}`}
                                          type="button"
                                          onClick={() => handleEditQuickServiceChange(service.id)}
                                          className={`min-h-[58px] rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                                            isSelected
                                              ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                              : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                          }`}
                                          disabled={savingQuickJobEdit}
                                        >
                                          <span className="block text-sm font-extrabold leading-5">{service.name}</span>
                                          <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                            {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {group.childGroups.map(({ child, services: childServices }) => (
                                  <section key={`edit-child-${child.id}`} className="space-y-2">
                                    <h4 className="px-1 text-sm font-extrabold text-on-surface">{child.name}</h4>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {childServices.map(service => {
                                        const isSelected = editQuickJob.serviceIds.includes(service.id);
                                        return (
                                          <button
                                            key={`edit-child-service-${service.id}`}
                                            type="button"
                                            onClick={() => handleEditQuickServiceChange(service.id)}
                                            className={`min-h-[58px] rounded-lg border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                                              isSelected
                                                ? "border-secondary-container bg-secondary-container text-white shadow-sm"
                                                : "border-outline-variant/40 bg-white text-on-surface hover:border-secondary-container/60 hover:bg-secondary-container/10"
                                            }`}
                                            disabled={savingQuickJobEdit}
                                          >
                                            <span className="block text-sm font-extrabold leading-5">{service.name}</span>
                                            <span className={`mt-1 block text-xs font-semibold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                                              {getQuickServiceSuggestionLabel(service, services)} • Từ {formatCurrency(Number(service.base_price || 0))}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </section>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Địa chỉ làm việc
                </label>
                <input
                  value={editQuickJob.address}
                  onChange={(e) => setEditQuickJob(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Nhập địa chỉ thực tế"
                  className="input-field !py-2.5"
                  disabled={savingQuickJobEdit}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Ghi chú
                </label>
                <textarea
                  value={editQuickJob.description}
                  onChange={(e) => setEditQuickJob(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ghi chú tình trạng, yêu cầu hoặc trao đổi với khách"
                  className="input-field min-h-24 resize-none !py-2.5"
                  disabled={savingQuickJobEdit}
                />
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-outline-variant/50 bg-white p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setEditingQuickJob(null)}
                className="rounded-lg border border-outline-variant/60 bg-white px-4 py-3 text-sm font-extrabold text-on-surface-variant transition hover:bg-surface-container"
                disabled={savingQuickJobEdit}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary-container px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={savingQuickJobEdit}
              >
                {savingQuickJobEdit ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {directionsView && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="flex h-[82dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[78vh] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/40 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase text-primary-container">Chỉ đường</p>
                <h3 className="truncate text-base font-extrabold text-on-surface">
                  {directionsView.job.customerName || directionsView.job.serviceName || "Khách hàng"}
                </h3>
                <p className="line-clamp-1 text-xs text-on-surface-variant">
                  {directionsView.job.address || "Điểm đến theo GPS"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectionsView(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-error-container hover:text-error"
                aria-label="Đóng bản đồ"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="grid gap-3 border-b border-outline-variant/40 bg-surface-container-lowest px-4 py-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto]">
              <input
                className="input-field !py-2 text-sm"
                value={directionsView.destinationInput}
                onChange={(e) => setDirectionsField("destinationInput", e.target.value)}
                placeholder="Nhập địa điểm khách hàng"
              />
              <input
                className="input-field !py-2 text-sm"
                value={directionsView.destinationLat}
                onChange={(e) => setDirectionsField("destinationLat", e.target.value)}
                placeholder="Vĩ độ"
                inputMode="decimal"
              />
              <input
                className="input-field !py-2 text-sm"
                value={directionsView.destinationLng}
                onChange={(e) => setDirectionsField("destinationLng", e.target.value)}
                placeholder="Kinh độ"
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={showDirectionsForDraft}
                className="rounded-lg bg-primary-container px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:brightness-110"
              >
                Hiển thị
              </button>
              <button
                type="button"
                onClick={useCurrentLocationAsOrigin}
                className="rounded-lg border border-outline-variant/60 bg-white px-4 py-2 text-xs font-extrabold text-primary-container transition hover:bg-primary-fixed sm:col-span-4"
              >
                Lấy vị trí của tôi làm điểm xuất phát
              </button>
            </div>

            {directionsView.embedUrl ? (
              <iframe
                title="Bản đồ chỉ đường"
                src={directionsView.embedUrl}
                className="min-h-0 flex-1 border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-container-low px-6 text-center">
                <div>
                  <MapPinIcon size={36} className="mx-auto mb-3 text-primary-container" />
                  <p className="text-sm font-extrabold text-on-surface">Nhập vị trí khách hàng</p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                    Nhập địa điểm hoặc tọa độ điểm thợ đã tích trên bản đồ.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 px-4 py-3">
              <p className="min-w-0 text-xs font-semibold text-on-surface-variant">
                Nếu bản đồ cần quyền vị trí, hãy cho phép trình duyệt lấy vị trí hiện tại.
              </p>
              {directionsView.externalUrl && (
                <a
                  href={directionsView.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-primary-container px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:brightness-110"
                >
                  Mở Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {activeJobToComplete && (
        <div className="fixed inset-0 z-[70] flex items-stretch justify-center overflow-hidden bg-black/60 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl animate-fade-in-up sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl">

            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant/50">
              <h2 className="text-lg font-bold text-on-surface">Hoàn thành công việc</h2>
              <button
                onClick={() => {
                  if (!uploadingImages) {
                    setActiveJobToComplete(null);
                    setSelectedFiles([]);
                    setPreviewUrls([]);
                    setCompletionItems([]);
                    setCompletionHandoverData({});
                    setCompletionInternetInstallFeeInput("300000");
                    setCompletionGiftCamera("");
                    setCompletionGiftCameraPassword("");
                    setCompletionInternetCycle("monthly");
                    setCompletionInternetMonthlyFee("");
                    setCompletionAddOnPackageId("");
                    setCompletionAddOnCycle("monthly");
                    setCompletionAddOnNote("");
                  }
                }}
                className="p-1.5 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
                disabled={uploadingImages}
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6 sm:p-5">
              <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
                <p className="text-body-sm font-bold text-on-surface">Khách hàng: {activeJobToComplete.customerName}</p>
                <p className="text-body-sm text-on-surface-variant">Dịch vụ: {activeJobToComplete.serviceName}</p>
                {getServiceName(activeJobToComplete.service_detail_id) && (
                  <p className="text-body-sm text-on-surface-variant">
                    Chi tiết kỹ thuật: {getServiceName(activeJobToComplete.service_detail_id)}
                  </p>
                )}
                <p className="text-body-sm text-on-surface-variant">Mã đơn: {activeJobToComplete.job_code}</p>
                <p className="text-body-sm text-primary font-bold">
                  Báo giá ban đầu: {formatCurrency(activeJobToComplete.quoted_price)}
                </p>
              </div>

              <DynamicServiceWorkflowForm
                services={completionWorkflowServices}
                value={completionHandoverData}
                onChange={setCompletionHandoverData}
                includeSectionKeys={handoverWorkflowSectionKeys}
                disabled={uploadingImages}
              />

              {isInternetCompletionJob && (
                <div className="rounded-xl border border-success/20 bg-success-container/60 p-4">
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-on-surface">Cước Internet lắp mới</label>
                    <p className="text-xs text-on-surface-variant">Chọn chu kỳ khách đóng để tính tổng tiền xuất phiếu thu.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Cước Internet/tháng</label>
                      <input
                        className="input-field !py-2 text-sm"
                        type="number"
                        min="0"
                        step="1000"
                        value={completionInternetMonthlyFee}
                        onChange={event => setCompletionInternetMonthlyFee(event.target.value)}
                        placeholder="Nhập cước tháng"
                        disabled={uploadingImages}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Chu kỳ đóng</label>
                      <select
                        className="input-field !py-2 text-sm"
                        value={completionInternetCycle}
                        onChange={event => {
                          const nextCycle = event.target.value as BillGoCycle;
                          setCompletionInternetCycle(nextCycle);
                          if (nextCycle === "monthly") {
                            setCompletionGiftCamera("");
                            setCompletionGiftCameraPassword("");
                          }
                        }}
                        disabled={uploadingImages}
                      >
                        {BILLGO_CYCLE_OPTIONS.filter(option => INTERNET_COMPLETION_CYCLES.includes(option.value)).map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Cước theo chu kỳ</label>
                      <div className="rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-extrabold text-primary-container">
                        {formatBillGoCurrency(completionInternetCycleTotal)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Cước thu trên phiếu</label>
                      <div className="rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-extrabold text-success">
                        {formatBillGoCurrency(completionInternetReceiptTotal)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Phí lắp đặt</label>
                      <select
                        className="input-field !py-2 text-sm"
                        value={completionInternetInstallFeeInput}
                        onChange={event => {
                          setCompletionInternetInstallFeeInput(event.target.value);
                          if (event.target.value !== "400000") {
                            setCompletionGiftCamera("");
                            setCompletionGiftCameraPassword("");
                          }
                        }}
                        disabled={uploadingImages}
                      >
                        {INTERNET_INSTALL_FEE_OPTIONS.map(fee => (
                          <option key={fee} value={String(fee)}>{formatBillGoCurrency(fee)}</option>
                        ))}
                      </select>
                    </div>
                    {canGiftViettelCamera && (
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-on-surface-variant">Camera Viettel tặng kèm</label>
                        <select
                          className="input-field !py-2 text-sm"
                          value={completionGiftCamera}
                          onChange={event => setCompletionGiftCamera(event.target.value)}
                          disabled={uploadingImages}
                        >
                          <option value="">Chọn loại camera</option>
                          {VIETTEL_GIFT_CAMERA_OPTIONS.map(cameraName => (
                            <option key={cameraName} value={cameraName}>{cameraName}</option>
                          ))}
                        </select>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Tài khoản camera</label>
                            <input
                              className="input-field !py-2 text-sm bg-surface-container-low"
                              value={completionGiftCameraAccountValue}
                              readOnly
                              placeholder="Tự lấy SĐT khách"
                              disabled={uploadingImages}
                            />
                            <p className="text-[11px] font-semibold text-on-surface-variant">Tự lấy theo SĐT khách hàng.</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Mật khẩu camera</label>
                            <input
                              className="input-field !py-2 text-sm"
                              type="text"
                              value={completionGiftCameraPassword}
                              onChange={event => setCompletionGiftCameraPassword(event.target.value)}
                              placeholder="Nhập mật khẩu bàn giao"
                              disabled={uploadingImages}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isInternetCompletionJob && (
                <div className="rounded-xl border border-primary-container/20 bg-primary-fixed/40 p-4">
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-on-surface">Khách chọn thêm gói cước</label>
                    <p className="text-xs text-on-surface-variant">Dùng khi lắp Internet xong khách đăng ký thêm TV360 hoặc đầu thu.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Gói phát sinh</label>
                      <select
                        className="input-field !py-2 text-sm"
                        value={completionAddOnPackageId}
                        onChange={event => {
                          const packageId = event.target.value;
                          const nextPackage = completionBillGoAddOnPackages.find(item => item.id === packageId) || null;
                          const allowedCycles = new Set([
                            ...(nextPackage?.allowed_cycles || []),
                            ...BILLGO_SIGNUP_CYCLES,
                          ]);
                          setCompletionAddOnPackageId(packageId);
                          setCompletionAddOnCycle((allowedCycles.has(completionAddOnCycle) ? completionAddOnCycle : BILLGO_SIGNUP_CYCLES[0] || "monthly") as BillGoCycle);
                        }}
                        disabled={uploadingImages || completionBillGoAddOnPackages.length === 0}
                      >
                        <option value="">Không thêm gói</option>
                        {completionBillGoAddOnPackages.map(packageOption => (
                          <option key={packageOption.id} value={packageOption.id}>
                            {getBillGoPackageTypeLabel(packageOption.type)} - {packageOption.name} - {formatBillGoCurrency(getBillGoPackagePrice(packageOption))}/tháng
                          </option>
                        ))}
                      </select>
                      {completionBillGoAddOnPackages.length === 0 && (
                        <p className="text-xs font-semibold text-error">Chưa có gói TV360/Đầu thu đang áp dụng trong danh mục.</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Chu kỳ</label>
                      <select
                        className="input-field !py-2 text-sm"
                        value={completionAddOnCycle}
                        onChange={event => setCompletionAddOnCycle(event.target.value as BillGoCycle)}
                        disabled={uploadingImages || !selectedCompletionAddOnPackage}
                      >
                        {completionAddOnCycleOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Cước kỳ đầu</label>
                      <div className="rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-extrabold text-primary-container">
                        {formatBillGoCurrency(completionAddOnTotal)}
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Tổng cước gói</label>
                      <div className="rounded-lg border border-primary-container/30 bg-white px-3 py-2 text-base font-extrabold text-primary-container">
                        {formatBillGoCurrency(completionAddOnGrandTotal)}
                      </div>
                      <p className="text-xs font-semibold text-on-surface-variant">
                        Bằng chữ: {readVietnameseMoney(completionAddOnGrandTotal)}
                      </p>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Ghi chú gói phát sinh</label>
                      <input
                        className="input-field !py-2 text-sm"
                        value={completionAddOnNote}
                        onChange={event => setCompletionAddOnNote(event.target.value)}
                        placeholder="Không bắt buộc"
                        disabled={uploadingImages || !selectedCompletionAddOnPackage}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-bold text-on-surface block">Sản phẩm, linh kiện và công dịch vụ</label>
                    <p className="text-xs text-on-surface-variant">Nhập từng dòng để chốt tổng tiền và in hóa đơn cho khách.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addInventoryCompletionItem}
                    className="shrink-0 rounded-lg border border-secondary-container/30 bg-secondary-fixed px-3 py-2 text-xs font-bold text-secondary-container disabled:opacity-50"
                    disabled={uploadingImages}
                  >
                    Thêm vật tư
                  </button>
                  <button
                    type="button"
                    onClick={addCompletionItem}
                    className="shrink-0 rounded-lg border border-primary-container/30 bg-primary-fixed px-3 py-2 text-xs font-bold text-primary-container"
                    disabled={uploadingImages}
                  >
                    Thêm dòng
                  </button>
                </div>

                <div className="space-y-3">
                  {completionItems.map((item, index) => (
                    <div key={item.id} className="rounded-xl border border-outline-variant/40 bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase text-on-surface-variant">Dòng {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeCompletionItem(item.id)}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-error hover:bg-error-container disabled:opacity-40"
                          disabled={uploadingImages || completionItems.length === 1}
                        >
                          Xóa
                        </button>
                      </div>
                      {item.source === "inventory" && (
                        <div className="space-y-2">
                          <select
                            value={item.inventoryProductId || ""}
                            onChange={(e) => updateInventoryCompletionProduct(item.id, e.target.value)}
                            className="input-field"
                            disabled={uploadingImages}
                          >
                            <option value="">Chọn vật tư từ kho</option>
                            {inventoryProducts.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} - tồn {product.stock_quantity} {product.unit}
                              </option>
                            ))}
                          </select>
                          {item.inventoryProductId && (
                            <p className="text-xs font-semibold text-on-surface-variant">
                              {item.sku} · {item.category} · Đơn vị: {item.unit}
                            </p>
                          )}
                        </div>
                      )}
                      <input
                        value={item.name}
                        onChange={(e) => updateCompletionItem(item.id, { name: e.target.value })}
                        className="input-field"
                        placeholder="Tên sản phẩm/linh kiện/công dịch vụ"
                        disabled={uploadingImages || item.source === "inventory"}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-on-surface-variant">SL</label>
                          <input
                            type="number"
                            min="1"
                            max={item.source === "inventory" && item.inventoryProductId ? inventoryProducts.find(product => product.id === item.inventoryProductId)?.stock_quantity : undefined}
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateCompletionItem(item.id, { quantity: Number(e.target.value) })}
                            className="input-field mt-1 !px-3"
                            disabled={uploadingImages}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-on-surface-variant">Đơn giá</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.unitPrice}
                            onChange={(e) => updateCompletionItem(item.id, { unitPrice: Number(e.target.value) })}
                            className="input-field mt-1 !px-3"
                            disabled={uploadingImages}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-on-surface-variant">BH ngày</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.warrantyDays}
                            onChange={(e) => updateCompletionItem(item.id, { warrantyDays: Number(e.target.value) })}
                            className="input-field mt-1 !px-3"
                            disabled={uploadingImages}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                        <span className="font-semibold text-on-surface-variant">Thành tiền</span>
                        <span className="font-bold text-primary-container">{formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-success/20 bg-success-container p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-on-success-container">Tổng tiền hóa đơn</span>
                    <span className="text-xl font-extrabold text-success">{formatCurrency(completionTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-on-success-container">
                    Bằng chữ: {readVietnameseMoney(completionTotal)}
                  </p>
                  {isInternetCompletionJob && (
                    <p className="mt-1 text-xs font-semibold text-on-success-container">
                      Dòng dịch vụ lắp mới Internet không tính vào phiếu thu; chỉ thu phí lắp đặt và cước trả trước nếu có.
                    </p>
                  )}
                  {completionInternetReceiptTotal > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
                      <span className="font-semibold text-on-surface-variant">Đã cộng cước Internet {getBillGoCycleOption(completionInternetCycle).label}</span>
                      <span className="font-extrabold text-on-surface">{formatCurrency(completionInternetReceiptTotal)}</span>
                    </div>
                  )}
                  {completionInternetInstallFee > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
                      <span className="font-semibold text-on-surface-variant">Đã cộng phí lắp đặt Internet</span>
                      <span className="font-extrabold text-on-surface">{formatCurrency(completionInternetInstallFee)}</span>
                    </div>
                  )}
                  {canGiftViettelCamera && completionGiftCamera && (
                    <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-on-surface-variant">
                      Tặng kèm: {completionGiftCamera}
                      {completionGiftCameraAccountValue && (
                        <span className="block">Tài khoản cam: {completionGiftCameraAccountValue}</span>
                      )}
                    </div>
                  )}
                  {selectedCompletionAddOnPackage && (
                    <div className="mt-3 rounded-lg bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-on-surface">Tổng gồm gói cước</span>
                        <span className="text-xl font-extrabold text-primary-container">{formatCurrency(completionAllInTotal)}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                        Bằng chữ: {readVietnameseMoney(completionAllInTotal)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-on-surface">Thanh toán công việc</label>
                    <p className="text-xs text-on-surface-variant">Khoản thu này chỉ áp dụng cho job hiện tại.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Trạng thái thanh toán</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "paid", label: "Đã thu đủ" },
                          { value: "partial", label: "Thu một phần" },
                          { value: "unpaid", label: "Chưa thu" },
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              const nextStatus = option.value as CompletionPaymentStatus;
                              setCompletionPaymentStatus(nextStatus);
                              if (nextStatus !== "partial") setCompletionPaymentAmount("");
                            }}
                            className={`min-h-11 rounded-lg border px-2 text-xs font-extrabold transition ${
                              completionPaymentStatus === option.value
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-outline-variant/40 bg-white text-on-surface-variant hover:bg-surface-container-low"
                            }`}
                            disabled={uploadingImages}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Số tiền đã thu</label>
                      <input
                        className="input-field !py-2 text-sm"
                        type="number"
                        min="0"
                        max={completionTotal}
                        step="1000"
                        value={completionPaymentStatus === "partial" ? completionPaymentAmount : String(completionPaidAmount)}
                        onChange={event => setCompletionPaymentAmount(event.target.value)}
                        disabled={uploadingImages || completionPaymentStatus !== "partial"}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Số tiền còn thiếu</label>
                      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm font-extrabold text-error">
                        {formatCurrency(completionRemainingAmount)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Phương thức thanh toán</label>
                      <select
                        className="input-field !py-2 text-sm"
                        value={completionPaymentMethod}
                        onChange={event => setCompletionPaymentMethod(event.target.value)}
                        disabled={uploadingImages || completionPaymentStatus === "unpaid"}
                      >
                        <option value="cash">Tiền mặt</option>
                        <option value="transfer">Chuyển khoản</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-on-surface-variant">Ghi chú thanh toán</label>
                      <input
                        className="input-field !py-2 text-sm"
                        value={completionPaymentNote}
                        onChange={event => setCompletionPaymentNote(event.target.value)}
                        placeholder="Không bắt buộc"
                        disabled={uploadingImages}
                      />
                    </div>
                  </div>
                </div>

                {hasCompletionExtraSale && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface block">Ghi chú phiếu bảo hành</label>
                    <textarea
                      value={warrantyNote}
                      onChange={(e) => setWarrantyNote(e.target.value)}
                      className="input-field min-h-24 resize-none"
                      disabled={uploadingImages}
                    />
                  </div>
                )}
              </div>

              {/* Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface block">Hình ảnh thực tế sau khi làm</label>
                <p className="text-xs text-on-surface-variant">Hãy chụp và tải ảnh kết quả công việc để khách hàng nghiệm thu.</p>

                {/* File picker */}
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-outline-variant/60 rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <CameraIcon size={28} className="text-on-surface-variant/80 mb-2" />
                      <p className="text-xs font-bold text-primary">Tải ảnh lên (Nhiều ảnh)</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">PNG, JPG, JPEG</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={uploadingImages}
                    />
                  </label>
                </div>

                {/* Previews */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant group">
                        <Image src={url} alt="Preview" fill sizes="(max-width: 640px) 33vw, 140px" className="object-cover" unoptimized />
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                          disabled={uploadingImages}
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 border-t border-outline-variant/50 bg-surface-container-lowest p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:p-5">
              <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveJobToComplete(null);
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                  setCompletionItems([]);
                  setCompletionHandoverData({});
                }}
                className="btn-outline !w-auto flex-1 !py-2 !px-4 text-sm sm:flex-none"
                disabled={uploadingImages}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteJob}
                className="btn-primary !w-auto flex-[1.4] !py-2 !px-5 text-sm !bg-success !border-success sm:min-w-[140px] sm:flex-none"
                disabled={uploadingImages}
              >
                {uploadingImages ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : "Hoàn thành Job"}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Cancel Modal */}
      {jobToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/50">
              <h2 className="text-lg font-bold text-on-surface">Yêu cầu huỷ công việc</h2>
              <button
                onClick={() => {
                  if (!requestingCancel) {
                    setJobToCancel(null);
                    setCancelReason("Khách hàng từ chối lắp đặt/sửa chữa");
                  }
                }}
                className="p-1.5 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
                disabled={requestingCancel}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleRequestCancelJob}>
              <div className="p-5 space-y-4">
                <div className="rounded-xl bg-surface-container-low p-4">
                  <p className="text-body-sm font-bold text-on-surface">{jobToCancel.customerName}</p>
                  <p className="text-body-sm text-on-surface-variant">{jobToCancel.serviceName}</p>
                  <p className="text-label-sm text-on-surface-variant mt-1">Mã đơn: {jobToCancel.job_code}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface block">Lý do huỷ</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="input-field min-h-28 resize-none"
                    placeholder="VD: Khách hàng từ chối lắp đặt/sửa chữa"
                    disabled={requestingCancel}
                  />
                  <p className="text-xs text-on-surface-variant">
                    Yêu cầu này sẽ chuyển tới admin duyệt trước khi job được huỷ chính thức.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setJobToCancel(null);
                    setCancelReason("Khách hàng từ chối lắp đặt/sửa chữa");
                  }}
                  className="btn-outline !w-auto flex-1 !py-2 !px-4 text-sm sm:flex-none"
                  disabled={requestingCancel}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn-primary !w-auto flex-[1.4] !py-2 !px-5 text-sm !bg-error !border-error sm:min-w-[150px] sm:flex-none"
                  disabled={requestingCancel}
                >
                  {requestingCancel ? "Đang gửi..." : "Gửi yêu cầu huỷ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
