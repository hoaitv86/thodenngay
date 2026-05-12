"use client";

import React from "react";
import { DollarSignIcon, CogIcon } from "../../components/icons";

export default function WorkerWallet() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-8rem)] bg-surface p-6 animate-fade-in text-center">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-primary-container/20 flex items-center justify-center animate-pulse">
          <DollarSignIcon size={48} className="text-primary-container" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-surface shadow-sm border border-outline-variant flex items-center justify-center">
          <CogIcon size={20} className="text-on-surface-variant animate-[spin_4s_linear_infinite]" />
        </div>
      </div>
      
      <h1 className="text-headline-sm font-bold text-on-surface mb-2">Ví thu nhập</h1>
      <p className="text-body-md text-on-surface-variant max-w-[260px]">
        Tính năng quản lý doanh thu, sao kê và yêu cầu rút tiền đang được phát triển.
      </p>
      
      <div className="mt-8 px-6 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant inline-flex items-center gap-2 shadow-sm opacity-80">
        <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
        <span className="text-label-sm font-bold text-on-surface uppercase tracking-widest">Coming Soon</span>
      </div>
    </div>
  );
}
