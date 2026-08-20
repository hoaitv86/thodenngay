"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Download, FileText, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
  TASK_ATTACHMENTS_BUCKET,
  type TaskAttachment,
} from "@/lib/task-attachments";

type SignedAttachment = TaskAttachment & {
  signedUrl?: string;
  error?: string;
};

export function TaskAttachmentList({ attachments }: { attachments?: TaskAttachment[] | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [signedAttachments, setSignedAttachments] = useState<SignedAttachment[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadUrls = async () => {
      const rows = attachments || [];
      if (rows.length === 0) {
        setSignedAttachments([]);
        return;
      }

      const nextRows = await Promise.all(rows.map(async attachment => {
        const { data, error } = await supabase.storage
          .from(TASK_ATTACHMENTS_BUCKET)
          .createSignedUrl(attachment.storage_path, 60 * 60, {
            download: attachment.original_name,
          });

        return {
          ...attachment,
          signedUrl: data?.signedUrl,
          error: error?.message,
        };
      }));

      if (mounted) setSignedAttachments(nextRows);
    };

    void loadUrls();
    return () => {
      mounted = false;
    };
  }, [attachments, supabase]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip size={16} className="text-primary-container" />
        <h3 className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
          File đính kèm
        </h3>
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
          {attachments.length}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {signedAttachments.map(attachment => {
          const isImage = isImageAttachment(attachment);
          const isPdf = isPdfAttachment(attachment);
          const actionLabel = isImage || isPdf ? "Xem/Tải file" : "Tải file";

          return (
            <div
              key={attachment.id}
              className="flex min-w-0 gap-3 rounded-lg border border-outline-variant/35 bg-white p-3 shadow-sm"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low text-primary-container">
                {isImage && attachment.signedUrl ? (
                  <Image
                    src={attachment.signedUrl}
                    alt={attachment.original_name}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <FileText size={22} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface" title={attachment.original_name}>
                  {attachment.original_name}
                </p>
                <p className="mt-0.5 text-xs font-medium text-on-surface-variant">
                  {formatFileSize(attachment.file_size)}{attachment.mime_type ? ` • ${attachment.mime_type}` : ""}
                </p>
                {attachment.signedUrl ? (
                  <a
                    href={attachment.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary-fixed px-2.5 py-1.5 text-xs font-bold text-primary-container transition-colors hover:bg-primary-container hover:text-white"
                  >
                    <Download size={14} />
                    {actionLabel}
                  </a>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-error">
                    {attachment.error ? `Không thể tạo link: ${attachment.error}` : "Đang tạo link..."}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
