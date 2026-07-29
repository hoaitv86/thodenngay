export type CmsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

export type DefaultCmsPage = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  sortOrder: number;
};

export const defaultCmsPages: DefaultCmsPage[] = [
  {
    slug: "ve-tho-den-ngay",
    title: "Về Thợ Đến Ngay",
    excerpt: "Giới thiệu nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp.",
    sortOrder: 10,
    contentHtml: "<p>Thợ Đến Ngay là nền tảng hỗ trợ khách hàng tìm thợ sửa chữa, lắp đặt và bảo trì tại nhà một cách nhanh chóng, minh bạch và thuận tiện.</p><p>Chúng tôi xây dựng quy trình đặt lịch, xác nhận công việc, theo dõi trạng thái và đánh giá sau dịch vụ để nâng cao trải nghiệm cho cả khách hàng và đội ngũ thợ.</p>",
  },
  {
    slug: "dieu-khoan-su-dung",
    title: "Điều khoản sử dụng",
    excerpt: "Các điều kiện khi truy cập, đăng ký và sử dụng dịch vụ Thợ Đến Ngay.",
    sortOrder: 20,
    contentHtml: "<p>Khi sử dụng Thợ Đến Ngay, người dùng đồng ý cung cấp thông tin chính xác, tuân thủ quy trình đặt dịch vụ và thanh toán các chi phí đã được xác nhận.</p><p>Nền tảng có quyền cập nhật điều khoản để phù hợp với vận hành thực tế và quy định pháp luật.</p>",
  },
  {
    slug: "chinh-sach-bao-mat",
    title: "Chính sách bảo mật",
    excerpt: "Cách Thợ Đến Ngay thu thập, sử dụng và bảo vệ thông tin cá nhân.",
    sortOrder: 30,
    contentHtml: "<p>Thợ Đến Ngay chỉ thu thập thông tin cần thiết để cung cấp dịch vụ, xác thực tài khoản, điều phối thợ và chăm sóc khách hàng.</p><p>Thông tin cá nhân được bảo vệ bằng các biện pháp phù hợp và chỉ chia sẻ trong phạm vi cần thiết cho việc thực hiện dịch vụ hoặc theo yêu cầu pháp luật.</p>",
  },
  {
    slug: "chinh-sach-danh-cho-tho",
    title: "Chính sách dành cho thợ",
    excerpt: "Quy định tham gia, nhận việc, chất lượng dịch vụ và trách nhiệm của thợ.",
    sortOrder: 40,
    contentHtml: "<p>Thợ tham gia nền tảng cần cung cấp hồ sơ chính xác, nhận việc đúng khả năng chuyên môn và thực hiện dịch vụ với thái độ chuyên nghiệp.</p><p>Thợ có trách nhiệm báo giá rõ ràng, cập nhật trạng thái công việc và tuân thủ quy chuẩn an toàn trong quá trình thi công.</p>",
  },
  {
    slug: "chinh-sach-danh-cho-khach-hang",
    title: "Chính sách dành cho khách hàng",
    excerpt: "Quyền lợi, trách nhiệm và hướng dẫn sử dụng dịch vụ cho khách hàng.",
    sortOrder: 50,
    contentHtml: "<p>Khách hàng có quyền nhận thông tin dịch vụ, chi phí dự kiến và trạng thái xử lý công việc một cách minh bạch.</p><p>Khách hàng cần cung cấp địa chỉ, mô tả sự cố và thông tin liên hệ chính xác để quá trình điều phối được nhanh chóng.</p>",
  },
  {
    slug: "quy-che-hoat-dong",
    title: "Quy chế hoạt động",
    excerpt: "Nguyên tắc vận hành, điều phối dịch vụ và xử lý phát sinh trên nền tảng.",
    sortOrder: 60,
    contentHtml: "<p>Thợ Đến Ngay vận hành theo mô hình kết nối nhu cầu sửa chữa của khách hàng với đội ngũ thợ phù hợp theo khu vực, chuyên môn và trạng thái sẵn sàng.</p><p>Các phát sinh trong quá trình sử dụng dịch vụ sẽ được ghi nhận, xác minh và xử lý dựa trên dữ liệu công việc, trao đổi giữa các bên và quy định hiện hành.</p>",
  },
  {
    slug: "lien-he",
    title: "Liên hệ",
    excerpt: "Thông tin liên hệ và kênh hỗ trợ chính thức của Thợ Đến Ngay.",
    sortOrder: 70,
    contentHtml: "<p>Đội ngũ Thợ Đến Ngay luôn sẵn sàng tiếp nhận phản hồi, hỗ trợ tài khoản và xử lý các vấn đề phát sinh trong quá trình sử dụng dịch vụ.</p><p>Vui lòng liên hệ qua hotline, email hỗ trợ hoặc các kênh chính thức được công bố trên ứng dụng.</p>",
  },
];

export const defaultCmsSlugs = defaultCmsPages.map((page) => page.slug);

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
