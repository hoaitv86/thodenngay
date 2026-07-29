export const SUPER_ADMIN_FALLBACK_EMAIL = "superadmin@alotho.local";

export type AdminModule =
  | "workers"
  | "customers"
  | "jobs"
  | "services"
  | "billgo"
  | "sales"
  | "content"
  | "analytics";

export type AdminAction = "view" | "manage";

export type AdminPermission = {
  module: AdminModule;
  can_view: boolean;
  can_manage: boolean;
};

export const ADMIN_MODULES: Array<{ key: AdminModule; label: string; description: string }> = [
  { key: "workers", label: "Thợ", description: "Quản lý hồ sơ, duyệt và khóa thợ" },
  { key: "customers", label: "Khách hàng", description: "Quản lý hồ sơ, lịch sử và trạng thái khách" },
  { key: "jobs", label: "Công việc", description: "Tạo, điều phối và duyệt công việc" },
  { key: "services", label: "Dịch vụ", description: "Quản lý danh mục dịch vụ và giá" },
  { key: "billgo", label: "BillGo", description: "Quản lý công nợ, thu tiền và gói cước" },
  { key: "sales", label: "Bán hàng", description: "Theo dõi đơn bán hàng và doanh thu" },
  { key: "content", label: "Bài viết", description: "Quản lý nội dung, trang tĩnh và CMS" },
  { key: "analytics", label: "Thống kê", description: "Xem dashboard và báo cáo tổng quan" },
];

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_MODULES.map((item) => ({
  module: item.key,
  can_view: true,
  can_manage: true,
}));

export function getSuperAdminEmail() {
  return process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || SUPER_ADMIN_FALLBACK_EMAIL;
}
