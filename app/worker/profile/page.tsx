"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  UserIcon,
  PhoneIcon,
  StarIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
  LogOutIcon,
  ChevronRightIcon,
  CameraIcon
} from "../../components/icons";

interface WorkerProfileData {
  id: string;
  email?: string;
  phone?: string | null;
  full_name: string;
  address?: string | null;
  created_at: string;
  avatar_url?: string | null;
  worker: {
    id: string;
    user_id: string;
    specialties: string[];
    status: string;
    avg_rating: number;
    total_jobs: number;
    certificates?: string | null;
    approved_at?: string | null;
    created_at: string;
  } | null;
}

export default function WorkerProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfileData | null>(null);
  const [showSecurity, setShowSecurity] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get base profile
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        // Get worker details
        const { data: workerData } = await supabase
          .from('workers')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        setProfile({
          ...userProfile,
          worker: workerData || null,
          email: user.email
        });

        if (userProfile) {
          setFullName(userProfile.full_name || "");
          setPhone(userProfile.phone || "");
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

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
        })
        .eq("id", user.id);

      if (error) {
        setErrorMsg("Không thể lưu thông tin. Vui lòng thử lại sau.");
        console.error("Supabase update error:", error);
      } else {
        setSuccessMsg("Cập nhật tài khoản thành công!");
        setProfile((prev: WorkerProfileData | null) => {
          if (!prev) return null;
          return {
            ...prev,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          };
        });
        setIsEditing(false);
        // Refresh Layout states
        router.refresh();
      }
    } catch (err) {
      setErrorMsg("Đã xảy ra lỗi ngoài ý muốn. Vui lòng kiểm tra kết nối mạng.");
      console.error("Save profile error:", err);
    } finally {
      setSaving(false);
    }
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
      setProfile(prev => {
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
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <p className="text-on-surface-variant text-body-md">Không tìm thấy thông tin hồ sơ.</p>
      </div>
    );
  }

  const joinedDate = profile.worker?.created_at || profile.created_at;
  const isActive = profile.worker?.status === 'active';

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface pb-6 animate-fade-in">
      {/* Header / Avatar */}
      <div className="hero-gradient relative overflow-hidden px-4 pb-16 pt-7 text-white shadow-sm sm:px-6">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" />
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-extrabold shadow-sm relative shrink-0 overflow-hidden">
            {uploadingAvatar ? (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span>{profile.full_name ? profile.full_name[0] : "T"}</span>
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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-white">{profile.full_name || "Thợ chưa có tên"}</h1>
            <p className="opacity-80 text-sm mt-1 break-all">{profile.email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-amber-400'}`} />
              {isActive ? 'Đang hoạt động' : 'Chờ duyệt'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards overlay */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="flex justify-between rounded-lg border border-outline-variant/20 bg-white p-4 shadow-sm">
          <div className="text-center flex-1">
            <div className="text-xl font-extrabold text-on-surface">{profile.worker?.total_jobs || 0}</div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Jobs</div>
          </div>
          <div className="w-px bg-outline-variant" />
          <div className="text-center flex-1 flex flex-col items-center">
            <div className="text-xl font-extrabold text-on-surface flex items-center gap-1">
              {profile.worker?.avg_rating || 0}
              <StarIcon size={14} className="text-amber-400 fill-amber-400" />
            </div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Rating</div>
          </div>
          <div className="w-px bg-outline-variant" />
          <div className="text-center flex-1">
            <div className="text-xl font-extrabold text-on-surface">
              {new Date(joinedDate).getFullYear()}
            </div>
            <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mt-1">Tham gia</div>
          </div>
        </div>
      </div>

      {/* Menu Settings */}
      <div className="px-4 mt-6 space-y-4">
        {/* Personal Info */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/50 bg-surface-container-lowest flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserIcon size={18} className="text-primary-container" />
              <span className="text-body-sm font-bold text-on-surface">Thông tin liên hệ</span>
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
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs font-bold text-on-surface-variant/80 hover:text-on-surface transition-colors"
              >
                Hủy bỏ
              </button>
            )}
          </div>

          <div className="p-4">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <UserIcon size={18} />
                    <span className="text-body-sm">Họ và tên</span>
                  </div>
                  <span className="text-body-sm font-medium text-on-surface">{profile.full_name || "Chưa thiết lập"}</span>
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <PhoneIcon size={18} />
                    <span className="text-body-sm">Số điện thoại</span>
                  </div>
                  <span className="text-body-sm font-medium text-on-surface">{profile.phone || 'Chưa cập nhật'}</span>
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
                    placeholder="Nhập họ và tên thợ"
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
                    placeholder="Nhập số điện thoại"
                    disabled={saving}
                    maxLength={20}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full mt-2 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* General Settings */}
        <div className="card !p-0 overflow-hidden">
          {/* Link: Register Specialties */}
          <button className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-surface-container-lowest">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
              <BriefcaseIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-bold text-on-surface">Dịch vụ đăng ký</div>
              <div className="text-label-sm text-on-surface-variant truncate">Quản lý các hạng mục thi công</div>
            </div>
            <ChevronRightIcon size={20} className="text-outline shrink-0" />
          </button>

          {/* Collapsible item: Change Password */}
          <div className="border-t border-outline-variant/50">
            <button
              onClick={() => {
                setShowSecurity(!showSecurity);
                setPasswordError("");
                setPasswordSuccess("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-surface-container-lowest"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                <ShieldCheckIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">Bảo mật tài khoản</div>
                <div className="text-label-sm text-on-surface-variant truncate">Đổi mật khẩu, thiết lập an toàn</div>
              </div>
              <div className={`transform transition-transform duration-200 shrink-0 ${showSecurity ? "rotate-90" : ""}`}>
                <ChevronRightIcon size={20} className="text-outline" />
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

          {/* Link: Support Hotline */}
          <button className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-surface-container-lowest border-t border-outline-variant/50">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
              <PhoneIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-bold text-on-surface">Trung tâm hỗ trợ</div>
              <div className="text-label-sm text-on-surface-variant truncate">Liên hệ tổng đài Alo Thợ</div>
            </div>
            <ChevronRightIcon size={20} className="text-outline shrink-0" />
          </button>
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-error px-5 py-4 font-extrabold text-white shadow-lg shadow-red-700/15 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <LogOutIcon size={20} />
          <span>Đăng xuất tài khoản</span>
        </button>
      </div>
    </div>
  );
}
