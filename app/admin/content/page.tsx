"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bold, Edit3, Eye, EyeOff, FileText, Heading2, ImagePlus, Italic, Link as LinkIcon, List, Plus, Save, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cmsContentTypeLabels, cmsDisplayLocationLabels, cmsDisplayLocations, cmsStatusLabels, defaultCmsPages, type CmsContentType, type CmsDisplayLocation, type CmsPost, type CmsStatus } from "@/lib/cms";

type CmsFormState = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  cover_image_url: string;
  image_urls: string[];
  display_locations: CmsDisplayLocation[];
  content_type: CmsContentType;
  status: CmsStatus;
  is_published: boolean;
  sort_order: string;
  updated_at: string | null;
};

const emptyForm: CmsFormState = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  content_html: "<p></p>",
  cover_image_url: "",
  image_urls: [],
  display_locations: ["footer", "app_info"],
  content_type: "fixed_page",
  status: "published",
  is_published: true,
  sort_order: "0",
  updated_at: null,
};

const legacyCmsSlugPairs = [
  { canonical: "chinh-sach-tho", legacy: "chinh-sach-danh-cho-tho" },
  { canonical: "chinh-sach-khach-hang", legacy: "chinh-sach-danh-cho-khach-hang" },
] as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Unknown error";
}

export default function AdminContentPage() {
  const supabase = useMemo(() => createClient(), []);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const [posts, setPosts] = useState<CmsPost[]>([]);
  const [form, setForm] = useState<CmsFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | CmsDisplayLocation>("all");
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
      .select("id,slug,title,excerpt,content_html,cover_image_url,image_urls,display_locations,content_type,status,is_published,sort_order,created_at,updated_at,published_at")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) showMessage("error", "Khong tai duoc bai viet: " + error.message);
    else setPosts((data || []) as CmsPost[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== form.content_html) {
      editorRef.current.innerHTML = form.content_html || "<p></p>";
    }
  }, [form.id, form.content_html]);

  const filteredPosts = posts.filter((post) => {
    const query = search.trim().toLowerCase();
    const locations = post.display_locations || [];
    const matchesSearch = !query || (post.title + " " + post.slug + " " + (post.excerpt || "")).toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || (statusFilter === "published" && post.is_published) || (statusFilter === "hidden" && !post.is_published);
    const matchesLocation = locationFilter === "all" || locations.includes(locationFilter);
    return matchesSearch && matchesStatus && matchesLocation;
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
      image_urls: post.image_urls || [],
      display_locations: post.display_locations?.length ? post.display_locations : ["footer", "app_info"],
      content_type: post.content_type || "article",
      status: post.status || (post.is_published ? "published" : "draft"),
      is_published: post.status ? post.status === "published" : post.is_published,
      sort_order: String(post.sort_order || 0),
      updated_at: post.updated_at || null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canonicalizeLegacyPages = async () => {
    for (const pair of legacyCmsSlugPairs) {
      const { data, error } = await supabase
        .from("cms_posts")
        .select("id,slug,title,excerpt,content_html,cover_image_url,image_urls,display_locations,content_type,status,is_published,sort_order,published_at")
        .in("slug", [pair.canonical, pair.legacy]);

      if (error) throw error;

      const rows = (data || []) as CmsPost[];
      const canonical = rows.find((row) => row.slug === pair.canonical);
      const legacy = rows.find((row) => row.slug === pair.legacy);
      if (!legacy) continue;

      if (!canonical) {
        const defaultPage = defaultCmsPages.find((page) => page.slug === pair.canonical);
        const { error: renameError } = await supabase
          .from("cms_posts")
          .update({
            slug: pair.canonical,
            title: defaultPage?.title || legacy.title,
            display_locations: Array.from(new Set([...(legacy.display_locations || []), "footer", "app_info"])),
            content_type: "fixed_page",
            sort_order: defaultPage?.sortOrder || legacy.sort_order || 0,
          })
          .eq("id", legacy.id);
        if (renameError) throw renameError;
        continue;
      }

      const legacyContent = (legacy.content_html || "").trim();
      const canonicalContent = (canonical.content_html || "").trim();
      const legacyExcerpt = (legacy.excerpt || "").trim();
      const canonicalExcerpt = (canonical.excerpt || "").trim();

      const { error: updateError } = await supabase
        .from("cms_posts")
        .update({
          excerpt: legacyExcerpt.length > canonicalExcerpt.length ? legacy.excerpt : canonical.excerpt,
          content_html: legacyContent.length > canonicalContent.length ? legacy.content_html : canonical.content_html,
          cover_image_url: canonical.cover_image_url || legacy.cover_image_url || null,
          image_urls: Array.from(new Set([...(canonical.image_urls || []), ...(legacy.image_urls || [])])),
          display_locations: Array.from(new Set([...(canonical.display_locations || []), ...(legacy.display_locations || []), "footer", "app_info"])),
          content_type: "fixed_page",
        })
        .eq("id", canonical.id);
      if (updateError) throw updateError;

      const { error: deleteError } = await supabase.from("cms_posts").delete().eq("id", legacy.id);
      if (deleteError) throw deleteError;
    }
  };

  const seedDefaults = async () => {
    setSaving(true);
    try {
      await canonicalizeLegacyPages();
    } catch (error) {
      setSaving(false);
      showMessage("error", "Khong gop duoc trang noi dung trung: " + getErrorMessage(error));
      return;
    }

    const payload = defaultCmsPages.map((page) => ({
      slug: page.slug,
      title: page.title,
      excerpt: null,
      content_html: "",
      cover_image_url: null,
      image_urls: [],
      display_locations: page.displayLocations,
      content_type: page.contentType,
      status: page.status,
      is_published: page.status === "published",
      sort_order: page.sortOrder,
      published_at: page.status === "published" ? new Date().toISOString() : null,
    }));
    const { error } = await supabase.from("cms_posts").upsert(payload, { onConflict: "slug", ignoreDuplicates: true });
    setSaving(false);
    if (error) showMessage("error", "Khong tao duoc trang noi dung: " + error.message);
    else {
      showMessage("success", "Da tao cac trang noi dung con thieu trong Supabase.");
      await loadPosts();
    }
  };

  const uploadImage = async (file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = "content/" + Date.now() + "-" + crypto.randomUUID() + "-" + safeName;
    const { error } = await supabase.storage.from("cms-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("cms-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return [];
    setUploading(true);
    try { return await Promise.all(selectedFiles.map(uploadImage)); }
    finally { setUploading(false); }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    try {
      const [publicUrl] = await uploadFiles(files);
      setForm((current) => ({ ...current, cover_image_url: publicUrl || current.cover_image_url }));
      showMessage("success", "Da upload anh dai dien.");
    } catch (error) {
      showMessage("error", "Upload anh that bai: " + getErrorMessage(error));
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    try {
      const urls = await uploadFiles(files);
      setForm((current) => ({ ...current, image_urls: [...current.image_urls, ...urls], cover_image_url: current.cover_image_url || urls[0] || "" }));
      showMessage("success", "Da upload " + urls.length + " anh.");
    } catch (error) {
      showMessage("error", "Upload anh that bai: " + getErrorMessage(error));
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
      setForm((current) => ({ ...current, content_html: editorRef.current?.innerHTML || current.content_html, image_urls: [...current.image_urls, ...urls], cover_image_url: current.cover_image_url || urls[0] || "" }));
      showMessage("success", "Da chen " + urls.length + " anh vao bai viet.");
    } catch (error) {
      showMessage("error", "Upload anh that bai: " + getErrorMessage(error));
    }
  };

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setForm((current) => ({ ...current, content_html: editorRef.current?.innerHTML || current.content_html }));
  };

  const toggleLocation = (location: CmsDisplayLocation) => {
    setForm((current) => {
      const exists = current.display_locations.includes(location);
      return { ...current, display_locations: exists ? current.display_locations.filter((item) => item !== location) : [...current.display_locations, location] };
    });
  };

  const removeGalleryImage = (url: string) => {
    setForm((current) => ({ ...current, image_urls: current.image_urls.filter((item) => item !== url), cover_image_url: current.cover_image_url === url ? "" : current.cover_image_url }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    const slug = slugify(form.slug || form.title);
    const contentHtml = editorRef.current?.innerHTML || form.content_html;
    if (!title || !slug) return showMessage("error", "Vui long nhap tieu de va slug.");
    if (form.display_locations.length === 0) return showMessage("error", "Vui long chon vi tri hien thi.");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title,
      slug,
      excerpt: form.excerpt.trim() || null,
      content_html: contentHtml,
      cover_image_url: form.cover_image_url.trim() || null,
      image_urls: form.image_urls,
      display_locations: form.display_locations,
      content_type: form.content_type,
      status: form.status,
      is_published: form.status === "published",
      sort_order: Number(form.sort_order) || 0,
      updated_by: user?.id || null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };
    const { error } = form.id
      ? await supabase.from("cms_posts").update(payload).eq("id", form.id)
      : await supabase.from("cms_posts").insert({ ...payload, created_by: user?.id || null });
    setSaving(false);
    if (error) return showMessage("error", "Khong luu duoc bai viet: " + error.message);
    showMessage("success", form.id ? "Da cap nhat bai viet." : "Da tao bai viet.");
    resetForm();
    await loadPosts();
  };

  const togglePublish = async (post: CmsPost) => {
    const nextPublished = !post.is_published;
    const { error } = await supabase.from("cms_posts").update({ is_published: nextPublished, status: nextPublished ? "published" : "draft", published_at: nextPublished ? new Date().toISOString() : null }).eq("id", post.id);
    if (error) return showMessage("error", "Khong doi trang thai duoc: " + error.message);
    setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, is_published: nextPublished, status: nextPublished ? "published" : "draft" } : item)));
  };

  const deletePost = async (post: CmsPost) => {
    if (!window.confirm("Xoa bai viet " + post.title + "?")) return;
    const { error } = await supabase.from("cms_posts").delete().eq("id", post.id);
    if (error) return showMessage("error", "Khong xoa duoc bai viet: " + error.message);
    setPosts((current) => current.filter((item) => item.id !== post.id));
    if (form.id === post.id) resetForm();
    showMessage("success", "Da xoa bai viet.");
  };

  return (
    <div className="space-y-6">
      {message && <div className={"fixed left-1/2 top-4 z-50 w-11/12 max-w-sm -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg " + (message.type === "success" ? "border-success/30 bg-success-container text-success" : "border-error/30 bg-error-container text-error")}>{message.text}</div>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">{"Trang nội dung"}</h1>
          <p className="text-body-sm text-on-surface-variant">{"Sửa tiêu đề, nội dung, trạng thái công khai và thời điểm cập nhật của các trang tĩnh."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/content" className="btn-outline !py-2.5"><FileText size={16} /> {"Bài viết"}</Link>
          <button type="button" onClick={seedDefaults} disabled={saving} className="btn-outline !py-2.5"><FileText size={16} /> {"Tạo 5 trang trống"}</button>
          <button type="button" onClick={resetForm} className="btn-primary !py-2.5"><Plus size={16} /> {"Bài viết mới"}</button>
        </div>
      </div>

      <form onSubmit={handleSave} className="card space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-fixed text-primary-container"><Edit3 size={20} /></div>
            <div>
              <h2 className="font-bold text-on-surface">{form.id ? "Chỉnh sửa trang nội dung" : "Tạo trang nội dung"}</h2>
              <p className="text-xs text-on-surface-variant">Admin &gt; {"Trang nội dung"}</p>
              {form.id && <p className="text-xs font-semibold text-on-surface-variant">{"Cập nhật lần cuối"}: {form.updated_at ? new Date(form.updated_at).toLocaleString("vi-VN") : "-"}</p>}
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="sr-only peer" checked={form.status === "published"} onChange={(event) => setForm({ ...form, status: event.target.checked ? "published" : "draft", is_published: event.target.checked })} />
            <div className="h-6 w-11 rounded-full bg-surface-container-high after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-success peer-checked:after:translate-x-full" />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">{"Lo\u1ea1i n\u1ed9i dung"}<select className="input-field" value={form.content_type} onChange={(event) => setForm({ ...form, content_type: event.target.value as CmsContentType })}>{Object.entries(cmsContentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="space-y-1.5 text-label-sm">{"Tr\u1ea1ng th\u00e1i"}<select className="input-field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CmsStatus, is_published: event.target.value === "published" })}>{Object.entries(cmsStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-label-sm">{"Tiêu đề"}<input className="input-field" value={form.title} onChange={(event) => { const title = event.target.value; setForm((current) => ({ ...current, title, slug: current.id || current.slug ? current.slug : slugify(title) })); }} required /></label>
              <label className="space-y-1.5 text-label-sm">Slug<input className="input-field" value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} placeholder="duong-dan-bai-viet" required /></label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_140px]">
              <label className="space-y-1.5 text-label-sm">{"Mô tả ngắn"}<input className="input-field" value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></label>
              <label className="space-y-1.5 text-label-sm">{"Thứ tự"}<input type="number" className="input-field" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></label>
            </div>

            <section className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <h3 className="mb-3 text-sm font-bold text-on-surface">{"Vị trí hiển thị"}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cmsDisplayLocations.map((location) => (
                  <label key={location} className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm font-semibold text-on-surface">
                    <input type="checkbox" checked={form.display_locations.includes(location)} onChange={() => toggleLocation(location)} />
                    {cmsDisplayLocationLabels[location]}
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
              <div ref={editorRef} contentEditable className="cms-editor min-h-[300px] bg-white p-4 text-sm leading-7 text-on-surface outline-none" onInput={(event) => setForm({ ...form, content_html: event.currentTarget.innerHTML })} suppressContentEditableWarning />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-on-surface">{"Ảnh đại diện"}</span>{form.cover_image_url && <button type="button" title="Remove" className="h-8 w-8 rounded-lg hover:bg-error-container" onClick={() => setForm({ ...form, cover_image_url: "" })}><X className="mx-auto h-4 w-4 text-error" /></button>}</div>
              <button type="button" onClick={() => coverInputRef.current?.click()} className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-white text-sm font-semibold text-on-surface-variant">
                {form.cover_image_url ? <Image src={form.cover_image_url} alt="" fill sizes="300px" className="object-cover" unoptimized /> : <span className="flex items-center gap-2"><ImagePlus size={18} /> Upload</span>}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-on-surface">{"Thư viện ảnh"}</span><button type="button" onClick={() => galleryInputRef.current?.click()} className="h-8 w-8 rounded-lg hover:bg-white" title="Upload"><ImagePlus className="mx-auto h-4 w-4" /></button></div>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
              <input ref={inlineImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInlineImageUpload} />
              {form.image_urls.length === 0 ? <div className="rounded-lg border border-dashed border-outline-variant bg-white p-4 text-center text-xs font-semibold text-on-surface-variant">{"Chưa có ảnh."}</div> : (
                <div className="grid grid-cols-3 gap-2">{form.image_urls.map((url) => <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-white"><Image src={url} alt="" fill sizes="96px" className="object-cover" unoptimized /><button type="button" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" onClick={() => removeGalleryImage(url)} title="Remove"><X size={13} /></button></div>)}</div>
              )}
            </div>

            <button type="submit" disabled={saving || uploading} className="btn-primary w-full justify-center"><Save size={18} /> {saving ? "Dang luu..." : uploading ? "Dang upload..." : "Luu bai viet"}</button>
          </aside>
        </div>
      </form>

      <section className="admin-table-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-bold text-on-surface">{"Danh sách trang nội dung"}</h2><p className="text-xs text-on-surface-variant">{posts.length} {"trang trong CMS"}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="search" className="input-field min-w-[220px]" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="input-field sm:w-44" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value as "all" | CmsDisplayLocation)}><option value="all">All locations</option>{cmsDisplayLocations.map((location) => <option key={location} value={location}>{cmsDisplayLocationLabels[location]}</option>)}</select>
            <select className="input-field sm:w-40" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All</option><option value="published">Visible</option><option value="hidden">Hidden</option></select>
          </div>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-on-surface-variant">Loading...</div> : filteredPosts.length === 0 ? <div className="p-8 text-center text-sm text-on-surface-variant">No posts.</div> : (
          <div className="divide-y divide-outline-variant/30">{filteredPosts.map((post) => {
            const locations = post.display_locations || [];
            return <div key={post.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_140px_180px] lg:items-center">
              <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className={"badge " + (post.status === "published" ? "badge-active" : "badge-inactive")}>{cmsStatusLabels[post.status || "draft"]}</span><span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary-container">{cmsContentTypeLabels[post.content_type || "article"]}</span><span className="text-xs font-semibold text-on-surface-variant">/{post.slug}</span></div><h3 className="truncate font-bold text-on-surface">{post.title}</h3><p className="line-clamp-2 text-sm text-on-surface-variant">{post.excerpt || "No excerpt."}</p><p className="mt-1 text-xs font-semibold text-on-surface-variant">Updated: {post.updated_at ? new Date(post.updated_at).toLocaleString("vi-VN") : "-"}</p><div className="mt-2 flex flex-wrap gap-1">{locations.map((location) => <span key={location} className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">{cmsDisplayLocationLabels[location]}</span>)}</div></div>
              <Link href={"/" + post.slug} target="_blank" className="btn-outline justify-center !py-2 text-sm"><Eye size={16} /> View</Link>
              <div className="flex items-center justify-start gap-1 lg:justify-end"><button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Edit" onClick={() => editPost(post)}><Edit3 className="mx-auto h-4 w-4" /></button><button type="button" className="h-9 w-9 rounded-lg hover:bg-surface-container" title="Toggle" onClick={() => togglePublish(post)}>{post.is_published ? <EyeOff className="mx-auto h-4 w-4" /> : <Eye className="mx-auto h-4 w-4" />}</button><button type="button" className="h-9 w-9 rounded-lg hover:bg-error-container" title="Delete" onClick={() => deletePost(post)}><Trash2 className="mx-auto h-4 w-4 text-error" /></button></div>
            </div>;
          })}</div>
        )}
      </section>
    </div>
  );
}
