"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Edit3,
  Eye,
  FileText,
  Heading2,
  List,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  defaultJourneyPosts,
  journeyStatusLabels,
  slugifyJourneyTitle,
  type JourneyPost,
  type JourneyPostStatus,
} from "@/lib/journey";

type JourneyForm = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  content: string;
  sort_order: string;
  status: JourneyPostStatus;
};

type Message = {
  type: "success" | "error";
  text: string;
};

const emptyForm = (): JourneyForm => ({
  id: null,
  title: "",
  slug: "",
  summary: "",
  content: "<p></p>",
  sort_order: "0",
  status: "draft",
});

function toForm(post: JourneyPost): JourneyForm {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary || "",
    content: post.content || "<p></p>",
    sort_order: String(post.sort_order || 0),
    status: post.status || "draft",
  };
}

export default function AdminJourneyPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [posts, setPosts] = useState<JourneyPost[]>([]);
  const [form, setForm] = useState<JourneyForm>(() => emptyForm());
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JourneyPostStatus>("all");
  const [message, setMessage] = useState<Message | null>(null);

  const showMessage = useCallback((type: Message["type"], text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3200);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("journey_posts")
      .select("id,title,slug,summary,content,sort_order,status,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      showMessage("error", "Không tải được Hành trình: " + error.message);
      setPosts([]);
    } else {
      setPosts((data || []) as JourneyPost[]);
    }
    setLoading(false);
  }, [showMessage, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      const matchesKeyword =
        !keyword ||
        post.title.toLowerCase().includes(keyword) ||
        post.slug.toLowerCase().includes(keyword) ||
        (post.summary || "").toLowerCase().includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  }, [posts, search, statusFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditorKey((current) => current + 1);
  };

  const editPost = (post: JourneyPost) => {
    setForm(toForm(post));
    setEditorKey((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value || undefined);
    setForm((current) => ({ ...current, content: editorRef.current?.innerHTML || current.content }));
  };

  const handleTitleChange = (title: string) => {
    setForm((current) => ({
      ...current,
      title,
      slug: current.id ? current.slug : slugifyJourneyTitle(title),
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const content = editorRef.current?.innerHTML || form.content || "<p></p>";
    const payload = {
      title: form.title.trim(),
      slug: slugifyJourneyTitle(form.slug || form.title),
      summary: form.summary.trim() || null,
      content,
      sort_order: Number(form.sort_order) || 0,
      status: form.status,
    };

    const { error } = form.id
      ? await supabase.from("journey_posts").update(payload).eq("id", form.id)
      : await supabase.from("journey_posts").insert(payload);

    setSaving(false);

    if (error) {
      showMessage("error", "Không lưu được bài Hành trình: " + error.message);
      return;
    }

    showMessage("success", form.id ? "Đã cập nhật bài Hành trình." : "Đã tạo bài Hành trình.");
    resetForm();
    await loadPosts();
  };

  const seedDefaults = async () => {
    setSaving(true);
    const rows = defaultJourneyPosts.map((post) => ({
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      sort_order: post.sortOrder,
      status: post.status,
    }));

    const { error } = await supabase.from("journey_posts").upsert(rows, {
      onConflict: "slug",
      ignoreDuplicates: true,
    });

    setSaving(false);
    if (error) {
      showMessage("error", "Không tạo được 5 bài mẫu: " + error.message);
      return;
    }

    showMessage("success", "Đã bổ sung các bài mẫu còn thiếu.");
    await loadPosts();
  };

  const toggleStatus = async (post: JourneyPost) => {
    const nextStatus: JourneyPostStatus = post.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("journey_posts").update({ status: nextStatus }).eq("id", post.id);
    if (error) {
      showMessage("error", "Không đổi trạng thái được: " + error.message);
      return;
    }
    setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, status: nextStatus } : item)));
  };

  const deletePost = async (post: JourneyPost) => {
    if (!window.confirm("Xóa bài Hành trình \"" + post.title + "\"?")) return;
    const { error } = await supabase.from("journey_posts").delete().eq("id", post.id);
    if (error) {
      showMessage("error", "Không xóa được bài Hành trình: " + error.message);
      return;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
    if (form.id === post.id) resetForm();
    showMessage("success", "Đã xóa bài Hành trình.");
  };

  const movePost = async (post: JourneyPost, direction: "up" | "down") => {
    const sorted = [...posts].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    const index = sorted.findIndex((item) => item.id === post.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    const current = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = current;

    setSaving(true);
    const results = await Promise.all(
      reordered.map((item, itemIndex) =>
        supabase
          .from("journey_posts")
          .update({ sort_order: (itemIndex + 1) * 10 })
          .eq("id", item.id),
      ),
    );
    setSaving(false);

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      showMessage("error", "Không sắp xếp được bài: " + failed.error.message);
      return;
    }

    await loadPosts();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            "fixed left-1/2 top-4 z-50 w-11/12 max-w-sm -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg " +
            (message.type === "success"
              ? "border-success/30 bg-success-container text-success"
              : "border-error/30 bg-error-container text-error")
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Hành trình</h1>
          <p className="text-body-sm text-on-surface-variant">
            Quản lý các cột mốc công khai hiển thị tại /hanh-trinh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hanh-trinh" target="_blank" className="btn-outline !py-2.5">
            <Eye size={16} />
            Xem public
          </Link>
          <button type="button" onClick={seedDefaults} disabled={saving} className="btn-outline !py-2.5">
            <FileText size={16} />
            Tạo 5 bài mẫu
          </button>
          <button type="button" onClick={resetForm} className="btn-primary !py-2.5">
            <Plus size={16} />
            Bài mới
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="card space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-fixed text-primary-container">
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-on-surface">{form.id ? "Chỉnh sửa bài Hành trình" : "Tạo bài Hành trình"}</h2>
              <p className="text-xs text-on-surface-variant">Admin &gt; Hành trình</p>
            </div>
          </div>
          <button type="button" onClick={resetForm} className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Làm mới form">
            <RotateCcw className="mx-auto h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">
                Tiêu đề
                <input className="input-field" value={form.title} onChange={(event) => handleTitleChange(event.target.value)} required />
              </label>
              <label className="space-y-1.5 text-label-sm">
                Slug
                <input
                  className="input-field"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: slugifyJourneyTitle(event.target.value) }))}
                  placeholder="duong-dan-bai-viet"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px_170px]">
              <label className="space-y-1.5 text-label-sm">
                Tóm tắt
                <input className="input-field" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-label-sm">
                Thứ tự
                <input type="number" className="input-field" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-label-sm">
                Trạng thái
                <select className="input-field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as JourneyPostStatus })}>
                  <option value="draft">Nháp</option>
                  <option value="published">Công khai</option>
                </select>
              </label>
            </div>

            <div className="overflow-hidden rounded-lg border border-outline-variant/50">
              <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/40 bg-surface-container-low p-2">
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="In đậm" onClick={() => runCommand("bold")}>
                  <Bold className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Tiêu đề" onClick={() => runCommand("formatBlock", "h2")}>
                  <Heading2 className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Đoạn văn" onClick={() => runCommand("formatBlock", "p")}>
                  <FileText className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Danh sách" onClick={() => runCommand("insertUnorderedList")}>
                  <List className="mx-auto h-4 w-4" />
                </button>
              </div>
              <div
                key={editorKey}
                ref={editorRef}
                contentEditable
                className="cms-editor min-h-[300px] bg-white p-4 text-sm leading-7 text-on-surface outline-none"
                onInput={(event) => setForm({ ...form, content: event.currentTarget.innerHTML })}
                dangerouslySetInnerHTML={{ __html: form.content }}
                suppressContentEditableWarning
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-on-surface">Xem trước</span>
                {form.slug && form.status === "published" ? (
                  <Link href={"/hanh-trinh/" + form.slug} target="_blank" className="text-xs font-extrabold text-primary-container hover:text-primary">
                    Mở URL
                  </Link>
                ) : null}
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <span className="badge badge-active">{journeyStatusLabels[form.status]}</span>
                <h3 className="mt-3 text-xl font-black leading-tight text-on-surface">{form.title || "Tiêu đề bài Hành trình"}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{form.summary || "Tóm tắt sẽ hiển thị tại danh sách public."}</p>
                <div className="cms-editor mt-4 border-t border-outline-variant/30 pt-4 text-sm leading-7" dangerouslySetInnerHTML={{ __html: form.content || "<p></p>" }} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
              <Save size={18} />
              {saving ? "Đang lưu..." : "Lưu bài Hành trình"}
            </button>
          </aside>
        </div>
      </form>

      <section className="admin-table-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-on-surface">Danh sách bài Hành trình</h2>
            <p className="text-xs text-on-surface-variant">{posts.length} bài trong Supabase</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="search" className="input-field min-w-[220px]" placeholder="Tìm theo tiêu đề hoặc slug" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="input-field sm:w-40" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | JourneyPostStatus)}>
              <option value="all">Tất cả</option>
              <option value="published">Công khai</option>
              <option value="draft">Nháp</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có bài Hành trình.</div>
        ) : (
          <div className="divide-y divide-outline-variant/30">
            {filteredPosts.map((post, index) => (
              <div key={post.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_120px_220px] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={"badge " + (post.status === "published" ? "badge-active" : "badge-inactive")}>{journeyStatusLabels[post.status || "draft"]}</span>
                    <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary-container">Thứ tự {post.sort_order}</span>
                    <span className="text-xs font-semibold text-on-surface-variant">/hanh-trinh/{post.slug}</span>
                  </div>
                  <h3 className="truncate font-bold text-on-surface">{post.title}</h3>
                  <p className="line-clamp-2 text-sm text-on-surface-variant">{post.summary || "Chưa có tóm tắt."}</p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant">Cập nhật: {post.updated_at ? new Date(post.updated_at).toLocaleString("vi-VN") : "-"}</p>
                </div>

                {post.status === "published" ? (
                  <Link href={"/hanh-trinh/" + post.slug} target="_blank" className="btn-outline justify-center !py-2 text-sm">
                    <Eye size={16} />
                    Xem
                  </Link>
                ) : (
                  <button type="button" onClick={() => editPost(post)} className="btn-outline justify-center !py-2 text-sm">
                    <Eye size={16} />
                    Preview
                  </button>
                )}

                <div className="flex items-center justify-start gap-1 lg:justify-end">
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container disabled:opacity-40" title="Lên" onClick={() => movePost(post, "up")} disabled={index === 0 || saving}>
                    <ArrowUp className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container disabled:opacity-40" title="Xuống" onClick={() => movePost(post, "down")} disabled={index === filteredPosts.length - 1 || saving}>
                    <ArrowDown className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Sửa" onClick={() => editPost(post)}>
                    <Edit3 className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="h-9 min-w-24 rounded-lg px-2 text-xs font-bold hover:bg-surface-container" onClick={() => toggleStatus(post)}>
                    {post.status === "published" ? "Đưa về nháp" : "Công khai"}
                  </button>
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-error-container" title="Xóa" onClick={() => deletePost(post)}>
                    <Trash2 className="mx-auto h-4 w-4 text-error" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
