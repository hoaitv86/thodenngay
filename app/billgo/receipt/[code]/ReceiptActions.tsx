"use client";

import { useCallback, useEffect } from "react";

type ReceiptActionsProps = {
  receiptCode: string;
  receiptUrl: string;
  autoPrint?: boolean;
};

export default function ReceiptActions({ receiptCode, receiptUrl, autoPrint }: ReceiptActionsProps) {
  const printReceipt = useCallback(async () => {
    await document.fonts?.ready;
    const images = Array.from(document.images);
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }));
    window.setTimeout(() => window.print(), 150);
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    const timeoutId = window.setTimeout(() => void printReceipt(), 600);
    return () => window.clearTimeout(timeoutId);
  }, [autoPrint, printReceipt]);

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
      <button type="button" onClick={() => void printReceipt()} className="btn-primary !w-auto !px-4 !py-2">
        Tải PDF / In
      </button>
      <button type="button" onClick={() => void shareReceipt()} className="btn-outline !w-auto !px-4 !py-2">
        Chia sẻ
      </button>
    </div>
  );
}
