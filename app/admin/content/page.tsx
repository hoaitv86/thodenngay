"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { defaultCmsPages, type CmsPost } from "@/lib/cms";

type CmsFormState = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  cover_image_url: string;
  is_published: boolean;
  sort_order: string;
};

const emptyForm: CmsFormState = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  content_html: "<p></p>",
  cover_image_url: "",
  is_published: true,
  sort_order: "0",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Không xác định";
}

export default function AdminContentPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [form, setForm] = useState<CmsFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "hidden">("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cms_posts")
      .select("id,slug,title,excerpt,content_html,cover_image_url,is_published,sort_order,created_at,updated_at,published_at")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      showMessage("error", `Không tải được CMS: ${error.message}`);
    } else {
      setPosts((data || []) as CmsPost[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== form.content_html) {
      editorRef.current.innerHTML = form.content_html || "<p></p>";
    }
  }, [form.id, form.content_html]);

  const filteredPosts = posts.filter((post) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${post.title} ${post.slug} ${post.excerpt || ""}`.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && post.is_published) ||
      (statusFilter === "hidden" && !post.is_published);
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setForm(emptyForm);
    if (editorRef.current) editorRef.current.innerHTML = emptyForm.content_html;
  };

  const editPost = (post: CmsPost) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content_html: post.content_html || "<p></p>",
      cover_image_url: post.cover_image_url || "",
      is_published: post.is_published,
      sort_order: String(post.sort_order || 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const seedDefaults = async () => {
    setSaving(true);
    const payload = defaultCmsPages.map((page) => ({
      slug: page.slug,
      title: page.title,
      excerpt: page.excerpt,
      content_html: page.contentHtml,
      is_published: true,
      sort_order: page.sortOrder,
      published_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("cms_posts").upsert(payload, { onConflict: "slug" });
    setSaving(false);

    if (error) {
      showMessage("error", `Không tạo được trang mặc định: ${error.message}`);
      return;
    }

    showMessage("success", "Đã tạo/cập nhật các trang nội dung mặc định.");
    await loadPosts();
  };

  const uploadImage = async (file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `content/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("cms-images").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    const { data } = supabase.storage.from("cms-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await uploadImage(file);
      setForm((current) => ({ ...current, cover_image_url: publicUrl }));
      showMessage("success", "Đã upload ảnh đại diện.");
    } catch (error) {
      showMessage("error", `Upload ảnh thất bại: ${getErrorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleInlineImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await uploadImage(file);
      document.execCommand("insertImage", false, publicUrl);
      const nextHtml = editorRef.current?.innerHTML || "";
      setForm((current) => ({ ...current, content_html: nextHtml }));
      showMessage("success", "Đã chèn ảnh vào nội dung.");
    } catch (error) {
      showMessage("error", `Upload ảnh thất bại: ${getErrorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setForm((current) => ({ ...current, content_html: editorRef.current?.innerHTML || current.content_html }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    const slug = slugify(form.slug || form.title);
    const contentHtml = editorRef.current?.innerHTML || form.content_html;

    if (!title || !slug) {
      showMessage("error", "Vui lòng nhập tiêu đề và slug.");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      title,
      slug,
      excerpt: form.excerpt.trim() || null,
      content_html: contentHtml,
      cover_image_url: form.cover_image_url.trim() || null,
      is_published: form.is_published,
      sort_order: Number(form.sort_order) || 0,
      updated_by: user?.id || null,
      published_at: form.is_published ? new Date().toISOString() : null,
    };

    const { error } = form.id
      ? await supabase.from("cms_posts").update(payload).eq("id", form.id)
      : await supabase.from("cms_posts").insert({ ...payload, created_by: user?.id || null });

    setSaving(false);

    if (error) {
      showMessage("error", `Không lưu được bài viết: ${error.message}`);
      return;
    }

    showMessage("success", form.id ? "Đã cập nhật bài viết." : "Đã tạo bài viết.");
    resetForm();
    await loadPosts();
  };

  const togglePublish = async (post: CmsPost) => {
    const nextPublished = !post.is_published;
    const { error } = await supabase
      .from("cms_posts")
      .update({
        is_published: nextPublished,
        published_at: nextPublished ? new Date().toISOString() : null,
      })
      .eq("id", post.id);

    if (error) {
      showMessage("error", `Không đổi trạng thái được: ${error.message}`);
      return;
    }

    setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, is_published: nextPublished } : item)));
  };

  const deletePost = async (post: CmsPost) => {
    if (!window.confirm(`Xóa bài viết "${post.title}"?`)) return;

    const { error } = await supabase.from("cms_posts").delete().eq("id", post.id);
    if (error) {
      showMessage("error", `Không xóa được bài viết: ${error.message}`);
      return;
    }

    setPosts((current) => current.filter((item) => item.id !== post.id));
    if (form.id === post.id) resetForm();
    showMessage("success", "Đã xóa bài viết.");
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`fixed left-1/2 top-4 z-50 w-11/12 max-w-sm -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${
            message.type === "success"
              ? "border-success/30 bg-success-container text-success"
              : "border-error/30 bg-error-container text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Quản lý nội dung</h1>
          <p className="text-body-sm text-on-surface-variant">
            Tạo, chỉnh sửa, upload ảnh và ẩn/hiện các trang nội dung hiển thị trên website/app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={seedDefaults} disabled={saving} className="btn-outline !py-2.5">
            <FileText size={16} />
            Tạo trang mặc định
          </button>
          <button type="button" onClick={resetForm} className="btn-primary !py-2.5">
            <Plus size={16} />
            Bài viết mới
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
              <h2 className="font-bold text-on-surface">{form.id ? "Chỉnh sửa bài viết" : "Tạo bài viết"}</h2>
              <p className="text-xs text-on-surface-variant">Nội dung đang lưu dưới dạng HTML để website/app đọc trực tiếp từ CMS.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
            <div className="h-6 w-11 rounded-full bg-surface-container-high after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-success peer-checked:after:translate-x-full" />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-label-sm">Tiêu đề</label>
                <input
                  className="input-field"
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setForm((current) => ({
                      ...current,
                      title,
                      slug: current.id || current.slug ? current.slug : slugify(title),
                    }));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm">Slug</label>
                <input
                  className="input-field"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                  placeholder="duong-dan-bai-viet"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <label className="text-label-sm">Mô tả ngắn</label>
                <input
                  className="input-field"
                  value={form.excerpt}
                  onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm">Thứ tự</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-outline-variant/50">
              <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/40 bg-surface-container-low p-2">
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Đậm" onClick={() => runCommand("bold")}>
                  <Bold className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Nghiêng" onClick={() => runCommand("italic")}>
                  <Italic className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Tiêu đề" onClick={() => runCommand("formatBlock", "h2")}>
                  <Heading2 className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Danh sách" onClick={() => runCommand("insertUnorderedList")}>
                  <List className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Canh trái" onClick={() => runCommand("justifyLeft")}>
                  <AlignLeft className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Canh giữa" onClick={() => runCommand("justifyCenter")}>
                  <AlignCenter className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Canh phải" onClick={() => runCommand("justifyRight")}>
                  <AlignRight className="mx-auto h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg hover:bg-white"
                  title="Chèn liên kết"
                  onClick={() => {
                    const url = window.prompt("Nhập URL liên kết");
                    if (url) runCommand("createLink", url);
                  }}
                >
                  <LinkIcon className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Chèn ảnh" onClick={() => inlineImageInputRef.current?.click()}>
                  <ImagePlus className="mx-auto h-4 w-4" />
                </button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                className="cms-editor min-h-[280px] bg-white p-4 text-sm leading-7 text-on-surface outline-none"
                onInput={(event) => setForm({ ...form, content_html: event.currentTarget.innerHTML })}
                suppressContentEditableWarning
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface">Ảnh đại diện</span>
                {form.cover_image_url && (
                  <button type="button" title="Xóa ảnh" className="h-8 w-8 rounded-lg hover:bg-error-container" onClick={() => setForm({ ...form, cover_image_url: "" })}>
                    <X className="mx-auto h-4 w-4 text-error" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-white text-sm font-semibold text-on-surface-variant"
              >
                {form.cover_image_url ? (
                  <Image src={form.cover_image_url} alt="" fill sizes="280px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex items-center gap-2">
                    <ImagePlus size={18} />
                    Upload ảnh
                  </span>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <input ref={inlineImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInlineImageUpload} />
            </div>

            <button type="submit" disabled={saving || uploading} className="btn-primary w-full justify-center">
              <Save size={18} />
              {saving ? "Đang lưu..." : uploading ? "Đang upload..." : "Lưu bài viết"}
            </button>
          </aside>
        </div>
      </form>

      <section className="admin-table-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-on-surface">Danh sách bài viết</h2>
            <p className="text-xs text-on-surface-variant">{posts.length} bài viết trong CMS</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              className="input-field min-w-[220px]"
              placeholder="Tìm tiêu đề hoặc slug"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="input-field sm:w-40" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">Tất cả</option>
              <option value="published">Đang hiện</option>
              <option value="hidden">Đang ẩn</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải nội dung...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có bài viết phù hợp.</div>
        ) : (
          <div className="divide-y divide-outline-variant/30">
            {filteredPosts.map((post) => (
              <div key={post.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_140px_180px] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`badge ${post.is_published ? "badge-active" : "badge-inactive"}`}>
                      {post.is_published ? "Đang hiện" : "Đang ẩn"}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">/{post.slug}</span>
                  </div>
                  <h3 className="truncate font-bold text-on-surface">{post.title}</h3>
                  <p className="line-clamp-2 text-sm text-on-surface-variant">{post.excerpt || "Chưa có mô tả ngắn."}</p>
                </div>
                <Link href={`/${post.slug}`} target="_blank" className="btn-outline justify-center !py-2 text-sm">
                  <Eye size={16} />
                  Xem
                </Link>
                <div className="flex items-center justify-start gap-1 lg:justify-end">
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Sửa" onClick={() => editPost(post)}>
                    <Edit3 className="mx-auto h-4 w-4" />
                  </button>
                  <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title={post.is_published ? "Ẩn" : "Hiện"} onClick={() => togglePublish(post)}>
                    {post.is_published ? <EyeOff className="mx-auto h-4 w-4" /> : <Eye className="mx-auto h-4 w-4" />}
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
