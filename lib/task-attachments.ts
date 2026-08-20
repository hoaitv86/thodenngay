export const TASK_ATTACHMENTS_BUCKET = "task-attachments";
export const MAX_TASK_ATTACHMENTS = 10;

export type TaskAttachment = {
  id: string;
  task_id: string;
  original_name: string;
  storage_path: string;
  mime_type?: string | null;
  file_size?: number | string | null;
  created_at?: string | null;
};

export function formatFileSize(value?: number | string | null) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function isImageAttachment(attachment: Pick<TaskAttachment, "mime_type" | "original_name">) {
  return Boolean(
    attachment.mime_type?.startsWith("image/")
    || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(attachment.original_name)
  );
}

export function isPdfAttachment(attachment: Pick<TaskAttachment, "mime_type" | "original_name">) {
  return attachment.mime_type === "application/pdf" || /\.pdf$/i.test(attachment.original_name);
}
