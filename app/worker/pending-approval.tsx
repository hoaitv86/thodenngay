"use client";

import React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  ClockIcon,
  LogOutIcon,
  PhoneIcon,
  CheckCircleIcon,
  XIcon
} from "../components/icons";

interface PendingApprovalProps {
  worker: any;
  workerName: string;
}

export default function PendingApproval({ worker, workerName }: PendingApprovalProps) {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isBlocked = worker?.status === 'blocked';

  return (
    <div className="min-h-[calc(100dvh-5rem)] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-surface to-surface-container-low">
      <div className="w-full max-w-md text-center space-y-6 sm:space-y-8 animate-fade-in">
        
        {/* Status Icon */}
        <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28">
          {isBlocked ? (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-error-container flex items-center justify-center shadow-lg shadow-red-200/50">
              <XIcon size={48} className="text-error" />
            </div>
          ) : (
            <>
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary-fixed flex items-center justify-center shadow-lg shadow-blue-200/50 animate-pulse">
                <ClockIcon size={48} className="text-primary-container" />
              </div>
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-container animate-spin" style={{ animationDuration: '3s' }} />
            </>
          )}
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-on-surface">
            {isBlocked ? 'Tài khoản bị từ chối' : 'Đang chờ duyệt'}
          </h1>
          <p className="text-body-md text-on-surface-variant leading-relaxed max-w-sm mx-auto">
            {isBlocked 
              ? 'Hồ sơ của bạn đã bị admin từ chối. Vui lòng liên hệ để được hỗ trợ.'
              : `Xin chào ${workerName}, hồ sơ thợ của bạn đã được gửi thành công. Admin đang xem xét và sẽ phản hồi sớm nhất có thể.`
            }
          </p>
        </div>

        {/* Rejection reason */}
        {isBlocked && worker?.rejection_reason && (
          <div className="bg-error-container/20 border border-error/10 rounded-xl p-4 text-left">
            <p className="text-label-sm font-bold text-error uppercase tracking-wider mb-1">Lý do</p>
            <p className="text-body-sm text-on-surface-variant italic">&ldquo;{worker.rejection_reason}&rdquo;</p>
          </div>
        )}

        {/* Status steps */}
        {!isBlocked && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-outline-variant/20 text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-success-container flex items-center justify-center shrink-0">
                <CheckCircleIcon size={16} className="text-success" />
              </div>
              <div>
                <p className="text-body-sm font-bold text-on-surface">Đăng ký tài khoản</p>
                <p className="text-label-sm text-on-surface-variant">Hoàn tất</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center shrink-0 animate-pulse">
                <ClockIcon size={16} className="text-primary-container" />
              </div>
              <div>
                <p className="text-body-sm font-bold text-on-surface">Xác minh hồ sơ</p>
                <p className="text-label-sm text-primary-container font-medium">Đang xử lý...</p>
              </div>
            </div>

            <div className="flex items-center gap-3 opacity-40">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                <CheckCircleIcon size={16} className="text-on-surface-variant" />
              </div>
              <div>
                <p className="text-body-sm font-bold text-on-surface">Bắt đầu nhận việc</p>
                <p className="text-label-sm text-on-surface-variant">Chờ duyệt</p>
              </div>
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="flex items-center justify-center gap-2 text-on-surface-variant">
          <PhoneIcon size={16} />
          <span className="text-body-sm">Hotline hỗ trợ: <a href="tel:1900xxxx" className="text-primary-container font-bold">1900.xxxx</a></span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn-outline !py-3 !px-6 flex items-center justify-center gap-2 mx-auto text-sm sm:!w-auto"
        >
          <LogOutIcon size={18} />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
