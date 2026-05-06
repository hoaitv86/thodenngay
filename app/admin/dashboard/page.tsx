import {
  Briefcase,
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

// Mock data — sẽ thay bằng Supabase query
const stats = [
  {
    label: "Tổng Job",
    value: "156",
    change: "+12%",
    icon: Briefcase,
    color: "bg-primary-fixed text-primary",
  },
  {
    label: "Đang chờ",
    value: "8",
    change: "",
    icon: Clock,
    color: "bg-warning/10 text-warning",
  },
  {
    label: "Hoàn thành",
    value: "132",
    change: "+8%",
    icon: CheckCircle2,
    color: "bg-success/10 text-success",
  },
  {
    label: "Thợ hoạt động",
    value: "24",
    change: "+3",
    icon: UserCheck,
    color: "bg-info/10 text-info",
  },
];

const recentJobs = [
  {
    id: "JOB-0156",
    customer: "Nguyễn Văn A",
    service: "Sửa điện",
    status: "pending",
    time: "5 phút trước",
  },
  {
    id: "JOB-0155",
    customer: "Trần Thị B",
    service: "Sửa nước",
    status: "assigned",
    time: "12 phút trước",
  },
  {
    id: "JOB-0154",
    customer: "Lê Văn C",
    service: "Lắp camera",
    status: "in_progress",
    time: "30 phút trước",
  },
  {
    id: "JOB-0153",
    customer: "Phạm Thị D",
    service: "Sửa khóa",
    status: "done",
    time: "1 giờ trước",
  },
  {
    id: "JOB-0152",
    customer: "Hoàng Văn E",
    service: "Sửa điện",
    status: "done",
    time: "2 giờ trước",
  },
];

const pendingWorkers = [
  { name: "Trần Minh Tuấn", specialty: "Điện, Camera", appliedAt: "Hôm nay" },
  { name: "Nguyễn Hữu Phát", specialty: "Nước, Cơ khí", appliedAt: "Hôm qua" },
];

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Chờ xử lý",
    className: "bg-warning/10 text-warning",
  },
  assigned: {
    label: "Đã gán thợ",
    className: "bg-info/10 text-info",
  },
  in_progress: {
    label: "Đang làm",
    className: "bg-primary-fixed text-primary",
  },
  done: {
    label: "Hoàn thành",
    className: "bg-success/10 text-success",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-error-container text-error",
  },
};

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Tổng quan</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Xin chào! Đây là tình hình hôm nay.
          </p>
        </div>
        <Link
          href="/admin/jobs?action=create"
          className="px-4 py-2.5 bg-secondary-container text-on-secondary font-semibold rounded-lg hover:opacity-90 transition-opacity text-body-sm flex items-center gap-2 shadow-sm"
        >
          <Briefcase className="w-4 h-4" />
          Tạo Job mới
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/20"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.change && (
                <span className="flex items-center gap-0.5 text-label-sm text-success">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-headline-md text-on-surface font-bold">
              {stat.value}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface">
              Job gần đây
            </h2>
            <Link
              href="/admin/jobs"
              className="text-body-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-low/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-label-sm text-on-surface-variant font-mono">
                    {job.id}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {job.customer}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {job.service}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-label-sm font-medium ${statusConfig[job.status]?.className}`}
                  >
                    {statusConfig[job.status]?.label}
                  </span>
                  <span className="text-label-sm text-on-surface-variant hidden sm:block">
                    {job.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Worker Approvals */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h2 className="text-body-lg font-semibold text-on-surface flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Thợ chờ duyệt
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-label-sm font-bold">
              {pendingWorkers.length}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {pendingWorkers.map((w) => (
              <div
                key={w.name}
                className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-label-md font-bold text-primary">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">
                      {w.name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {w.specialty}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-primary-container text-on-primary text-label-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
                    Duyệt
                  </button>
                  <button className="flex-1 py-2 bg-surface text-on-surface-variant text-label-sm font-semibold rounded-lg border border-outline-variant hover:bg-surface-container transition-colors">
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
            <Link
              href="/admin/workers?status=pending"
              className="block text-center text-body-sm text-primary font-medium hover:underline"
            >
              Xem tất cả thợ chờ duyệt →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
