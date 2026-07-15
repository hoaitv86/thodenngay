"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { formatBillGoCurrency, getBillGoReceivableSummary } from "@/lib/billgo";
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
  ShieldCheckIcon,
  PlusIcon
} from "../../components/icons";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  status: "active" | "blocked";
  created_at: string;
  avatar_url?: string | null;
  jobs: {
    id: string;
    quoted_price: number;
    status: string;
  }[];
}

type CustomerJobRow = {
  id: string;
  job_code?: string | null;
  address?: string | null;
  scheduled_at?: string | null;
  quoted_price?: number | string | null;
  final_amount?: number | string | null;
  status?: string | null;
  service?: { name?: string | null; icon?: string | null } | null;
  payments?: Array<{
    id: string;
    amount: number | string;
    method: string;
    status: string;
    paid_at?: string | null;
    note?: string | null;
  }> | null;
};

type CustomerBillGoRow = {
  id: string;
  title?: string | null;
  type?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
  note?: string | null;
  subscription?: { package_name?: string | null; next_due_date?: string | null } | null;
  payments?: Array<{
    id: string;
    amount: number | string;
    method: string;
    status: string;
    paid_at?: string | null;
    note?: string | null;
  }> | null;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Lỗi không xác định";

const ADMIN_CUSTOMERS_PAGE_SIZE = 50;
const CUSTOMER_DETAIL_LIMIT = 50;

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Selected customer & drawer details
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerJobs, setCustomerJobs] = useState<CustomerJobRow[]>([]);
  const [customerBillGoRows, setCustomerBillGoRows] = useState<CustomerBillGoRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Modals & Confirm states
  const [confirmDialog, setConfirmDialog] = useState<{ type: "block" | "unblock" | "delete"; customer: CustomerProfile } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({ message: "", type: null });
  const [processing, setProcessing] = useState(false);

  // Add customer states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustomerFormData, setNewCustomerFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    status: "active" as "active" | "blocked"
  });

  // Edit customer states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [editCustomerFormData, setEditCustomerFormData] = useState({
    id: "",
    name: "",
    phone: "",
    address: "",
    status: "active" as "active" | "blocked"
  });

  // Reset password states
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resetPasswordCustomer, setResetPasswordCustomer] = useState<CustomerProfile | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("123456");
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerFormData.name || !newCustomerFormData.email || !newCustomerFormData.password) {
      showToast("Vui lòng nhập đầy đủ thông tin bắt buộc", "error");
      return;
    }
    if (newCustomerFormData.password.length < 6) {
      showToast("Mật khẩu phải có ít nhất 6 ký tự", "error");
      return;
    }

    setProcessing(true);

    try {
      // Create non-session-persisting supabase client to avoid signing out the admin
      const tempSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newCustomerFormData.email,
        password: newCustomerFormData.password,
        options: {
          data: {
            full_name: newCustomerFormData.name,
            role: 'customer'
          }
        }
      });

      if (authError) {
        showToast("Lỗi đăng ký: " + authError.message, "error");
        setProcessing(false);
        return;
      }

      if (authData.user) {
        // Update profile with status, phone, address
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone: newCustomerFormData.phone || null,
            address: newCustomerFormData.address || null,
            status: newCustomerFormData.status
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error("Error updating profile details:", profileError);
        }

        showToast(`Đã thêm khách hàng "${newCustomerFormData.name}" thành công!`, 'success');
        setIsAddModalOpen(false);
        setNewCustomerFormData({
          name: "",
          email: "",
          password: "",
          phone: "",
          address: "",
          status: "active"
        });
        // eslint-disable-next-line react-hooks/immutability
        fetchCustomers();
      }
    } catch (err: unknown) {
      showToast("Lỗi hệ thống: " + getErrorMessage(err), "error");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenEditModal = (customer: CustomerProfile) => {
    setEditingCustomer(customer);
    setEditCustomerFormData({
      id: customer.id,
      name: customer.full_name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      status: customer.status || "active"
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomerFormData.name) {
      showToast("Họ và tên không được để trống", "error");
      return;
    }

    setProcessing(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editCustomerFormData.name,
          phone: editCustomerFormData.phone || null,
          address: editCustomerFormData.address || null,
          status: editCustomerFormData.status
        })
        .eq('id', editCustomerFormData.id);

      if (profileError) {
        showToast("Lỗi cập nhật: " + profileError.message, "error");
        setProcessing(false);
        return;
      }

      showToast(`Cập nhật thông tin khách hàng "${editCustomerFormData.name}" thành công!`, 'success');
      setIsEditModalOpen(false);
      
      // Update local state
      setCustomers(prev => prev.map(c =>
        c.id === editCustomerFormData.id
          ? {
              ...c,
              full_name: editCustomerFormData.name,
              phone: editCustomerFormData.phone || "",
              address: editCustomerFormData.address || "",
              status: editCustomerFormData.status
            }
          : c
      ));

      if (selectedCustomer && selectedCustomer.id === editCustomerFormData.id) {
        setSelectedCustomer(prev => prev ? {
          ...prev,
          full_name: editCustomerFormData.name,
          phone: editCustomerFormData.phone || "",
          address: editCustomerFormData.address || "",
          status: editCustomerFormData.status
        } : null);
      }
    } catch (err: unknown) {
      showToast("Lỗi hệ thống: " + getErrorMessage(err), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenResetPasswordModal = (customer: CustomerProfile) => {
    setResetPasswordCustomer(customer);
    setNewPasswordValue("123456");
    setResetPasswordModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordValue) {
      showToast("Mật khẩu không được để trống", "error");
      return;
    }
    if (newPasswordValue.length < 6) {
      showToast("Mật khẩu phải từ 6 ký tự trở lên", "error");
      return;
    }

    setResettingPassword(true);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: resetPasswordCustomer?.id,
          newPassword: newPasswordValue,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Đã reset mật khẩu cho khách hàng "${resetPasswordCustomer?.full_name}" thành công!`, "success");
        setResetPasswordModalOpen(false);
      } else {
        showToast(data.error || "Không thể reset mật khẩu.", "error");
      }
    } catch (err: unknown) {
      showToast("Lỗi kết nối: " + getErrorMessage(err), "error");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteCustomer = async (customer: CustomerProfile) => {
    setProcessing(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", customer.id);

      setProcessing(false);
      setConfirmDialog(null);

      if (error) {
        if (error.code === "23503") {
          showToast("Không thể xóa khách hàng này vì đã có lịch sử đặt việc. Hãy khóa tài khoản thay thế.", "error");
        } else {
          showToast("Lỗi khi xóa khách hàng: " + error.message, "error");
        }
        console.error(error);
      } else {
        showToast(`Đã xóa khách hàng "${customer.full_name}" thành công!`, "success");
        setCustomers(prev => prev.filter(c => c.id !== customer.id));
        if (selectedCustomer && selectedCustomer.id === customer.id) {
          handleCloseDrawer();
        }
      }
    } catch (err: unknown) {
      showToast("Lỗi hệ thống: " + getErrorMessage(err), "error");
      setProcessing(false);
      setConfirmDialog(null);
    }
  };

  const supabase = createClient();

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 3500);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        fetchCustomers();
      }
    };

    window.addEventListener("focus", fetchCustomers);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    const channel = supabase
      .channel("admin-customer-profile-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: "role=eq.customer" },
        () => fetchCustomers()
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", fetchCustomers);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, address, status, created_at, avatar_url, jobs!customer_id(id, quoted_price, status)")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .range(0, ADMIN_CUSTOMERS_PAGE_SIZE - 1);
    
    if (error) {
      showToast("Lỗi tải danh sách khách hàng: " + error.message, "error");
    } else if (data) {
      setCustomers(data as CustomerProfile[]);
    }
    setLoading(false);
  }

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
        final_amount,
        status,
        service:services!jobs_service_id_fkey(name, icon),
        payments(id, amount, method, status, paid_at, note)
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .range(0, CUSTOMER_DETAIL_LIMIT - 1);

    if (error) {
      showToast("Lỗi tải lịch sử công việc: " + error.message, "error");
    } else if (data) {
      setCustomerJobs(data.map(job => ({
        ...job,
        service: Array.isArray(job.service) ? job.service[0] || null : job.service,
      })) as CustomerJobRow[]);
    }

    const { data: billGoData, error: billGoError } = await supabase
      .from("billgo_receivables")
      .select("id, title, type, total_amount, due_date, status, note, subscription:billgo_subscriptions(package_name, next_due_date), payments(id, amount, method, status, paid_at, note)")
      .eq("customer_id", customerId)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true })
      .range(0, CUSTOMER_DETAIL_LIMIT - 1);

    if (billGoError) {
      setCustomerBillGoRows([]);
    } else {
      setCustomerBillGoRows((billGoData || []) as CustomerBillGoRow[]);
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
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary !py-2.5 !px-5 !rounded-xl flex items-center gap-2"
        >
          <PlusIcon size={20} />
          <span>Thêm khách hàng</span>
        </button>
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
                          <div className="relative shrink-0">
                            {customer.avatar_url ? (
                              <Image
                                src={customer.avatar_url}
                                alt={customer.full_name || 'Customer avatar'}
                                width={40}
                                height={40}
                                sizes="40px"
                                className="w-10 h-10 rounded-full object-cover shadow-sm border border-outline-variant/30"
                                unoptimized
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-sm font-bold text-secondary-container uppercase shadow-sm">
                                {customer.full_name ? customer.full_name[0] : "C"}
                              </div>
                            )}
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
                        <div className="flex items-center justify-end gap-1.5">
                          {cStatus === "active" ? (
                            <button 
                              onClick={() => setConfirmDialog({ type: "block", customer })}
                              className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              Khóa
                            </button>
                          ) : (
                            <button 
                              onClick={() => setConfirmDialog({ type: "unblock", customer })}
                              className="px-2 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              Mở khóa
                            </button>
                          )}
                          <button 
                            onClick={() => handleOpenResetPasswordModal(customer)}
                            className="px-2 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            Đổi MK
                          </button>
                          <button 
                            onClick={() => handleOpenEditModal(customer)}
                            className="px-2 py-1 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          >
                            Sửa
                          </button>
                          <button 
                            onClick={() => setConfirmDialog({ type: "delete", customer })}
                            className="px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            Xóa
                          </button>
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
              {confirmDialog.type === "block" ? "Khóa tài khoản khách hàng?" : 
               confirmDialog.type === "unblock" ? "Mở khóa tài khoản?" : "Xóa khách hàng?"}
            </h3>
            <p className="text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {confirmDialog.type === "block" 
                ? `Bạn có chắc chắn muốn khóa tài khoản của khách hàng "${confirmDialog.customer.full_name}"? Khách hàng này sẽ không thể đăng nhập hoặc đặt dịch vụ mới.`
                : confirmDialog.type === "unblock"
                  ? `Mở khóa tài khoản cho khách hàng "${confirmDialog.customer.full_name}". Khách hàng có thể đăng nhập và sử dụng dịch vụ bình thường.`
                  : `Bạn có chắc chắn muốn xóa khách hàng "${confirmDialog.customer.full_name}"? Hành động này sẽ xóa vĩnh viễn dữ liệu tài khoản khỏi hệ thống và không thể khôi phục.`}
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
                onClick={() => {
                  if (confirmDialog.type === "delete") {
                    handleDeleteCustomer(confirmDialog.customer);
                  } else {
                    handleUpdateStatus(
                      confirmDialog.customer, 
                      confirmDialog.type === "block" ? "blocked" : "active"
                    );
                  }
                }}
                disabled={processing}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-sm ${
                  confirmDialog.type === "block" || confirmDialog.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" 
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                }`}
              >
                {processing ? "Đang xử lý..." : 
                 confirmDialog.type === "block" ? "Khóa tài khoản" : 
                 confirmDialog.type === "delete" ? "Xác nhận xóa" : "Mở khóa"}
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
                <div className="relative shrink-0">
                  {selectedCustomer.avatar_url ? (
                    <Image
                      src={selectedCustomer.avatar_url}
                      alt={selectedCustomer.full_name || 'Customer avatar'}
                      width={40}
                      height={40}
                      sizes="40px"
                      className="w-10 h-10 rounded-full object-cover shadow-sm border border-outline-variant/30"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-body-lg font-bold text-primary shadow-sm uppercase">
                      {selectedCustomer.full_name ? selectedCustomer.full_name[0] : "C"}
                    </div>
                  )}
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

              {/* BillGo Payment & Debt */}
              <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-lowest">
                  <h3 className="text-body-lg font-bold text-on-surface">Thanh toán & Công nợ</h3>
                </div>
                {(() => {
                  const billGoTotals = customerBillGoRows.reduce(
                    (acc, item) => {
                      const summary = getBillGoReceivableSummary(item);
                      acc.receivable += summary.receivable;
                      acc.paid += summary.paid;
                      acc.debt += summary.debt;
                      return acc;
                    },
                    { receivable: 0, paid: 0, debt: 0 }
                  );

                  return (
                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-surface-container-low p-3">
                          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Phải thu</p>
                          <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.receivable)}</p>
                        </div>
                        <div className="rounded-xl bg-success-container p-3">
                          <p className="text-[10px] font-bold uppercase text-success">Đã thu</p>
                          <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.paid)}</p>
                        </div>
                        <div className="rounded-xl bg-error-container p-3">
                          <p className="text-[10px] font-bold uppercase text-error">Còn nợ</p>
                          <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.debt)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {customerBillGoRows.length === 0 ? (
                          <p className="text-sm text-on-surface-variant">Chưa có khoản thu nào.</p>
                        ) : customerBillGoRows.map(item => {
                          const summary = getBillGoReceivableSummary(item);
                          return (
                            <div key={`billgo-${item.id}`} className="rounded-xl border border-outline-variant/30 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-extrabold text-on-surface">{item.title || item.subscription?.package_name || item.id.slice(0, 8)}</p>
                                  <p className="text-xs text-on-surface-variant">Hạn tiếp theo: {item.due_date || item.subscription?.next_due_date || "Chưa có"}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${summary.debt > 0 ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
                                  {summary.statusLabel}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-on-surface-variant">
                                Phải thu {formatBillGoCurrency(summary.receivable)} · đã thu {formatBillGoCurrency(summary.paid)} · còn nợ {formatBillGoCurrency(summary.debt)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
                                  {job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString("vi-VN") : "Chua hen"}
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
      {/* Add Customer Modal */}
      {isAddModalOpen && typeof document !== "undefined" && createPortal((
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm px-4 py-6 sm:py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[calc(100dvh-48px)] sm:max-h-[calc(100dvh-64px)]">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <PlusIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Thêm khách hàng mới</h3>
                  <p className="text-xs text-on-surface-variant">Tạo tài khoản và hồ sơ cho khách hàng mới</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleCreateCustomer} className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {/* Họ tên & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface flex items-center gap-1">
                      Họ và tên <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={newCustomerFormData.name}
                      onChange={(e) => setNewCustomerFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface flex items-center gap-1">
                      Email đăng nhập <span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="khach@gmail.com"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={newCustomerFormData.email}
                      onChange={(e) => setNewCustomerFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Mật khẩu & Số điện thoại */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface flex items-center gap-1">
                      Mật khẩu <span className="text-error">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={newCustomerFormData.password}
                      onChange={(e) => setNewCustomerFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      placeholder="09xx xxx xxx"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={newCustomerFormData.phone}
                      onChange={(e) => setNewCustomerFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Địa chỉ */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface">
                    Địa chỉ liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="Q.1, TP. Hồ Chí Minh"
                    className="input-field !py-2.5 !rounded-xl text-sm"
                    value={newCustomerFormData.address}
                    onChange={(e) => setNewCustomerFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                {/* Trạng thái hoạt động */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface">
                    Trạng thái kích hoạt
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewCustomerFormData(prev => ({ ...prev, status: "active" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        newCustomerFormData.status === "active"
                          ? "bg-success-container text-success border-success/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CheckCircleIcon size={16} />
                      Hoạt động
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomerFormData(prev => ({ ...prev, status: "blocked" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        newCustomerFormData.status === "blocked"
                          ? "bg-error-container text-error border-error/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <XIcon size={16} />
                      Đã khóa
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-outline !py-2 !px-4 text-sm"
                  disabled={processing}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-2 !px-6 text-sm min-w-[120px]"
                  disabled={processing}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : "Xác nhận thêm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Edit Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Chỉnh sửa thông tin khách hàng</h3>
                  <p className="text-xs text-on-surface-variant">Cập nhật hồ sơ và trạng thái của khách hàng</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleUpdateCustomer} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-4">
                {/* Họ tên & Email (Disabled) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface flex items-center gap-1">
                      Họ và tên <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={editCustomerFormData.name}
                      onChange={(e) => setEditCustomerFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface">
                      Email (Không thể thay đổi)
                    </label>
                    <input
                      type="email"
                      disabled
                      className="input-field !py-2.5 !rounded-xl text-sm opacity-60 bg-surface-container cursor-not-allowed"
                      value={editingCustomer.email || ""}
                    />
                  </div>
                </div>

                {/* Phone & Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      placeholder="09xx xxx xxx"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={editCustomerFormData.phone}
                      onChange={(e) => setEditCustomerFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface">
                      Địa chỉ liên hệ
                    </label>
                    <input
                      type="text"
                      placeholder="Q.1, TP. Hồ Chí Minh"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={editCustomerFormData.address}
                      onChange={(e) => setEditCustomerFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Trạng thái hoạt động */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface">
                    Trạng thái kích hoạt
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditCustomerFormData(prev => ({ ...prev, status: "active" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        editCustomerFormData.status === "active"
                          ? "bg-success-container text-success border-success/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CheckCircleIcon size={16} />
                      Hoạt động
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCustomerFormData(prev => ({ ...prev, status: "blocked" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        editCustomerFormData.status === "blocked"
                          ? "bg-error-container text-error border-error/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <XIcon size={16} />
                      Đã khóa
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest -mx-6 -mb-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-outline !py-2 !px-4 text-sm"
                  disabled={processing}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-2 !px-6 text-sm min-w-[120px]"
                  disabled={processing}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordModalOpen && resetPasswordCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up">
            <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <h3 className="text-lg font-bold text-on-surface">Đặt lại mật khẩu</h3>
              <button
                onClick={() => setResetPasswordModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                Thiết lập lại mật khẩu cho khách hàng <strong className="text-on-surface">{resetPasswordCustomer.full_name}</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface block">
                  Mật khẩu mới <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập mật khẩu mới"
                  className="input-field !py-2.5 !rounded-xl text-sm font-mono"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  disabled={resettingPassword}
                />
              </div>

              <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest -mx-6 -mb-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setResetPasswordModalOpen(false)}
                  className="btn-outline !py-2 !px-4 text-sm"
                  disabled={resettingPassword}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-2 !px-6 text-sm min-w-[120px]"
                  disabled={resettingPassword}
                >
                  {resettingPassword ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang cập nhật...
                    </span>
                  ) : "Xác nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
