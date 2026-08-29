"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  buildWorkerSpecialtyGroups,
  expandWorkerSpecialties,
  inferWorkerSpecialtyChildValues,
  inferWorkerSpecialtyParentIds,
  type WorkerSpecialtyGroup,
} from "@/lib/worker-specialty-catalog";
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  UserIcon,
  PhoneIcon,
  StarIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CalendarIcon,
  XIcon
} from "../../components/icons";

type WorkerProfile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  avatar_url?: string | null;
  email?: string | null;
};

type WorkerRecord = {
  id: string;
  user_id: string;
  specialties?: string[] | null;
  status: "active" | "pending" | "blocked" | string;
  approved_at?: string | null;
  created_at?: string | null;
  avg_rating?: number | null;
  total_jobs?: number | null;
  rejection_reason?: string | null;
  profiles?: WorkerProfile | null;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Lỗi không xác định";

const normalizeWorkerStatus = (status?: string | null): "active" | "pending" | "blocked" =>
  status === "pending" || status === "blocked" ? status : "active";
const ADMIN_WORKERS_PAGE_SIZE = 100;

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  // Approval/Rejection states
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'approve' | 'reject' | 'block' | 'unblock'; worker: WorkerRecord } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  // Edit worker states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerRecord | null>(null);
  const [editWorkerFormData, setEditWorkerFormData] = useState({
    id: "",
    user_id: "",
    name: "",
    phone: "",
    address: "",
    specialties: [] as string[],
    status: "active" as "active" | "pending" | "blocked"
  });

  // Reset password states
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resetPasswordWorker, setResetPasswordWorker] = useState<WorkerRecord | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("123456");
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleOpenEditModal = (worker: WorkerRecord) => {
    setEditingWorker(worker);
    setEditWorkerFormData({
      id: worker.id,
      user_id: worker.user_id,
      name: worker.profiles?.full_name || "",
      phone: worker.profiles?.phone || "",
      address: worker.profiles?.address || "",
      specialties: worker.specialties || [],
      status: normalizeWorkerStatus(worker.status)
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerFormData.name) {
      showToast("Họ và tên không được để trống", "error");
      return;
    }
    if (!editingWorker) {
      showToast("Không tìm thấy thợ cần cập nhật", "error");
      return;
    }

    setProcessing(true);

    try {
      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editWorkerFormData.name,
          phone: editWorkerFormData.phone || null,
          address: editWorkerFormData.address || null,
          status: editWorkerFormData.status === 'blocked' ? 'blocked' : 'active'
        })
        .eq('id', editWorkerFormData.user_id);

      if (profileError) {
        showToast("Lỗi cập nhật hồ sơ: " + profileError.message, "error");
        setProcessing(false);
        return;
      }

      // 2. Update workers table
      const approvedAt = editWorkerFormData.status === 'active' && editingWorker.status !== 'active' 
        ? new Date().toISOString() 
        : editingWorker.approved_at;
        
      const { error: workerError } = await supabase
        .from('workers')
        .update({
          specialties: editWorkerFormData.specialties,
          status: editWorkerFormData.status,
          approved_at: approvedAt
        })
        .eq('id', editWorkerFormData.id);

      if (workerError) {
        showToast("Lỗi cập nhật chi tiết thợ: " + workerError.message, "error");
        setProcessing(false);
        return;
      }

      showToast(`Cập nhật thông tin thợ "${editWorkerFormData.name}" thành công!`, 'success');
      setIsEditModalOpen(false);
      
      // Update local state
      setWorkers(prev => prev.map(w =>
        w.id === editWorkerFormData.id
          ? {
              ...w,
              specialties: editWorkerFormData.specialties,
              status: editWorkerFormData.status,
              approved_at: approvedAt,
              profiles: {
                ...w.profiles,
                full_name: editWorkerFormData.name,
                phone: editWorkerFormData.phone || null,
                address: editWorkerFormData.address || null,
                status: editWorkerFormData.status === 'blocked' ? 'blocked' : 'active'
              }
            }
          : w
      ));
    } catch (err: unknown) {
      showToast("Lỗi hệ thống: " + getErrorMessage(err), "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenResetPasswordModal = (worker: WorkerRecord) => {
    setResetPasswordWorker(worker);
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
    if (!resetPasswordWorker) {
      showToast("Không tìm thấy thợ cần reset mật khẩu", "error");
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
          userId: resetPasswordWorker.user_id,
          newPassword: newPasswordValue,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Đã reset mật khẩu cho thợ "${resetPasswordWorker.profiles?.full_name}" thành công!`, "success");
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

  // Add new worker states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newWorkerFormData, setNewWorkerFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    specialties: [] as string[],
    status: "active" as "active" | "pending"
  });
  const [specialtyGroups, setSpecialtyGroups] = useState<WorkerSpecialtyGroup[]>(() => buildWorkerSpecialtyGroups());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3500);
  };

  const fetchWorkers = async () => {
    setLoading(true);
    const query = supabase
      .from('workers')
      .select('id, user_id, specialties, status, approved_at, created_at, avg_rating, total_jobs, rejection_reason, profiles(full_name, phone, address, status, avatar_url, email)')
      .order('created_at', { ascending: false })
      .range(0, ADMIN_WORKERS_PAGE_SIZE - 1);

    const { data } = await query;
    if (data) setWorkers(data as WorkerRecord[]);
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, parent_service_id")
      .eq("is_active", true);

    if (data && !error) {
      setSpecialtyGroups(buildWorkerSpecialtyGroups(data));
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    void Promise.all([fetchWorkers(), fetchServices()]);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const renderSpecialtySelector = (
    selectedSpecialties: string[],
    onChange: (nextSpecialties: string[]) => void,
  ) => {
    const selectedParentIds = inferWorkerSpecialtyParentIds(selectedSpecialties, specialtyGroups);
    const selectedChildValues = inferWorkerSpecialtyChildValues(selectedSpecialties, specialtyGroups);

    const updateSelection = (nextParentIds: string[], nextChildValues: string[]) => {
      onChange(expandWorkerSpecialties(nextParentIds, nextChildValues, specialtyGroups, selectedSpecialties));
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {specialtyGroups.map(group => {
            const isSelected = selectedParentIds.includes(group.id);
            const selectedChildrenCount = group.children.filter(child => selectedChildValues.includes(child.value)).length;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  const nextParentIds = isSelected
                    ? selectedParentIds.filter(id => id !== group.id)
                    : [...selectedParentIds, group.id];
                  const nextChildValues = isSelected
                    ? selectedChildValues.filter(value => !group.children.some(child => child.value === value))
                    : selectedChildValues;
                  updateSelection(nextParentIds, nextChildValues);
                }}
                className={`min-h-14 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-primary/50"
                }`}
              >
                <span className="block">{isSelected ? "✓ " : ""}{group.label}</span>
                <span className={`mt-1 block text-[10px] ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                  {selectedChildrenCount > 0 ? `${selectedChildrenCount} kỹ năng` : `${group.children.length} kỹ năng`}
                </span>
              </button>
            );
          })}
        </div>

        {selectedParentIds.length > 0 && (
          <div className="space-y-3 rounded-xl border border-outline-variant/30 bg-white p-3">
            {specialtyGroups
              .filter(group => selectedParentIds.includes(group.id))
              .map(group => (
                <div key={`admin-worker-${group.id}`} className="space-y-2">
                  <p className="text-xs font-extrabold uppercase text-on-surface-variant">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.children.map(child => {
                      const isSelected = selectedChildValues.includes(child.value);
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            const nextParentIds = selectedParentIds.includes(group.id) ? selectedParentIds : [...selectedParentIds, group.id];
                            const nextChildValues = isSelected
                              ? selectedChildValues.filter(value => value !== child.value)
                              : [...selectedChildValues, child.value];
                            updateSelection(nextParentIds, nextChildValues);
                          }}
                          className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all ${
                            isSelected
                              ? "border-secondary-container bg-secondary-container text-white"
                              : "border-outline-variant/50 bg-white text-on-surface-variant hover:border-secondary-container/50"
                          }`}
                        >
                          {isSelected ? "✓ " : ""}{child.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="rounded-xl bg-primary-fixed/70 p-3">
          <p className="text-[10px] font-bold uppercase text-primary-container/75">Đã chọn</p>
          <p className="mt-1 text-xs font-bold text-primary-container">
            {selectedSpecialties.length > 0 ? selectedSpecialties.join(", ") : "Chưa chọn chuyên môn"}
          </p>
        </div>
      </div>
    );
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerFormData.name || !newWorkerFormData.email || !newWorkerFormData.password) {
      showToast("Vui lòng nhập đầy đủ thông tin bắt buộc", "error");
      return;
    }
    if (newWorkerFormData.password.length < 6) {
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
        email: newWorkerFormData.email,
        password: newWorkerFormData.password,
        options: {
          data: {
            full_name: newWorkerFormData.name,
            role: 'worker',
            specialties: newWorkerFormData.specialties
          }
        }
      });

      if (authError) {
        showToast("Lỗi đăng ký: " + authError.message, "error");
        setProcessing(false);
        return;
      }

      if (authData.user) {
        // Update profile
        await supabase
          .from('profiles')
          .update({
            phone: newWorkerFormData.phone || null,
            address: newWorkerFormData.address || null,
            status: 'active'
          })
          .eq('id', authData.user.id);

        // Update worker details
        const approvedAt = newWorkerFormData.status === 'active' ? new Date().toISOString() : null;
        await supabase
          .from('workers')
          .update({
            specialties: newWorkerFormData.specialties,
            status: newWorkerFormData.status,
            approved_at: approvedAt
          })
          .eq('user_id', authData.user.id);

        showToast(`Đã thêm thợ "${newWorkerFormData.name}" thành công!`, 'success');
        setIsAddModalOpen(false);
        setNewWorkerFormData({
          name: "",
          email: "",
          password: "",
          phone: "",
          address: "",
          specialties: [] as string[],
          status: "active"
        });
        fetchWorkers();
      }
    } catch (err: unknown) {
      showToast("Lỗi hệ thống: " + getErrorMessage(err), "error");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveWorker = async (worker: WorkerRecord) => {
    setProcessing(true);
    const approvedAt = new Date().toISOString();
    const shouldSendApprovalEmail = worker.status !== 'active' && !worker.approved_at;
    const { error } = await supabase
      .from('workers')
      .update({ status: 'active', approved_at: approvedAt })
      .eq('id', worker.id);

    setProcessing(false);
    setConfirmDialog(null);

    if (error) {
      showToast('Lỗi khi duyệt thợ: ' + error.message, 'error');
      console.error(error);
    } else {
      if (shouldSendApprovalEmail) {
        void fetch("/api/notifications/account-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template: "worker_approved", userId: worker.user_id }),
        }).catch(() => undefined);
      }
      showToast(`Đã duyệt thợ "${worker.profiles?.full_name}" thành công!`, 'success');
      // Optimistic UI update
      setWorkers(prev => prev.map(w =>
        w.id === worker.id ? { ...w, status: 'active', approved_at: approvedAt } : w
      ));
    }
  };
  const handleRejectWorker = async (worker: WorkerRecord) => {
    setProcessing(true);
    const { error } = await supabase
      .from('workers')
      .update({ status: 'blocked', rejection_reason: rejectionReason || null })
      .eq('id', worker.id);

    setProcessing(false);
    setConfirmDialog(null);
    setRejectionReason("");

    if (error) {
      showToast('Lỗi khi từ chối thợ: ' + error.message, 'error');
      console.error(error);
    } else {
      void fetch("/api/notifications/account-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "worker_rejected", userId: worker.user_id, reason: rejectionReason || null }),
      }).catch(() => undefined);
      showToast(`Đã từ chối thợ "${worker.profiles?.full_name}".`, 'success');
      setWorkers(prev => prev.map(w =>
        w.id === worker.id ? { ...w, status: 'blocked', rejection_reason: rejectionReason || null } : w
      ));
    }
  };

  const handleToggleBlockWorker = async (worker: WorkerRecord, newStatus: 'active' | 'blocked') => {
    setProcessing(true);
    
    // Update workers table
    const { error: workerError } = await supabase
      .from('workers')
      .update({ status: newStatus })
      .eq('id', worker.id);

    if (workerError) {
      showToast('Lỗi cập nhật trạng thái thợ: ' + workerError.message, 'error');
      setProcessing(false);
      setConfirmDialog(null);
      return;
    }

    // Update profiles table
    if (worker.user_id) {
      await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', worker.user_id);
    }

    setProcessing(false);
    setConfirmDialog(null);
    showToast(newStatus === 'blocked' ? `Đã khóa thợ "${worker.profiles?.full_name}"` : `Đã mở khóa thợ "${worker.profiles?.full_name}"`, 'success');
    
    // Update local state
    setWorkers(prev => prev.map(w =>
      w.id === worker.id ? { ...w, status: newStatus, profiles: { ...w.profiles, status: newStatus } } : w
    ));
  };

  const filteredWorkers = workers.filter(worker => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      worker.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      worker.profiles?.phone?.toLowerCase().includes(searchLower) ||
      (worker.specialties && worker.specialties.some((s: string) => s.toLowerCase().includes(searchLower)))
    );

    const matchesStatus = statusFilter === 'all' || worker.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-5 py-3.5 rounded-lg shadow-elevated border animate-fade-in flex items-center gap-3 ${toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/25' : 'bg-error-container text-on-error-container border-error/25'
          }`}>
          {toast.type === 'success' ? <CheckCircleIcon size={20} /> : <XIcon size={20} />}
          <span className="text-body-sm font-bold">{toast.message}</span>
        </div>
      )}
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Quản lý Thợ</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Duyệt, quản lý, và theo dõi đội ngũ thợ trên hệ thống
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary !py-2.5 !px-5 flex items-center gap-2"
        >
          <PlusIcon size={20} />
          <span>Thêm thợ mới</span>
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
            placeholder="Tìm theo tên, số điện thoại, chuyên môn..."
            className="input-field !pl-10 !py-2.5 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {['all', 'pending', 'active', 'blocked'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${statusFilter === status
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-sm'
                  : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                }`}
            >
              {status === 'all' ? 'Tất cả' :
                status === 'pending' ? 'Chờ duyệt' :
                  status === 'active' ? 'Hoạt động' : 'Đã khóa'}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
            <FilterIcon size={16} /> Lọc thêm
          </button>
        </div>
      </div>

      {/* Workers Table */}
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
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Hồ sơ Thợ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Chuyên môn</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Hiệu suất</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Ngày tham gia</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-outline">
                          <UserIcon size={32} />
                        </div>
                        <p className="text-body-md font-medium">Không tìm thấy thợ nào phù hợp.</p>
                        <button
                          onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                          className="mt-2 text-primary-container font-bold hover:underline"
                        >
                          Xóa bộ lọc
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {worker.profiles?.avatar_url ? (
                            <Image
                              src={worker.profiles.avatar_url}
                              alt={worker.profiles.full_name || 'Worker avatar'}
                              width={48}
                              height={48}
                              sizes="48px"
                              className="w-12 h-12 rounded-full object-cover shadow-sm border border-outline-variant/30"
                              unoptimized
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-lg font-bold text-primary-container uppercase shadow-sm">
                              {worker.profiles?.full_name ? worker.profiles.full_name[0] : 'W'}
                            </div>
                          )}
                          {worker.status === 'active' && (
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckCircleIcon size={14} className="text-success" />
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-body-md text-on-surface font-bold block">{worker.profiles?.full_name || 'Chưa cập nhật'}</span>
                          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mt-0.5">
                            <PhoneIcon size={12} />
                            {worker.profiles?.phone || 'Chưa có SĐT'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        {worker.specialties && worker.specialties.length > 0 ? (
                          worker.specialties.map((spec: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-surface-container rounded-md text-[11px] font-medium text-on-surface-variant whitespace-nowrap">
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-label-sm italic text-outline">Chưa có chuyên môn</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1 text-body-sm font-bold text-on-surface">
                          <StarIcon size={14} className="text-amber-500 fill-current" />
                          {worker.avg_rating ? worker.avg_rating.toFixed(1) : '5.0'}
                        </div>
                        <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                          <BriefcaseIcon size={12} />
                          {worker.total_jobs || 0} jobs hoàn thành
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                        <CalendarIcon size={14} />
                        {worker.created_at
                          ? new Date(worker.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            })
                          : "Chưa có"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${worker.status} uppercase text-[10px] font-bold px-2.5 py-1`}>
                        {worker.status === "pending" ? "Chờ duyệt" :
                          worker.status === "active" ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {worker.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setConfirmDialog({ type: 'approve', worker })}
                            className="px-3 py-1.5 rounded-lg bg-success-container text-success text-xs font-bold hover:brightness-95 transition-all"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => setConfirmDialog({ type: 'reject', worker })}
                            className="px-3 py-1.5 rounded-lg bg-error-container text-error text-xs font-bold hover:brightness-95 transition-all"
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {worker.status === 'active' ? (
                            <button
                              onClick={() => setConfirmDialog({ type: 'block', worker })}
                              className="px-2.5 py-1.5 text-label-sm font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              Khóa
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDialog({ type: 'unblock', worker })}
                              className="px-2.5 py-1.5 text-label-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              Mở khóa
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenResetPasswordModal(worker)}
                            className="px-2.5 py-1.5 text-label-sm font-bold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            Đổi MK
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(worker)}
                            className="px-2.5 py-1.5 text-label-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          >
                            Sửa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination placeholder */}
        {!loading && filteredWorkers.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">Hiển thị <span className="font-bold text-on-surface">{filteredWorkers.length}</span> kết quả</span>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang trước</button>
              <button className="px-3 py-1.5 rounded-lg text-sm bg-primary-container text-on-primary-container font-bold shadow-sm">1</button>
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang sau</button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  confirmDialog.type === 'approve' || confirmDialog.type === 'unblock'
                    ? 'bg-success-container text-success'
                    : 'bg-error-container text-error'
                  }`}>
                  {confirmDialog.type === 'approve' || confirmDialog.type === 'unblock' ? <CheckCircleIcon size={24} /> : <XIcon size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">
                    {confirmDialog.type === 'approve' ? 'Duyệt thợ?' :
                     confirmDialog.type === 'reject' ? 'Từ chối thợ?' :
                     confirmDialog.type === 'block' ? 'Khóa thợ?' : 'Mở khóa thợ?'}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">
                    {confirmDialog.worker.profiles?.full_name}
                  </p>
                </div>
              </div>

              {confirmDialog.type === 'approve' && (
                <p className="text-body-sm text-on-surface-variant">
                  Sau khi duyệt, thợ sẽ có thể truy cập hệ thống và nhận việc. Bạn có chắc chắn?
                </p>
              )}

              {confirmDialog.type === 'reject' && (
                <div className="space-y-2">
                  <p className="text-body-sm text-on-surface-variant">
                    Thợ sẽ bị từ chối duyệt và chuyển vào trạng thái khóa.
                  </p>
                  <label className="text-sm font-bold text-on-surface block">Lý do từ chối (tùy chọn)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="VD: Thiếu chứng chỉ, thông tin không hợp lệ..."
                    className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-body-sm min-h-[80px] resize-none"
                  />
                </div>
              )}

              {confirmDialog.type === 'block' && (
                <p className="text-body-sm text-on-surface-variant">
                  Tài khoản của thợ này sẽ bị khóa. Họ sẽ không thể đăng nhập hoặc nhận các công việc mới trên hệ thống. Bạn có chắc chắn?
                </p>
              )}

              {confirmDialog.type === 'unblock' && (
                <p className="text-body-sm text-on-surface-variant">
                  Mở khóa tài khoản cho thợ này. Họ sẽ có thể đăng nhập và nhận việc bình thường. Bạn có chắc chắn?
                </p>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button
                onClick={() => { setConfirmDialog(null); setRejectionReason(""); }}
                className="btn-outline !py-2 !px-4 text-sm"
                disabled={processing}
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (confirmDialog.type === 'approve') {
                    handleApproveWorker(confirmDialog.worker);
                  } else if (confirmDialog.type === 'reject') {
                    handleRejectWorker(confirmDialog.worker);
                  } else if (confirmDialog.type === 'block') {
                    handleToggleBlockWorker(confirmDialog.worker, 'blocked');
                  } else if (confirmDialog.type === 'unblock') {
                    handleToggleBlockWorker(confirmDialog.worker, 'active');
                  }
                }}
                className={`!py-2 !px-5 text-sm min-w-[120px] font-bold rounded-xl border transition-all ${
                  confirmDialog.type === 'approve' || confirmDialog.type === 'unblock'
                    ? 'bg-success text-white border-success hover:brightness-95'
                    : 'bg-error text-white border-error hover:brightness-95'
                  }`}
                disabled={processing}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang xử lý...
                  </span>
                ) : confirmDialog.type === 'approve' ? 'Xác nhận duyệt' : 
                     confirmDialog.type === 'reject' ? 'Từ chối' : 
                     confirmDialog.type === 'block' ? 'Khóa thợ' : 'Mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <PlusIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Thêm thợ mới</h3>
                  <p className="text-xs text-on-surface-variant">Tạo hồ sơ và tài khoản truy cập cho thợ mới</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <form onSubmit={handleCreateWorker} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-4">
                {/* Name & Email */}
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
                      value={newWorkerFormData.name}
                      onChange={(e) => setNewWorkerFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface flex items-center gap-1">
                      Email đăng nhập <span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="tho@alotho.vn"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={newWorkerFormData.email}
                      onChange={(e) => setNewWorkerFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Password & Phone */}
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
                      value={newWorkerFormData.password}
                      onChange={(e) => setNewWorkerFormData(prev => ({ ...prev, password: e.target.value }))}
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
                      value={newWorkerFormData.phone}
                      onChange={(e) => setNewWorkerFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface">
                    Địa chỉ liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="Q. Bình Thạnh, TP. Hồ Chí Minh"
                    className="input-field !py-2.5 !rounded-xl text-sm"
                    value={newWorkerFormData.address}
                    onChange={(e) => setNewWorkerFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                {/* Specialties */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface block">
                    Chuyên môn sửa chữa
                  </label>
                  {renderSpecialtySelector(newWorkerFormData.specialties, specialties =>
                    setNewWorkerFormData(prev => ({ ...prev, specialties }))
                  )}
                </div>

                {/* Initial Status */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface">
                    Trạng thái kích hoạt
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewWorkerFormData(prev => ({ ...prev, status: "active" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        newWorkerFormData.status === "active"
                          ? "bg-success-container text-success border-success/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CheckCircleIcon size={16} />
                      Hoạt động ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWorkerFormData(prev => ({ ...prev, status: "pending" }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        newWorkerFormData.status === "pending"
                          ? "bg-surface-container-high text-on-surface-variant border-outline-variant/40 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CalendarIcon size={16} />
                      Chờ phê duyệt
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest -mx-6 -mb-6 p-4 rounded-b-2xl">
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
      )}

      {/* Edit Worker Modal */}
      {isEditModalOpen && editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Chỉnh sửa thông tin thợ</h3>
                  <p className="text-xs text-on-surface-variant">Cập nhật thông tin chi tiết và trạng thái thợ</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <form onSubmit={handleUpdateWorker} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-4">
                {/* Name & Email (Disabled) */}
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
                      value={editWorkerFormData.name}
                      onChange={(e) => setEditWorkerFormData(prev => ({ ...prev, name: e.target.value }))}
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
                      value={editingWorker.profiles?.email || ""}
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
                      value={editWorkerFormData.phone}
                      onChange={(e) => setEditWorkerFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-on-surface">
                      Địa chỉ liên hệ
                    </label>
                    <input
                      type="text"
                      placeholder="Q. Bình Thạnh, TP. Hồ Chí Minh"
                      className="input-field !py-2.5 !rounded-xl text-sm"
                      value={editWorkerFormData.address}
                      onChange={(e) => setEditWorkerFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Specialties */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface block">
                    Chuyên môn sửa chữa
                  </label>
                  {renderSpecialtySelector(editWorkerFormData.specialties, specialties =>
                    setEditWorkerFormData(prev => ({ ...prev, specialties }))
                  )}
                </div>

                {/* Status Selection */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface block">
                    Trạng thái hoạt động
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditWorkerFormData(prev => ({ ...prev, status: "active" }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        editWorkerFormData.status === "active"
                          ? "bg-success-container text-success border-success/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CheckCircleIcon size={14} />
                      Hoạt động
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditWorkerFormData(prev => ({ ...prev, status: "pending" }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        editWorkerFormData.status === "pending"
                          ? "bg-amber-100 text-amber-800 border-amber-200 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <CalendarIcon size={14} />
                      Chờ duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditWorkerFormData(prev => ({ ...prev, status: "blocked" }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        editWorkerFormData.status === "blocked"
                          ? "bg-error-container text-error border-error/30 shadow-sm"
                          : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      <XIcon size={14} />
                      Bị khóa
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
      {resetPasswordModalOpen && resetPasswordWorker && (
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
                Thiết lập lại mật khẩu cho thợ <strong className="text-on-surface">{resetPasswordWorker.profiles?.full_name}</strong>.
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

