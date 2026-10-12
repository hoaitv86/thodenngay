"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bold, Edit3, Eye, FileText, Heading2, ImagePlus, Italic, Link as LinkIcon, List, Plus, Save, Star, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  helpAudienceLabels,
  helpAudiences,
  helpStatusLabels,
  normalizeHelpArticle,
  slugifyHelp,
  type HelpArticle,
  type HelpAudience,
  type HelpCategory,
  type HelpStatus,
} from "@/lib/help";

type HelpArticleForm = {
  id: string | null;
  category_id: string;
  title: string;
  slug: string;
  description: string;
  content_html: string;
  cover_image_url: string;
  image_urls: string[];
  video_url: string;
  sort_order: string;
  status: HelpStatus;
  is_featured: boolean;
  audiences: HelpAudience[];
  help_context: string;
};

type HelpCategoryForm = {
  id: string | null;
  title: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

const emptyArticleForm: HelpArticleForm = {
  id: null,
  category_id: "",
  title: "",
  slug: "",
  description: "",
  content_html: "<p></p>",
  cover_image_url: "",
  image_urls: [],
  video_url: "",
  sort_order: "0",
  status: "draft",
  is_featured: false,
  audiences: ["PUBLIC"],
  help_context: "",
};

const emptyCategoryForm: HelpCategoryForm = {
  id: null,
  title: "",
  slug: "",
  description: "",
  icon: "",
  sort_order: "0",
  is_active: true,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Unknown error";
}

export default function AdminHelpPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articleForm, setArticleForm] = useState<HelpArticleForm>(emptyArticleForm);
  const [categoryForm, setCategoryForm] = useState<HelpCategoryForm>(emptyCategoryForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | HelpStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3600);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [categoryRes, articleRes] = await Promise.all([
      supabase.from("help_categories").select("id,slug,title,description,icon,sort_order,is_active").order("sort_order", { ascending: true }).order("title", { ascending: true }),
      supabase
        .from("help_articles")
        .select("id,category_id,slug,title,description,content_html,cover_image_url,image_urls,video_url,sort_order,status,is_featured,audiences,help_context,created_at,updated_at,published_at,category:help_categories(id,slug,title,description,icon,sort_order,is_active)")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
    ]);

    if (categoryRes.error) showMessage("error", "Không tải được danh mục: " + categoryRes.error.message);
    else setCategories((categoryRes.data || []) as HelpCategory[]);

    if (articleRes.error) showMessage("error", "Không tải được bài hướng dẫn: " + articleRes.error.message);
    else setArticles((articleRes.data || []).map(normalizeHelpArticle));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== articleForm.content_html) {
      editorRef.current.innerHTML = articleForm.content_html || "<p></p>";
    }
  }, [articleForm.id, articleForm.content_html]);

  const filteredArticles = articles.filter((article) => {
    const query = search.trim().toLowerCase();
    const haystack = `${article.title} ${article.slug} ${article.description || ""} ${article.category?.title || ""}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = statusFilter === "all" || article.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetArticleForm = () => {
    setArticleForm(emptyArticleForm);
    if (editorRef.current) editorRef.current.innerHTML = emptyArticleForm.content_html;
  };

  const resetCategoryForm = () => setCategoryForm(emptyCategoryForm);

  const editArticle = (article: HelpArticle) => {
    setArticleForm({
      id: article.id,
      category_id: article.category_id || "",
      title: article.title,
      slug: article.slug,
      description: article.description || "",
      content_html: article.content_html || "<p></p>",
      cover_image_url: article.cover_image_url || "",
      image_urls: article.image_urls || [],
      video_url: article.video_url || "",
      sort_order: String(article.sort_order || 0),
      status: article.status || "draft",
      is_featured: Boolean(article.is_featured),
      audiences: article.audiences?.length ? article.audiences : ["PUBLIC"],
      help_context: article.help_context || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editCategory = (category: HelpCategory) => {
    setCategoryForm({
      id: category.id,
      title: category.title,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "",
      sort_order: String(category.sort_order || 0),
      is_active: category.is_active !== false,
    });
  };

  const uploadImage = async (file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = "help/" + Date.now() + "-" + crypto.randomUUID() + "-" + safeName;
    const { error } = await supabase.storage.from("cms-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("cms-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    if (!selected.length) return [];
    setUploading(true);
    try {
      return await Promise.all(selected.map(uploadImage));
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    try {
      const [url] = await uploadFiles(files);
      setArticleForm((current) => ({ ...current, cover_image_url: url || current.cover_image_url }));
      showMessage("success", "Đã upload ảnh đại diện.");
    } catch (error) {
      showMessage("error", "Upload ảnh thất bại: " + getErrorMessage(error));
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    try {
      const urls = await uploadFiles(files);
      setArticleForm((current) => ({ ...current, image_urls: [...current.image_urls, ...urls], cover_image_url: current.cover_image_url || urls[0] || "" }));
      showMessage("success", "Đã upload ảnh trong bài.");
    } catch (error) {
      showMessage("error", "Upload ảnh thất bại: " + getErrorMessage(error));
    }
  };

  const handleInlineImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    try {
      const urls = await uploadFiles(files);
      editorRef.current?.focus();
      urls.forEach((url) => document.execCommand("insertImage", false, url));
      setArticleForm((current) => ({ ...current, content_html: editorRef.current?.innerHTML || current.content_html, image_urls: [...current.image_urls, ...urls], cover_image_url: current.cover_image_url || urls[0] || "" }));
    } catch (error) {
      showMessage("error", "Chèn ảnh thất bại: " + getErrorMessage(error));
    }
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setArticleForm((current) => ({ ...current, content_html: editorRef.current?.innerHTML || current.content_html }));
  };

  const toggleAudience = (audience: HelpAudience) => {
    setArticleForm((current) => {
      const exists = current.audiences.includes(audience);
      const audiences = exists ? current.audiences.filter((item) => item !== audience) : [...current.audiences, audience];
      return { ...current, audiences: audiences.length ? audiences : ["PUBLIC"] };
    });
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = categoryForm.title.trim();
    const slug = slugifyHelp(categoryForm.slug || title);
    if (!title || !slug) return showMessage("error", "Vui lòng nhập tên danh mục và slug.");

    setSaving(true);
    const payload = {
      title,
      slug,
      description: categoryForm.description.trim() || null,
      icon: categoryForm.icon.trim() || null,
      sort_order: Number(categoryForm.sort_order) || 0,
      is_active: categoryForm.is_active,
    };
    const { error } = categoryForm.id
      ? await supabase.from("help_categories").update(payload).eq("id", categoryForm.id)
      : await supabase.from("help_categories").insert(payload);
    setSaving(false);

    if (error) return showMessage("error", "Không lưu được danh mục: " + error.message);
    showMessage("success", categoryForm.id ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
    resetCategoryForm();
    await loadData();
  };

  const saveArticle = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = articleForm.title.trim();
    const slug = slugifyHelp(articleForm.slug || title);
    const contentHtml = editorRef.current?.innerHTML || articleForm.content_html;
    if (!title || !slug) return showMessage("error", "Vui lòng nhập tiêu đề và slug.");
    if (articleForm.audiences.length === 0) return showMessage("error", "Vui lòng chọn đối tượng được xem.");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      category_id: articleForm.category_id || null,
      title,
      slug,
      description: articleForm.description.trim() || null,
      content_html: contentHtml,
      cover_image_url: articleForm.cover_image_url.trim() || null,
      image_urls: articleForm.image_urls,
      video_url: articleForm.video_url.trim() || null,
      sort_order: Number(articleForm.sort_order) || 0,
      status: articleForm.status,
      is_featured: articleForm.is_featured,
      audiences: articleForm.audiences,
      help_context: articleForm.help_context.trim() || null,
      updated_by: user?.id || null,
      published_at: articleForm.status === "published" ? new Date().toISOString() : null,
    };
    const { error } = articleForm.id
      ? await supabase.from("help_articles").update(payload).eq("id", articleForm.id)
      : await supabase.from("help_articles").insert({ ...payload, created_by: user?.id || null });
    setSaving(false);

    if (error) return showMessage("error", "Không lưu được bài: " + error.message);
    showMessage("success", articleForm.id ? "Đã cập nhật bài hướng dẫn." : "Đã tạo bài hướng dẫn.");
    resetArticleForm();
    await loadData();
  };

  const deleteArticle = async (article: HelpArticle) => {
    if (!window.confirm("Xóa bài hướng dẫn " + article.title + "?")) return;
    const { error } = await supabase.from("help_articles").delete().eq("id", article.id);
    if (error) return showMessage("error", "Không xóa được bài: " + error.message);
    setArticles((current) => current.filter((item) => item.id !== article.id));
    if (articleForm.id === article.id) resetArticleForm();
  };

  const deleteCategory = async (category: HelpCategory) => {
    if (!window.confirm("Xóa danh mục " + category.title + "? Các bài trong danh mục sẽ được bỏ gán danh mục.")) return;
    const { error } = await supabase.from("help_categories").delete().eq("id", category.id);
    if (error) return showMessage("error", "Không xóa được danh mục: " + error.message);
    setCategories((current) => current.filter((item) => item.id !== category.id));
    if (categoryForm.id === category.id) resetCategoryForm();
  };

  return (
    <div className="space-y-6">
      {message && <div className={"fixed left-1/2 top-4 z-50 w-11/12 max-w-sm -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg " + (message.type === "success" ? "border-success/30 bg-success-container text-success" : "border-error/30 bg-error-container text-error")}>{message.text}</div>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">Quản lý hướng dẫn</h1>
          <p className="text-body-sm text-on-surface-variant">Đăng bài hướng dẫn theo vai trò, dùng chung cho /huong-dan và /huong-dan/[slug].</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/huong-dan" target="_blank" className="btn-outline !py-2.5"><Eye size={16} /> Xem trang hướng dẫn</Link>
          <button type="button" onClick={resetArticleForm} className="btn-primary !py-2.5"><Plus size={16} /> Bài mới</button>
        </div>
      </div>

      <form onSubmit={saveCategory} className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-fixed text-primary-container"><FileText size={20} /></div>
            <div>
              <h2 className="font-bold text-on-surface">{categoryForm.id ? "Chỉnh sửa danh mục" : "Danh mục hướng dẫn"}</h2>
              <p className="text-xs text-on-surface-variant">Danh mục chỉ hiện khi có bài published phù hợp quyền người xem.</p>
            </div>
          </div>
          <button type="button" onClick={resetCategoryForm} className="btn-outline !min-h-10 !px-3 !py-2 text-xs"><Plus size={14} /> Mới</button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_8rem_8rem]">
          <label className="space-y-1.5 text-label-sm">Tên danh mục<input className="input-field" value={categoryForm.title} onChange={(event) => { const title = event.target.value; setCategoryForm((current) => ({ ...current, title, slug: current.id || current.slug ? current.slug : slugifyHelp(title) })); }} required /></label>
          <label className="space-y-1.5 text-label-sm">Slug<input className="input-field" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: slugifyHelp(event.target.value) })} required /></label>
          <label className="space-y-1.5 text-label-sm">Icon<input className="input-field" value={categoryForm.icon} onChange={(event) => setCategoryForm({ ...categoryForm, icon: event.target.value })} placeholder="book" /></label>
          <label className="space-y-1.5 text-label-sm">Thứ tự<input type="number" className="input-field" value={categoryForm.sort_order} onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: event.target.value })} /></label>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-1.5 text-label-sm">Mô tả<input className="input-field" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-bold text-on-surface"><input type="checkbox" checked={categoryForm.is_active} onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })} /> Đang bật</label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-on-surface">
                {category.title}
                <button type="button" title="Edit" onClick={() => editCategory(category)}><Edit3 size={13} /></button>
                <button type="button" title="Delete" onClick={() => deleteCategory(category)}><Trash2 size={13} className="text-error" /></button>
              </span>
            ))}
          </div>
          <button type="submit" disabled={saving} className="btn-primary justify-center !py-2.5"><Save size={16} /> Lưu danh mục</button>
        </div>
      </form>

      <form onSubmit={saveArticle} className="card space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-fixed text-primary-container"><Edit3 size={20} /></div>
            <div>
              <h2 className="font-bold text-on-surface">{articleForm.id ? "Chỉnh sửa bài hướng dẫn" : "Tạo bài hướng dẫn"}</h2>
              <p className="text-xs text-on-surface-variant">Một bài có thể chọn nhiều đối tượng được xem.</p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm font-bold">
            <input type="checkbox" checked={articleForm.is_featured} onChange={(event) => setArticleForm({ ...articleForm, is_featured: event.target.checked })} />
            <Star size={16} className={articleForm.is_featured ? "fill-primary text-primary" : ""} />
            Nổi bật
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">Danh mục<select className="input-field" value={articleForm.category_id} onChange={(event) => setArticleForm({ ...articleForm, category_id: event.target.value })}><option value="">Chưa phân loại</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
              <label className="space-y-1.5 text-label-sm">Trạng thái<select className="input-field" value={articleForm.status} onChange={(event) => setArticleForm({ ...articleForm, status: event.target.value as HelpStatus })}>{Object.entries(helpStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">Tiêu đề<input className="input-field" value={articleForm.title} onChange={(event) => { const title = event.target.value; setArticleForm((current) => ({ ...current, title, slug: current.id || current.slug ? current.slug : slugifyHelp(title) })); }} required /></label>
              <label className="space-y-1.5 text-label-sm">Slug<input className="input-field" value={articleForm.slug} onChange={(event) => setArticleForm({ ...articleForm, slug: slugifyHelp(event.target.value) })} required /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
              <label className="space-y-1.5 text-label-sm">Mô tả<input className="input-field" value={articleForm.description} onChange={(event) => setArticleForm({ ...articleForm, description: event.target.value })} /></label>
              <label className="space-y-1.5 text-label-sm">Thứ tự<input type="number" className="input-field" value={articleForm.sort_order} onChange={(event) => setArticleForm({ ...articleForm, sort_order: event.target.value })} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">YouTube/video URL<input className="input-field" value={articleForm.video_url} onChange={(event) => setArticleForm({ ...articleForm, video_url: event.target.value })} placeholder="https://youtu.be/..." /></label>
              <label className="space-y-1.5 text-label-sm">Help context<input className="input-field" value={articleForm.help_context} onChange={(event) => setArticleForm({ ...articleForm, help_context: slugifyHelp(event.target.value) })} placeholder="worker-billgo-complete" /></label>
            </div>

            <section className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <h3 className="mb-3 text-sm font-bold text-on-surface">Đối tượng được xem</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {helpAudiences.map((audience) => (
                  <label key={audience} className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-semibold text-on-surface">
                    <input type="checkbox" checked={articleForm.audiences.includes(audience)} onChange={() => toggleAudience(audience)} />
                    {helpAudienceLabels[audience]}
                  </label>
                ))}
              </div>
            </section>

            <div className="overflow-hidden rounded-lg border border-outline-variant/50">
              <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/40 bg-surface-container-low p-2">
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Bold" onClick={() => runCommand("bold")}><Bold className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Italic" onClick={() => runCommand("italic")}><Italic className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Heading" onClick={() => runCommand("formatBlock", "h2")}><Heading2 className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="List" onClick={() => runCommand("insertUnorderedList")}><List className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Link" onClick={() => { const url = window.prompt("URL"); if (url) runCommand("createLink", url); }}><LinkIcon className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-white" title="Images" onClick={() => inlineImageInputRef.current?.click()}><ImagePlus className="mx-auto h-4 w-4" /></button>
              </div>
              <div ref={editorRef} contentEditable className="cms-editor min-h-[320px] bg-white p-4 text-sm leading-7 text-on-surface outline-none" onInput={(event) => setArticleForm({ ...articleForm, content_html: event.currentTarget.innerHTML })} suppressContentEditableWarning />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-on-surface">Ảnh đại diện</span>{articleForm.cover_image_url && <button type="button" title="Remove" className="h-8 w-8 rounded-lg hover:bg-error-container" onClick={() => setArticleForm({ ...articleForm, cover_image_url: "" })}><X className="mx-auto h-4 w-4 text-error" /></button>}</div>
              <button type="button" onClick={() => coverInputRef.current?.click()} className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-white text-sm font-semibold text-on-surface-variant">
                {articleForm.cover_image_url ? <Image src={articleForm.cover_image_url} alt="" fill sizes="300px" className="object-cover" unoptimized /> : <span className="flex items-center gap-2"><ImagePlus size={18} /> Upload</span>}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-on-surface">Ảnh trong bài</span><button type="button" onClick={() => galleryInputRef.current?.click()} className="h-8 w-8 rounded-lg hover:bg-white" title="Upload"><ImagePlus className="mx-auto h-4 w-4" /></button></div>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
              <input ref={inlineImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInlineImageUpload} />
              {articleForm.image_urls.length === 0 ? <div className="rounded-lg border border-dashed border-outline-variant bg-white p-4 text-center text-xs font-semibold text-on-surface-variant">Chưa có ảnh.</div> : (
                <div className="grid grid-cols-3 gap-2">{articleForm.image_urls.map((url) => <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-white"><Image src={url} alt="" fill sizes="96px" className="object-cover" unoptimized /><button type="button" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" onClick={() => setArticleForm((current) => ({ ...current, image_urls: current.image_urls.filter((item) => item !== url), cover_image_url: current.cover_image_url === url ? "" : current.cover_image_url }))} title="Remove"><X size={13} /></button></div>)}</div>
              )}
            </div>

            <button type="submit" disabled={saving || uploading} className="btn-primary w-full justify-center"><Save size={18} /> {saving ? "Đang lưu..." : uploading ? "Đang upload..." : "Lưu bài hướng dẫn"}</button>
          </aside>
        </div>
      </form>

      <section className="admin-table-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-bold text-on-surface">Danh sách bài hướng dẫn</h2><p className="text-xs text-on-surface-variant">{articles.length} bài trong CMS</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="search" className="input-field min-w-[220px]" placeholder="Tìm bài" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="input-field sm:w-40" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Tất cả</option>{Object.entries(helpStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-on-surface-variant">Loading...</div> : filteredArticles.length === 0 ? <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có bài.</div> : (
          <div className="divide-y divide-outline-variant/30">{filteredArticles.map((article) => (
            <div key={article.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_140px_180px] lg:items-center">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={"badge " + (article.status === "published" ? "badge-active" : "badge-inactive")}>{helpStatusLabels[article.status || "draft"]}</span>
                  {article.is_featured && <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary-container">Nổi bật</span>}
                  <span className="text-xs font-semibold text-on-surface-variant">/{article.slug}</span>
                </div>
                <h3 className="truncate font-bold text-on-surface">{article.title}</h3>
                <p className="line-clamp-2 text-sm text-on-surface-variant">{article.description || "Không có mô tả."}</p>
                <div className="mt-2 flex flex-wrap gap-1">{(article.audiences || []).map((audience) => <span key={audience} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">{helpAudienceLabels[audience]}</span>)}</div>
              </div>
              <Link href={`/huong-dan/${article.slug}`} target="_blank" className="btn-outline justify-center !py-2 text-sm"><Eye size={16} /> View</Link>
              <div className="flex items-center justify-start gap-1 lg:justify-end">
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Edit" onClick={() => editArticle(article)}><Edit3 className="mx-auto h-4 w-4" /></button>
                <button type="button" className="h-9 w-9 rounded-lg hover:bg-error-container" title="Delete" onClick={() => deleteArticle(article)}><Trash2 className="mx-auto h-4 w-4 text-error" /></button>
              </div>
            </div>
          ))}</div>
        )}
      </section>
    </div>
  );
}
