import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function CustomerProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="px-4 pt-4 lg:px-8">
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#003178] via-[#0d47a1] to-[#fd6c00] p-5 text-white shadow-xl shadow-primary/15">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Tài khoản khách hàng</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">Thông tin cá nhân</h1>
        <p className="mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Cập nhật liên hệ và địa chỉ để đặt dịch vụ nhanh hơn.
        </p>
      </div>
      <ProfileClient initialData={profile} />
    </div>
  );
}
