"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Phone, MapPin, Mail, Save, Loader2, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type ProfileInitialData = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
};

export default function ProfileClient({ initialData }: { initialData: ProfileInitialData }) {
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const supabase = createClient();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
      })
      .eq('id', initialData.id)
      .select();

    setLoading(false);

    if (error) {
      setMessage({ text: "Cập nhật thất bại. Vui lòng thử lại.", type: "error" });
    } else if (!data || data.length === 0) {
      setMessage({ text: "Không thể cập nhật. (Thiếu Policy UPDATE trên Supabase)", type: "error" });
    } else {
      setMessage({ text: "Cập nhật thông tin thành công!", type: "success" });
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col items-center rounded-lg border border-outline-variant bg-white p-5 shadow-card">
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary-container shadow-lg shadow-primary/20">
          <UserCircle className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-on-surface">{initialData?.full_name}</h2>
          <p className="text-body-md mt-1 break-all">{initialData?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-outline-variant bg-white p-4 shadow-card sm:p-5 lg:grid-cols-2">
        {/* Email - Readonly */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-label-md">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-outline" />
            </div>
            <input
              type="email"
              value={initialData?.email || ""}
              disabled
              className="input-field pl-10 opacity-70 cursor-not-allowed bg-surface-container"
            />
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-label-md">Họ và tên</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-outline" />
            </div>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="input-field pl-10"
              placeholder="Nhập họ và tên"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-label-md">Số điện thoại</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-outline" />
            </div>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input-field pl-10"
              placeholder="Nhập số điện thoại"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1">
          <label className="text-label-md">Địa chỉ</label>
          <div className="relative">
            <div className="absolute top-3 left-3 flex items-start pointer-events-none">
              <MapPin className="h-5 w-5 text-outline" />
            </div>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className="input-field pl-10 resize-none py-3"
              placeholder="Nhập địa chỉ của bạn"
            />
          </div>
        </div>

        {message.text && (
          <div className={`p-3 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-error-container text-error' : 'bg-success-container text-success'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary-container px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition-all hover:bg-primary active:scale-[0.98] disabled:opacity-50 lg:col-span-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Lưu thay đổi</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
