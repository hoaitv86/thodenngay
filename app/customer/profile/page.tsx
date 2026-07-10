"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getGpsLocationErrorMessage } from "@/lib/location";
import { useSettings } from "@/lib/settings";
import { formatBillGoCurrency, getBillGoReceivableSummary } from "@/lib/billgo";
import { getWarrantyStatusLabel } from "@/lib/worker-sales";
import {
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  ChevronRightIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ZapIcon,
  CameraIcon
} from "../../components/icons";

interface CustomerProfileData {
  id: string;
  email?: string;
  phone?: string | null;
  full_name: string;
  address?: string | null;
  gps_location?: GpsLocation | null;
  created_at: string;
  avatar_url?: string | null;
}

type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  captured_at?: string;
};

interface JobStat {
  id: string;
  status: string;
}

type CustomerPayment = {
  id: string;
  amount: number | string;
  method: string;
  status: string;
  paid_at?: string | null;
  note?: string | null;
};

type CustomerBillGoReceivable = {
  id: string;
  title?: string | null;
  status?: string | null;
  type?: string | null;
  total_amount?: number | string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  note?: string | null;
  subscription?: { package_name?: string | null; next_due_date?: string | null } | null;
  payments?: CustomerPayment[] | null;
};

type CustomerWarranty = {
  id: string;
  product_name: string;
  product_sku: string;
  warranty_end: string;
  status: string;
};

export default function CustomerProfile() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [locating, setLocating] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [locationMsg, setLocationMsg] = useState("");

  // UI accordion states
  const [showSupport, setShowSupport] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showWarranties, setShowWarranties] = useState(false);
  const [billGoJobs, setBillGoJobs] = useState<CustomerBillGoReceivable[]>([]);
  const [warranties, setWarranties] = useState<CustomerWarranty[]>([]);

  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfileAndStats = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch User Profile
        const { data: userProfile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profileErr && userProfile) {
          setProfile({
            ...userProfile,
            email: user.email,
          });
          setFullName(userProfile.full_name || "");
          setPhone(userProfile.phone || "");
          setAddress(userProfile.address || "");
        }

        // Fetch Customer Bookings Stats
        const { data: jobs, error: jobsErr } = await supabase
          .from("jobs")
          .select("id, status")
          .eq("customer_id", user.id);

        if (!jobsErr && jobs) {
          const total = jobs.length;
          const completed = jobs.filter((j: JobStat) => j.status === "done").length;
          const active = jobs.filter((j: JobStat) =>
            ["pending", "assigned", "in_progress"].includes(j.status)
          ).length;
          setStats({ total, completed, active });
        }

        const { data: billGoData } = await supabase
          .from("billgo_receivables")
          .select("id, title, type, total_amount, due_date, period_start, period_end, status, note, subscription:billgo_subscriptions(package_name, next_due_date), payments(id, amount, method, status, paid_at, note)")
          .eq("customer_id", user.id)
          .neq("status", "cancelled")
          .order("due_date", { ascending: true });

        if (billGoData) {
          setBillGoJobs(billGoData as CustomerBillGoReceivable[]);
        }

        const { data: warrantyData } = await supabase
          .from("worker_product_warranties")
          .select("id, product_name, product_sku, warranty_end, status")
          .eq("customer_id", user.id)
          .order("warranty_end", { ascending: false });

        if (warrantyData) {
          setWarranties(warrantyData as CustomerWarranty[]);
        }
      } catch (error) {
        console.error("Error reading profile details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndStats();
  }, [supabase, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg("Họ tên không được bỏ trống.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", user.id);

      if (error) {
        setErrorMsg("Không thể lưu thông tin. Vui lòng thử lại sau.");
        console.error("Supabase update error:", error);
      } else {
        setSuccessMsg("Cập nhật tài khoản thành công!");
        setProfile((prev: CustomerProfileData | null) => {
          if (!prev) return null;
          return {
            ...prev,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            address: address.trim() || null,
          };
        });
        setIsEditing(false);
        // Refresh standard Layout states
        router.refresh();
      }
    } catch (err) {
      setErrorMsg("Đã xảy ra lỗi ngoài ý muốn. Vui lòng kiểm tra kết nối mạng.");
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLocationMsg("");

    if (!("geolocation" in navigator)) {
      setLocationMsg("Trình duyệt không hỗ trợ định vị. Vui lòng nhập địa chỉ thủ công.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location: GpsLocation = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          captured_at: new Date().toISOString(),
        };

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLocating(false);
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ gps_location: location })
          .eq("id", user.id);

        if (error) {
          setLocationMsg(getGpsLocationErrorMessage(error));
        } else {
          setProfile((prev) => prev ? { ...prev, gps_location: location } : prev);
          setLocationMsg("Đã cập nhật vị trí hiện tại.");
        }
        setLocating(false);
      },
      () => {
        setLocationMsg("Không thể lấy vị trí. Vui lòng cấp quyền định vị và thử lại.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setUploadingAvatar(true);
      setErrorMsg("");
      setSuccessMsg("");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      // 1. Upload to Supabase storage bucket 'job-photos'
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error("Không thể tải ảnh lên: " + uploadError.message);
      }

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(filePath);

      // 3. Update profiles table avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw new Error("Không thể cập nhật ảnh đại diện: " + updateError.message);
      }

      // 4. Update local profile state
      setProfile((prev: CustomerProfileData | null) => {
        if (!prev) return null;
        return {
          ...prev,
          avatar_url: publicUrl
        };
      });

      setSuccessMsg("Cập nhật ảnh đại diện thành công!");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi ngoài ý muốn khi cập nhật ảnh.";
      setErrorMsg(msg);
      console.error("Avatar upload exception:", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword) {
      setPasswordError("Mật khẩu mới không được bỏ trống.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải dài từ 6 ký tự trở lên.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại sau.");
        console.error("Update password error:", error);
      } else {
        setPasswordSuccess("Cập nhật mật khẩu thành công!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordError("Đã xảy ra lỗi ngoài ý muốn. Vui lòng kiểm tra kết nối mạng.");
      console.error("Update password exception:", err);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] px-6 text-center">
        <p className="text-on-surface-variant text-body-md mb-4">Không tìm thấy thông tin tài khoản.</p>
        <button onClick={() => router.push("/login")} className="btn-primary w-full">
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  const joinedYear = new Date(profile.created_at).getFullYear();
  const avatarChar = profile.full_name ? profile.full_name.trim().charAt(0).toUpperCase() : "C";
  const billGoTotals = billGoJobs.reduce(
    (acc, job) => {
      const summary = getBillGoReceivableSummary(job);
      acc.receivable += summary.receivable;
      acc.paid += summary.paid;
      acc.debt += summary.debt;
      return acc;
    },
    { receivable: 0, paid: 0, debt: 0 }
  );

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-8rem)] bg-surface pb-8 animate-fade-in">
      
      {/* Profile Premium Header */}
      <div className="bg-gradient-to-br from-primary via-primary-container to-[#004ba0] text-white pt-8 pb-20 px-5 relative overflow-hidden">
        {/* Visual abstract circles background */}
        <div className="absolute w-40 h-40 bg-white/5 rounded-full -top-10 -right-10 pointer-events-none" />
        <div className="absolute w-24 h-24 bg-white/5 rounded-full bottom-2 left-1/3 pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-20 h-20 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-extrabold shadow-xl shadow-black/10 border-2 border-white/30 relative shrink-0 overflow-hidden select-none">
            {uploadingAvatar ? (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span>{avatarChar}</span>
            )}
            
            {/* Camera Overlay */}
            <label className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer select-none">
              <CameraIcon size={18} className="text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight truncate">{profile.full_name || "Khách hàng"}</h1>
            <p className="text-white/70 text-xs truncate mt-0.5">{profile.email}</p>
            <div className="mt-2.5 inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/90">
              <ShieldCheckIcon size={12} className="text-success-container" />
              <span>Thành viên từ {joinedYear}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Overlay Grid */}
      <div className="px-4 -mt-10 relative z-20">
        <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 p-4 flex justify-between">
          <div className="text-center flex-1">
            <div className="text-2xl font-extrabold text-primary">{stats.total}</div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Tổng Đơn</div>
          </div>
          <div className="w-px bg-outline-variant/40 self-stretch my-1" />
          <div className="text-center flex-1">
            <div className="text-2xl font-extrabold text-success">{stats.completed}</div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Đã Xong</div>
          </div>
          <div className="w-px bg-outline-variant/40 self-stretch my-1" />
          <div className="text-center flex-1">
            <div className="text-2xl font-extrabold text-warning">{stats.active}</div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Đang Chờ</div>
          </div>
        </div>
      </div>

      {/* Profile Form Details */}
      <div className="px-4 mt-6 space-y-4">
        <div className="card-elevated !p-5">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <UserIcon size={18} className="text-primary font-bold" />
              <span className="text-body-md font-bold text-on-surface">Thông tin tài khoản</span>
            </div>
            
            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs font-bold text-primary hover:opacity-85 transition-opacity"
              >
                Chỉnh sửa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFullName(profile.full_name || "");
                  setPhone(profile.phone || "");
                  setAddress(profile.address || "");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs font-bold text-on-surface-variant/80 hover:text-on-surface transition-colors"
              >
                Hủy bỏ
              </button>
            )}
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-error-container text-error rounded-xl text-xs font-semibold border border-error/20">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-success-container text-success rounded-xl text-xs font-semibold border border-success/20">
              {successMsg}
            </div>
          )}

          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                  <UserIcon size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/65 uppercase tracking-wider">Họ và tên</p>
                  <p className="text-body-sm font-semibold text-on-surface mt-0.5">{profile.full_name || "Chưa thiết lập"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                  <PhoneIcon size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/65 uppercase tracking-wider">Số điện thoại</p>
                  <p className="text-body-sm font-semibold text-on-surface mt-0.5">{profile.phone || "Chưa cập nhật số điện thoại"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                  <MapPinIcon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-on-surface-variant/65 uppercase tracking-wider">Địa chỉ giao hàng</p>
                  <p className="text-body-sm font-semibold text-on-surface mt-0.5 break-words whitespace-pre-line leading-relaxed">
                    {profile.address || "Chưa cập nhật địa chỉ"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
                    <MapPinIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-on-surface">Định vị khách hàng</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {profile.gps_location
                        ? `${profile.gps_location.lat}, ${profile.gps_location.lng}${profile.gps_location.accuracy ? ` · sai số khoảng ${profile.gps_location.accuracy}m` : ""}`
                        : "Chưa lưu vị trí GPS."}
                    </p>
                    {locationMsg && <p className="mt-2 text-xs font-semibold text-success">{locationMsg}</p>}
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={locating}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                    >
                      {locating ? "Đang lấy vị trí..." : "Cập nhật vị trí hiện tại"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-label-md text-xs font-bold text-on-surface-variant/80 block mb-1.5">
                  Họ và tên <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  placeholder="Nhập họ và tên đầy đủ"
                  disabled={saving}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-label-md text-xs font-bold text-on-surface-variant/80 block mb-1.5">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="Nhập số điện thoại của bạn"
                  disabled={saving}
                  maxLength={20}
                />
              </div>

              <div>
                <label className="text-label-md text-xs font-bold text-on-surface-variant/80 block mb-1.5">
                  Địa chỉ mặc định
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field min-h-[80px] py-2 px-3 resize-none leading-relaxed"
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                  disabled={saving}
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
                <p className="text-sm font-extrabold text-on-surface">Định vị khách hàng</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {profile.gps_location
                    ? `${profile.gps_location.lat}, ${profile.gps_location.lng}${profile.gps_location.accuracy ? ` · sai số khoảng ${profile.gps_location.accuracy}m` : ""}`
                    : "Chưa lưu vị trí GPS."}
                </p>
                {locationMsg && <p className="mt-2 text-xs font-semibold text-success">{locationMsg}</p>}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating || saving}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                >
                  {locating ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full mt-2 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu thông tin...</span>
                  </>
                ) : (
                  <span>Lưu thay đổi</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* General Actions Panel */}
        <div className="card !p-0 overflow-hidden">
          {/* Link: Booking History */}
          <button
            onClick={() => router.push("/customer/jobs")}
            className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
          >
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
              <ZapIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-bold text-on-surface">Lịch sử đơn dịch vụ</div>
              <div className="text-label-sm text-on-surface-variant/70 truncate">Theo dõi tiến độ, chi tiết hóa đơn cũ</div>
            </div>
            <ChevronRightIcon size={18} className="text-outline/75 shrink-0" />
          </button>

          <div className="border-t border-outline-variant/30">
            <button
              onClick={() => setShowWarranties(!showWarranties)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
            >
              <div className="w-10 h-10 rounded-full bg-success-container flex items-center justify-center text-success shrink-0">
                <ShieldCheckIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Phiếu bảo hành</div>
                <div className="text-label-sm text-on-surface-variant/70 truncate">{warranties.length} sản phẩm đã ghi nhận</div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showWarranties ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={18} className="text-outline/75" />
              </div>
            </button>

            {showWarranties && (
              <div className="space-y-2 border-t border-outline-variant/10 bg-surface-container-lowest px-4 py-4 animate-fade-in">
                {warranties.length === 0 ? (
                  <p className="rounded-lg bg-white p-4 text-sm text-on-surface-variant">Chưa có phiếu bảo hành.</p>
                ) : warranties.map(warranty => {
                  const label = getWarrantyStatusLabel(warranty);
                  const statusClass = label === "Đã bảo hành"
                    ? "bg-primary-fixed text-primary-container"
                    : label === "Còn bảo hành"
                      ? "bg-success-container text-success"
                      : "bg-error-container text-error";

                  return (
                    <div key={warranty.id} className="rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-on-surface">{warranty.product_name}</p>
                          <p className="mt-1 font-mono text-xs text-on-surface-variant">{warranty.product_sku}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">Hết hạn: {new Date(warranty.warranty_end).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>{label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-outline-variant/30">
            <button
              onClick={() => setShowPayments(!showPayments)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
            >
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                <ClockIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Thanh toán & Công nợ</div>
                <div className="text-label-sm text-on-surface-variant/70 truncate">
                  Còn nợ {formatBillGoCurrency(billGoTotals.debt)} · đã thu {formatBillGoCurrency(billGoTotals.paid)}
                </div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showPayments ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={18} className="text-outline/75" />
              </div>
            </button>

            {showPayments && (
              <div className="space-y-3 border-t border-outline-variant/10 bg-surface-container-lowest px-4 py-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Phải thu</p>
                    <p className="mt-1 text-sm font-extrabold text-on-surface">{formatBillGoCurrency(billGoTotals.receivable)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Đã thu</p>
                    <p className="mt-1 text-sm font-extrabold text-success">{formatBillGoCurrency(billGoTotals.paid)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Còn nợ</p>
                    <p className="mt-1 text-sm font-extrabold text-error">{formatBillGoCurrency(billGoTotals.debt)}</p>
                  </div>
                </div>

                {billGoJobs.length === 0 ? (
                  <p className="rounded-lg bg-white p-4 text-sm text-on-surface-variant">Chưa có khoản thanh toán.</p>
                ) : billGoJobs.map(job => {
                  const summary = getBillGoReceivableSummary(job);
                  const paidPayments = (job.payments || []).filter(payment => payment.status === "paid");
                  return (
                    <div key={job.id} className="rounded-lg bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-on-surface">{job.title || job.subscription?.package_name || job.id.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">Hạn tiếp theo: {job.due_date || job.subscription?.next_due_date || "Chưa có"}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${summary.debt > 0 ? "bg-error-container text-error" : "bg-success-container text-success"}`}>
                          {summary.statusLabel}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-on-surface-variant">
                        <span>Phải thu<br /><strong className="text-on-surface">{formatBillGoCurrency(summary.receivable)}</strong></span>
                        <span>Đã thu<br /><strong className="text-success">{formatBillGoCurrency(summary.paid)}</strong></span>
                        <span>Còn nợ<br /><strong className="text-error">{formatBillGoCurrency(summary.debt)}</strong></span>
                      </div>
                      {paidPayments.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-outline-variant/20 pt-2">
                          {paidPayments.map(payment => (
                            <p key={payment.id} className="text-xs text-on-surface-variant">
                              {formatBillGoCurrency(payment.amount)} · {payment.method} · {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("vi-VN") : "Chưa có ngày"}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible item: Change Password */}
          <div className="border-t border-outline-variant/30">
            <button
              onClick={() => {
                setShowSecurity(!showSecurity);
                setPasswordError("");
                setPasswordSuccess("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                <ShieldCheckIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Bảo mật tài khoản</div>
                <div className="text-label-sm text-on-surface-variant/70 truncate">Đổi mật khẩu bảo vệ tài khoản</div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showSecurity ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={18} className="text-outline/75" />
              </div>
            </button>

            {showSecurity && (
              <form onSubmit={handleUpdatePassword} className="px-6 pb-5 pt-2 bg-surface-container-lowest border-t border-outline-variant/10 animate-fade-in space-y-4">
                {passwordError && (
                  <div className="p-3 bg-error-container text-error rounded-xl text-xs font-semibold border border-error/20">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-success-container text-success rounded-xl text-xs font-semibold border border-success/20">
                    {passwordSuccess}
                  </div>
                )}

                <div>
                  <label className="text-label-md text-xs font-bold text-on-surface-variant/80 block mb-1.5">
                    Mật khẩu mới <span className="text-error">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    placeholder="Nhập mật khẩu từ 6 ký tự"
                    disabled={passwordLoading}
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="text-label-md text-xs font-bold text-on-surface-variant/80 block mb-1.5">
                    Xác nhận mật khẩu mới <span className="text-error">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field"
                    placeholder="Xác nhận lại mật khẩu mới"
                    disabled={passwordLoading}
                    maxLength={50}
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn-primary w-full mt-2 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <span>Đổi mật khẩu</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Collapsible item: Hotline support */}
          <div className="border-t border-outline-variant/30">
            <button
              onClick={() => setShowSupport(!showSupport)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
            >
              <div className="w-10 h-10 rounded-full bg-success-container flex items-center justify-center text-success shrink-0">
                <PhoneIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Tổng đài hỗ trợ Thợ đến ngay</div>
                <div className="text-label-sm text-on-surface-variant/70 truncate">Liên hệ khi cần trợ giúp, tư vấn sự cố</div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showSupport ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={18} className="text-outline/75" />
              </div>
            </button>

            {showSupport && (
              <div className="px-6 pb-4 pt-1 bg-surface-container-lowest text-xs text-on-surface-variant/90 border-t border-outline-variant/10 animate-fade-in space-y-3 leading-relaxed">
                <p>
                  {settings.app_name} luôn sẵn sàng hỗ trợ bạn khắc phục mọi thắc mắc hoặc khó khăn liên quan đến kỹ thuật viên, đơn hàng, hóa đơn dịch vụ.
                </p>
                <div className="flex flex-col gap-2 bg-surface-container-low p-3 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Hotline 24/7:</span>
                    <a href={`tel:${settings.hotline.replace(/\s+/g, '')}`} className="text-primary font-bold hover:underline text-sm">
                      {settings.hotline}
                    </a>
                  </div>
                  <div className="flex justify-between items-center border-t border-outline-variant/20 pt-2 mt-1">
                    <span className="font-bold">Thời gian làm việc:</span>
                    <span>08:00 – 22:00 hàng ngày</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-outline-variant/20 pt-2 mt-1">
                    <span className="font-bold">Email hỗ trợ:</span>
                    <a href={`mailto:${settings.support_email}`} className="text-primary hover:underline font-semibold">
                      {settings.support_email}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible item: Operating rules */}
          <div className="border-t border-outline-variant/30">
            <button
              onClick={() => setShowPolicies(!showPolicies)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container-low transition-colors active:bg-surface-container/60"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                <ClockIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Chính sách & Quy chế hoạt động</div>
                <div className="text-label-sm text-on-surface-variant/70 truncate">Điều khoản chung và quy chuẩn an toàn Thợ đến ngay</div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showPolicies ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={18} className="text-outline/75" />
              </div>
            </button>

            {showPolicies && (
              <div className="px-6 pb-4 pt-1 bg-surface-container-lowest text-xs text-on-surface-variant/90 border-t border-outline-variant/10 animate-fade-in space-y-2.5 leading-relaxed">
                <div>
                  <h4 className="font-bold text-on-surface mb-1">1. Cam kết chất lượng thi công</h4>
                  <p>Các đối tác kỹ thuật trên hệ thống Thợ đến ngay đều đã được xác minh hồ sơ tư cách pháp nhân, tay nghề thực tế và lý lịch tư pháp đầy đủ.</p>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface mb-1">2. Bảo hành & Hậu mãi</h4>
                  <p>Mọi dịch vụ được đặt qua ứng dụng đều được bảo hành tối thiểu 30 ngày (tùy thuộc vào thỏa thuận hạng mục và linh kiện thiết bị thay thế).</p>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface mb-1">3. Quy chuẩn ứng xử an toàn</h4>
                  <p>Thợ đến ngay nghiêm cấm hành vi tự ý giao dịch ngoài ứng dụng mà không thông báo hoặc thỏa thuận riêng lệch chuẩn giá đã báo giá.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Safety Logout CTA */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-error-container text-error hover:brightness-95 active:scale-[0.98] transition-all font-bold mt-4 shadow-sm"
        >
          <LogOutIcon size={18} />
          <span>Đăng xuất tài khoản</span>
        </button>

      </div>
    </div>
  );
}
