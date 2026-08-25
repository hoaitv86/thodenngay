export const journeyStatuses = ["draft", "published"] as const;

export type JourneyPostStatus = (typeof journeyStatuses)[number];

export type JourneyPost = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  sort_order: number;
  status: JourneyPostStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DefaultJourneyPost = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  sortOrder: number;
  status: JourneyPostStatus;
};

export const journeyStatusLabels: Record<JourneyPostStatus, string> = {
  draft: "Nháp",
  published: "Công khai",
};

export const defaultJourneyPosts: DefaultJourneyPost[] = [
  {
    title: "2026 – Xây dựng nền tảng",
    slug: "2026-xay-dung-nen-tang",
    summary: "Giai đoạn đặt nền móng cho hệ sinh thái Thợ Đến Ngay, chuẩn hóa vận hành và trải nghiệm cốt lõi.",
    sortOrder: 10,
    status: "published",
    content:
      "<h2>Đang chờ nội dung chính thức</h2><p>Nội dung chi tiết cho chặng 2026 sẽ được cập nhật theo bản người quản trị gửi sau. Bài viết này đang đóng vai trò khung ban đầu để hệ thống Hành trình có thể vận hành bằng Admin.</p><ul><li>Xây dựng nền tảng đặt dịch vụ và điều phối thợ.</li><li>Chuẩn hóa tài khoản khách hàng, thợ và quản trị.</li><li>Hoàn thiện các dữ liệu vận hành cần thiết.</li></ul>",
  },
  {
    title: "Đang phát triển",
    slug: "dang-phat-trien",
    summary: "Các hạng mục đang được hoàn thiện để giúp khách hàng và thợ làm việc nhanh, rõ ràng hơn.",
    sortOrder: 20,
    status: "published",
    content:
      "<h2>Những phần đang phát triển</h2><p>Thợ Đến Ngay đang tiếp tục hoàn thiện trải nghiệm đặt dịch vụ, quản lý công việc, chăm sóc khách hàng và các công cụ hỗ trợ thợ trong quá trình nhận việc.</p><ul><li>Tối ưu luồng điều phối và nhận việc.</li><li>Nâng cấp quản lý khách hàng và lịch sử dịch vụ.</li><li>Cải thiện hiệu năng và trải nghiệm trên di động.</li></ul>",
  },
  {
    title: "Kế hoạch tiếp theo",
    slug: "ke-hoach-tiep-theo",
    summary: "Những bước tiếp theo tập trung vào độ ổn định, dữ liệu vận hành và mở rộng dịch vụ.",
    sortOrder: 30,
    status: "published",
    content:
      "<h2>Định hướng gần hạn</h2><p>Giai đoạn tiếp theo ưu tiên các tính năng giúp nền tảng vận hành ổn định hơn, dễ đo lường hơn và tạo thêm giá trị cho cả khách hàng lẫn đội ngũ thợ.</p><ul><li>Mở rộng nhóm dịch vụ và danh mục báo giá.</li><li>Hoàn thiện báo cáo vận hành theo thời gian thực.</li><li>Tăng cường kiểm soát chất lượng dịch vụ.</li></ul>",
  },
  {
    title: "Tầm nhìn dài hạn",
    slug: "tam-nhin-dai-han",
    summary: "Xây dựng một mạng lưới thợ dịch vụ đáng tin cậy, minh bạch và gần khách hàng hơn.",
    sortOrder: 40,
    status: "published",
    content:
      "<h2>Tầm nhìn</h2><p>Thợ Đến Ngay hướng tới việc trở thành nền tảng kết nối dịch vụ tại nhà đáng tin cậy, nơi khách hàng dễ tìm được thợ phù hợp và thợ có thêm công cụ để phát triển nghề nghiệp bền vững.</p><ul><li>Minh bạch về chất lượng và lịch sử dịch vụ.</li><li>Hỗ trợ thợ phát triển hồ sơ nghề nghiệp.</li><li>Đưa dịch vụ sửa chữa đến gần người dùng hơn.</li></ul>",
  },
  {
    title: "Hợp tác cùng Thợ Đến Ngay",
    slug: "hop-tac-cung-tho-den-ngay",
    summary: "Cơ hội hợp tác cho thợ, đơn vị dịch vụ và đối tác muốn cùng mở rộng hệ sinh thái.",
    sortOrder: 50,
    status: "published",
    content:
      "<h2>Cùng xây dựng mạng lưới dịch vụ</h2><p>Thợ Đến Ngay luôn chào đón các thợ chuyên nghiệp, đội nhóm dịch vụ và đối tác địa phương cùng tham gia xây dựng hệ sinh thái dịch vụ tại nhà nhanh, rõ ràng và uy tín.</p><ul><li>Thợ có thể mở rộng nguồn việc và hồ sơ uy tín.</li><li>Đối tác địa phương có thêm kênh tiếp cận khách hàng.</li><li>Khách hàng được phục vụ bởi mạng lưới được quản lý tốt hơn.</li></ul>",
  },
];

export const defaultJourneySlugs = defaultJourneyPosts.map((post) => post.slug);

export function slugifyJourneyTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function stripJourneyHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
