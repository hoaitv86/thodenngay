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
  ChevronRightIcon
} from "../../components/icons";

export default function WorkerProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
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
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

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
      <div className="bg-[#003178] text-white pt-7 pb-16 px-4 sm:px-6 relative">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-[#003178] flex shrink-0 items-center justify-center text-2xl sm:text-3xl font-extrabold shadow-lg shadow-black/10">
            {profile.full_name ? profile.full_name[0] : "T"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words text-white">{profile.full_name || "Thợ chưa có tên"}</h1>
            <p className="opacity-80 text-sm mt-1 break-all">{profile.email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-amber-400'}`} />
              {isActive ? 'Đang hoạt động' : 'Chờ duyệt'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards overlay */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-4 flex justify-between">
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
          <div className="px-4 py-3 border-b border-outline-variant/50 bg-surface-container-lowest flex items-center gap-3">
            <UserIcon size={18} className="text-primary-container" />
            <span className="text-body-sm font-bold text-on-surface">Thông tin liên hệ</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <PhoneIcon size={18} />
                <span className="text-body-sm">Số điện thoại</span>
              </div>
              <span className="text-body-sm font-medium text-on-surface break-all sm:text-right">{profile.phone || 'Chưa cập nhật'}</span>
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="card !p-0 overflow-hidden">
          {[
            { icon: BriefcaseIcon, title: "Dịch vụ đăng ký", desc: "Quản lý các hạng mục thi công" },
            { icon: ShieldCheckIcon, title: "Bảo mật tài khoản", desc: "Đổi mật khẩu, thiết lập an toàn" },
            { icon: PhoneIcon, title: "Trung tâm hỗ trợ", desc: "Liên hệ tổng đài Alo Thợ" }
          ].map((item, idx) => (
            <button key={idx} className={`w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-surface-container-lowest ${idx !== 0 ? 'border-t border-outline-variant/50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                <item.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-bold text-on-surface">{item.title}</div>
                <div className="text-label-sm text-on-surface-variant truncate">{item.desc}</div>
              </div>
              <ChevronRightIcon size={20} className="text-outline shrink-0" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-error-container text-error hover:brightness-95 transition-all mt-4 font-bold"
        >
          <LogOutIcon size={20} />
          <span>Đăng xuất tài khoản</span>
        </button>
      </div>
    </div>
  );
}
