"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SearchIcon,
  FilterIcon,
  ChevronRightIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  XIcon,
  DollarSignIcon,
  ShieldCheckIcon
} from "../../components/icons";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  status: "active" | "blocked";
  created_at: string;
  jobs: {
    id: string;
    quoted_price: number;
    status: string;
  }[];
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Selected customer & drawer details
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerJobs, setCustomerJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Modals & Confirm states
  const [confirmDialog, setConfirmDialog] = useState<{ type: "block" | "unblock"; customer: CustomerProfile } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });
  const [processing, setProcessing] = useState(false);

  const supabase = createClient();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 3500);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*, jobs!customer_id(id, quoted_price, status)")
      .eq("role", "customer")
      .order("created_at", { ascending: false });
    
    if (error) {
      showToast("Lỗi tải danh sách khách hàng: " + error.message, "error");
    } else if (data) {
      setCustomers(data as any);
    }
    setLoading(false);
  };

  const fetchCustomerJobs = async (customerId: string) => {
    setLoadingJobs(true);
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_code,
        address,
        scheduled_at,
        quoted_price,
        status,
        service:services(name, icon)
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast("Lỗi tải lịch sử công việc: " + error.message, "error");
    } else if (data) {
      setCustomerJobs(data);
    }
    setLoadingJobs(false);
  };

  const handleOpenDrawer = (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
    fetchCustomerJobs(customer.id);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedCustomer(null);
    setCustomerJobs([]);
  };

  const handleUpdateStatus = async (customer: CustomerProfile, newStatus: "active" | "blocked") => {
    setProcessing(true);
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", customer.id);

    setProcessing(false);
    setConfirmDialog(null);

    if (error) {
      showToast("Cập nhật trạng thái thất bại: " + error.message, "error");
    } else {
      showToast(
        newStatus === "blocked" 
          ? `Đã khóa tài khoản khách hàng "${customer.full_name}"` 
          : `Đã mở khóa tài khoản khách hàng "${customer.full_name}"`,
        "success"
      );
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customer.id ? { ...c, status: newStatus } : c
      ));

      if (selectedCustomer && selectedCustomer.id === customer.id) {
        setSelectedCustomer(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      customer.full_name?.toLowerCase().includes(searchLower) || 
      customer.phone?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower)
    );
     
    const customerStatus = customer.status || "active";
    const matchesStatus = statusFilter === "all" || customerStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[calc(100vh-10rem)]">
      {/* Toast Alert */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border transform transition-all duration-300 translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            toast.type === "success" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
          }`}>
            <CheckCircleIcon size={16} />
          </div>
          <span className="text-body-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Khách hàng</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản lý danh sách khách hàng, theo dõi lịch sử dịch vụ và thông tin trạng thái hoạt động
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card-elevated !p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="relative w-full xl:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <SearchIcon size={20} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, số điện thoại, email..."
            className="input-field !pl-10 !py-2.5 !rounded-xl w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {["all", "active", "blocked"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${
                statusFilter === status 
                  ? "bg-primary-container text-on-primary-container border-primary-container shadow-sm" 
                  : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
              }`}
            >
              {status === "all" ? "Tất cả" :
               status === "active" ? "Đang hoạt động" : "Đã khóa"}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-64">
             <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Khách hàng</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Liên hệ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Ngày đăng ký</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Lịch sử đặt việc</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-outline">
                          <UserIcon size={32} />
                        </div>
                        <p className="text-body-md font-medium">Không tìm thấy khách hàng nào phù hợp.</p>
                        <button 
                          onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                          className="mt-2 text-primary font-bold hover:underline"
                        >
                          Xóa bộ lọc
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredCustomers.map((customer) => {
                  const jobCount = customer.jobs ? customer.jobs.length : 0;
                  const cStatus = customer.status || "active";

                  return (
                    <tr 
                      key={customer.id} 
                      onClick={() => handleOpenDrawer(customer)}
                      className="hover:bg-surface-container-lowest transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-sm font-bold text-secondary-container uppercase shadow-sm">
                              {customer.full_name ? customer.full_name[0] : "C"}
                            </div>
                            {cStatus === "active" && (
                              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                <CheckCircleIcon size={12} className="text-success" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span 
                              className="text-body-md text-on-surface font-bold hover:text-primary cursor-pointer block"
                              onClick={() => handleOpenDrawer(customer)}
                            >
                              {customer.full_name || "Khách vãng lai"}
                            </span>
                            <span className="text-label-sm text-on-surface-variant font-mono mt-0.5 block">
                              {customer.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-body-sm text-on-surface font-medium">
                            <PhoneIcon size={14} className="text-on-surface-variant" />
                            {customer.phone || "Chưa cập nhật"}
                          </div>
                          {customer.address && (
                            <div className="flex items-start gap-2 text-label-sm text-on-surface-variant max-w-[200px]">
                              <MapPinIcon size={14} className="flex-shrink-0 mt-0.5" />
                              <span className="truncate">{customer.address}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-body-sm text-on-surface">
                          <CalendarIcon size={16} className="text-on-surface-variant" />
                          {new Date(customer.created_at).toLocaleDateString("vi-VN", {
                            day: "2-digit", month: "2-digit", year: "numeric"
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-body-sm font-bold text-primary-container">
                          <BriefcaseIcon size={16} />
                          {jobCount} <span className="font-normal text-on-surface-variant">lần đặt</span>
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <span className={`badge ${cStatus === "active" ? "badge-active" : "badge-blocked"} uppercase text-[10px] font-bold px-2.5 py-1`}>
                          {cStatus === "active" ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {cStatus === "active" ? (
                            <button 
                              onClick={() => setConfirmDialog({ type: "block", customer })}
                              className="px-2.5 py-1.5 text-label-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              Khóa
                            </button>
                          ) : (
                            <button 
                              onClick={() => setConfirmDialog({ type: "unblock", customer })}
                              className="px-2.5 py-1.5 text-label-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              Mở khóa
                            </button>
                          )}
                          <button 
                            onClick={() => handleOpenDrawer(customer)}
                            className="p-1.5 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary"
                          >
                            <ChevronRightIcon size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">
              Hiển thị <span className="font-bold text-on-surface">{filteredCustomers.length}</span> trên tổng số <span className="font-bold text-on-surface">{customers.length}</span> khách hàng
            </span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 transform scale-100 transition-all duration-300">
            <h3 className="text-title-lg font-bold text-on-surface">
              {confirmDialog.type === "block" ? "Khóa tài khoản khách hàng?" : "Mở khóa tài khoản?"}
            </h3>
            <p className="text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {confirmDialog.type === "block" 
                ? `Bạn có chắc chắn muốn khóa tài khoản của khách hàng "${confirmDialog.customer.full_name}"? Khách hàng này sẽ không thể đăng nhập hoặc đặt dịch vụ mới.`
                : `Mở khóa tài khoản cho khách hàng "${confirmDialog.customer.full_name}". Khách hàng có thể đăng nhập và sử dụng dịch vụ bình thường.`}
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setConfirmDialog(null)}
                disabled={processing}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border"
              >
                Hủy
              </button>
              <button 
                onClick={() => handleUpdateStatus(
                  confirmDialog.customer, 
                  confirmDialog.type === "block" ? "blocked" : "active"
                )}
                disabled={processing}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-sm ${
                  confirmDialog.type === "block" 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" 
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                }`}
              >
                {processing ? "Đang xử lý..." : confirmDialog.type === "block" ? "Khóa tài khoản" : "Mở khóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Customer Detail Drawer */}
      {drawerOpen && selectedCustomer && (
        <div className="fixed inset-0 z-40 overflow-hidden flex justify-end">
          {/* Overlay background */}
          <div 
            onClick={handleCloseDrawer}
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 animate-fade-in" 
          />

          {/* Drawer container */}
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-100 animate-slide-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-body-lg font-bold text-primary shadow-sm uppercase">
                  {selectedCustomer.full_name ? selectedCustomer.full_name[0] : "C"}
                </div>
                <div>
                  <h2 className="text-title-lg font-bold text-on-surface">{selectedCustomer.full_name}</h2>
                  <span className="text-label-sm text-on-surface-variant font-mono mt-0.5 block">ID: {selectedCustomer.id}</span>
                </div>
              </div>
              <button 
                onClick={handleCloseDrawer}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f9f9fc]">
              {/* Profile Details Card */}
              <div className="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-sm space-y-4">
                <h3 className="text-label-lg text-primary font-bold uppercase tracking-wider">Thông tin liên hệ</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-label-sm text-on-surface-variant">Địa chỉ Email</span>
                    <span className="text-body-sm text-on-surface font-bold block">{selectedCustomer.email}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-label-sm text-on-surface-variant">Số điện thoại</span>
                    <span className="text-body-sm text-on-surface font-bold block">{selectedCustomer.phone || "Chưa cập nhật"}</span>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-label-sm text-on-surface-variant">Địa chỉ liên hệ</span>
                    <span className="text-body-sm text-on-surface block font-medium">
                      {selectedCustomer.address || "Chưa cập nhật địa chỉ"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
                    <CalendarIcon size={16} />
                    <span>Thành viên từ: {new Date(selectedCustomer.created_at).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm text-on-surface-variant">Trạng thái:</span>
                    <span className={`badge ${selectedCustomer.status === "active" ? "badge-active" : "badge-blocked"} uppercase text-[10px] font-bold px-2 py-0.5`}>
                      {selectedCustomer.status === "active" ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-outline-variant/30 shadow-sm text-center">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <BriefcaseIcon size={18} />
                  </div>
                  <span className="text-label-sm text-on-surface-variant block">Đã đặt</span>
                  <span className="text-title-lg font-bold text-on-surface block mt-1">
                    {selectedCustomer.jobs ? selectedCustomer.jobs.length : 0}
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-outline-variant/30 shadow-sm text-center">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <DollarSignIcon size={18} />
                  </div>
                  <span className="text-label-sm text-on-surface-variant block">Chi tiêu</span>
                  <span className="text-title-lg font-bold text-on-surface block mt-1">
                    {selectedCustomer.jobs
                      ? (selectedCustomer.jobs
                          .filter(j => j.status === "completed" || j.status === "done")
                          .reduce((sum, j) => sum + Number(j.quoted_price || 0), 0)
                          .toLocaleString("vi-VN") + "đ")
                      : "0đ"}
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-outline-variant/30 shadow-sm text-center">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-2">
                    <ShieldCheckIcon size={18} />
                  </div>
                  <span className="text-label-sm text-on-surface-variant block">Hoàn thành</span>
                  <span className="text-title-lg font-bold text-on-surface block mt-1">
                    {selectedCustomer.jobs && selectedCustomer.jobs.length > 0
                      ? `${Math.round(
                          (selectedCustomer.jobs.filter(j => j.status === "completed" || j.status === "done").length / 
                           selectedCustomer.jobs.length) * 100
                        )}%`
                      : "0%"}
                  </span>
                </div>
              </div>

              {/* Job History List */}
              <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-lowest">
                  <h3 className="text-body-lg font-bold text-on-surface">Lịch sử đặt dịch vụ</h3>
                </div>

                {loadingJobs ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : customerJobs.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-body-sm">
                    Khách hàng này chưa thực hiện bất kỳ giao dịch đặt dịch vụ nào.
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-surface-container-low text-label-sm text-on-surface-variant border-b border-outline-variant">
                          <th className="px-5 py-3">Mã đơn</th>
                          <th className="px-5 py-3">Dịch vụ</th>
                          <th className="px-5 py-3 text-right">Chi phí</th>
                          <th className="px-5 py-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant text-body-sm">
                        {customerJobs.map(job => (
                          <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5 font-bold font-mono text-on-surface">
                              {job.job_code}
                            </td>
                            <td className="px-5 py-3.5">
                              <div>
                                <span className="font-semibold block">{job.service?.name || "Dịch vụ"}</span>
                                <span className="text-label-sm text-on-surface-variant block mt-0.5">
                                  {new Date(job.scheduled_at).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-on-surface">
                              {Number(job.quoted_price).toLocaleString("vi-VN")}đ
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`badge ${
                                job.status === "completed" || job.status === "done" ? "badge-active" : 
                                job.status === "pending" ? "bg-amber-100 text-amber-700" :
                                job.status === "cancelled" ? "badge-blocked" : "bg-blue-100 text-blue-700"
                              } uppercase text-[9px] font-bold px-2 py-0.5`}>
                                {job.status === "completed" || job.status === "done" ? "Hoàn thành" :
                                 job.status === "pending" ? "Đang chờ" :
                                 job.status === "cancelled" ? "Đã hủy" : "Đang làm"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer Drawer Actions */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex justify-between items-center">
              <span className="text-label-sm text-on-surface-variant">Lưu ý: Mọi tác vụ khóa đều được lưu nhật ký.</span>
              <div className="flex gap-2">
                {selectedCustomer.status === "active" ? (
                  <button 
                    onClick={() => setConfirmDialog({ type: "block", customer: selectedCustomer })}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-rose-100"
                  >
                    Khóa tài khoản
                  </button>
                ) : (
                  <button 
                    onClick={() => setConfirmDialog({ type: "unblock", customer: selectedCustomer })}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-emerald-100"
                  >
                    Mở khóa tài khoản
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

