"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BillGoReceiptLookupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const submitLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCode = code.trim();
    if (!normalizedCode) return;
    router.push(`/billgo/receipt/${encodeURIComponent(normalizedCode)}`);
  };

  return (
    <main className="min-h-dvh bg-surface px-4 py-6 text-on-surface">
      <form onSubmit={submitLookup} className="mx-auto max-w-xl rounded-lg border border-outline-variant/40 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-primary">BillGo</p>
        <h1 className="mt-1 text-2xl font-extrabold">Tra cứu phiếu thu</h1>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-on-surface-variant">
            Mã phiếu hoặc mã tra cứu
            <input
              autoFocus
              className="input-field"
              placeholder="VD: BG-20260716-ABC12345"
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary !w-full">Tra cứu</button>
        </div>
      </form>
    </main>
  );
}
