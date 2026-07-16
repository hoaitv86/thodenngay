"use client";

import { useEffect } from "react";

type ReceiptActionsProps = {
  receiptCode: string;
  receiptUrl: string;
  autoPrint?: boolean;
};

export default function ReceiptActions({ receiptCode, receiptUrl, autoPrint }: ReceiptActionsProps) {
  useEffect(() => {
    if (!autoPrint) return;
    const timeoutId = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timeoutId);
  }, [autoPrint]);

  const shareReceipt = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Phiếu thu ${receiptCode}`, url: receiptUrl });
      return;
    }
    await navigator.clipboard?.writeText(receiptUrl);
    window.alert("Đã sao chép liên kết phiếu thu.");
  };

  return (
    <div className="receipt-actions flex flex-wrap gap-2">
      <button type="button" onClick={() => window.print()} className="btn-primary !w-auto !px-4 !py-2">
        Tải PDF / In
      </button>
      <button type="button" onClick={() => void shareReceipt()} className="btn-outline !w-auto !px-4 !py-2">
        Chia sẻ
      </button>
    </div>
  );
}
