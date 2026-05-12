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
    <div className="px-4 pt-4">
      <h1 className="text-headline-md">Tài khoản</h1>
      <p className="text-body-sm mt-1 mb-6">
        Quản lý thông tin cá nhân của bạn.
      </p>
      
      <ProfileClient initialData={profile} />
    </div>
  );
}
