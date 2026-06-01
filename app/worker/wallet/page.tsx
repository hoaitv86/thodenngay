"use client";

import React from "react";
import { DollarSignIcon, CogIcon, ArrowRightIcon } from "../../components/icons";

export default function WorkerWallet() {
  return (
    <div className="flex w-full min-h-[calc(100vh-8rem)] flex-col bg-surface p-4 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#fd6c00] p-5 text-white shadow-xl shadow-primary/15">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Thu nhập</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Ví thợ</h1>
        <p className="mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Quản lý doanh thu, sao kê và yêu cầu rút tiền.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-white p-5 text-center shadow-lg shadow-blue-900/5">
        <div className="relative mx-auto mb-5 w-fit">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-fixed">
            <DollarSignIcon size={48} className="text-primary-container" />
          </div>
          <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white shadow-sm">
            <CogIcon size={20} className="text-secondary-container animate-[spin_4s_linear_infinite]" />
          </div>
        </div>
        <h2 className="mb-2 text-xl font-extrabold text-on-surface">Sắp mở quản lý thu nhập</h2>
        <p className="mx-auto max-w-[280px] text-body-sm text-on-surface-variant">
          Tính năng sao kê, đối soát và rút tiền đang được phát triển.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl bg-success-container p-3">
            <p className="text-[10px] font-bold uppercase text-success">Đối soát</p>
            <p className="mt-1 text-sm font-extrabold text-on-surface">Tự động</p>
          </div>
          <div className="rounded-xl bg-primary-fixed p-3">
            <p className="text-[10px] font-bold uppercase text-primary-container">Rút tiền</p>
            <p className="mt-1 text-sm font-extrabold text-on-surface">Sắp có</p>
          </div>
        </div>
        <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-container px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-secondary-container/25">
          Nhận thông báo
          <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
