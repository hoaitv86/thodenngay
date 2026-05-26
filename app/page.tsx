import Link from "next/link";
import {
  LogoIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  PhoneIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from "./components/icons";


const services = [
  {
    icon: ZapIcon,
    name: "Sửa điện",
    desc: "Sửa chữa, lắp đặt hệ thống điện dân dụng",
    color: "#f59e0b",
    bgColor: "#fef3c7",
  },
  {
    icon: DropletIcon,
    name: "Sửa nước",
    desc: "Khắc phục sự cố đường ống, vòi nước",
    color: "#3b82f6",
    bgColor: "#dbeafe",
  },
  {
    icon: CameraIcon,
    name: "Lắp camera",
    desc: "Tư vấn, lắp đặt camera an ninh",
    color: "#8b5cf6",
    bgColor: "#ede9fe",
  },
  {
    icon: CogIcon,
    name: "Cơ khí",
    desc: "Gia công, sửa chữa cơ khí tại chỗ",
    color: "#10b981",
    bgColor: "#d1fae5",
  },
];

const stats = [
  { value: "2,500+", label: "Lượt đặt dịch vụ" },
  { value: "150+", label: "Thợ chuyên nghiệp" },
  { value: "4.8", label: "Đánh giá trung bình" },
  { value: "<5 phút", label: "Thời gian phản hồi" },
];

const steps = [
  {
    step: "01",
    title: "Chọn dịch vụ",
    desc: "Chọn loại dịch vụ bạn cần: điện, nước, camera, cơ khí…",
  },
  {
    step: "02",
    title: "Đặt lịch",
    desc: "Nhập địa chỉ, chọn thời gian phù hợp và mô tả vấn đề",
  },
  {
    step: "03",
    title: "Thợ đến tận nơi",
    desc: "Thợ được xác minh sẽ liên hệ và đến ngay",
  },
  {
    step: "04",
    title: "Hoàn thành & đánh giá",
    desc: "Thanh toán sau khi hoàn tất, đánh giá chất lượng dịch vụ",
  },
];

const testimonials = [
  {
    name: "Chị Lan",
    location: "Quận 7, HCM",
    rating: 5,
    text: "Thợ đến rất nhanh, chỉ 15 phút sau khi đặt. Sửa ống nước rất gọn gàng, giá hợp lý!",
  },
  {
    name: "Anh Minh",
    location: "Quận 1, HCM",
    rating: 5,
    text: "Lắp camera an ninh cho cả nhà, thợ tư vấn rất nhiệt tình. Chắc chắn sẽ dùng lại.",
  },
  {
    name: "Chị Hương",
    location: "Bình Thạnh, HCM",
    rating: 4,
    text: "Dịch vụ sửa điện nhanh gọn. Có hệ thống theo dõi nên rất yên tâm.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ===== HEADER / NAVBAR ===== */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-[72px]">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group" id="nav-logo">
              <LogoIcon size={36} />
              <span className="text-xl font-bold text-primary-container tracking-tight">
                Alo Thợ
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#services" className="text-body-sm text-on-surface-variant hover:text-primary-container transition-colors font-medium">
                Dịch vụ
              </a>
              <a href="#how-it-works" className="text-body-sm text-on-surface-variant hover:text-primary-container transition-colors font-medium">
                Cách hoạt động
              </a>
              <a href="#reviews" className="text-body-sm text-on-surface-variant hover:text-primary-container transition-colors font-medium">
                Đánh giá
              </a>
            </nav>

            {/* Auth Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="btn-outline text-body-sm !py-2.5 !px-5"
                id="nav-login"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="btn-primary text-sm !py-2.5 !px-5 hidden sm:inline-flex"
                id="nav-register"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden bg-linear-to-br from-primary via-primary-container to-[#1565c0] text-on-primary">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary-container rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-inverse-primary rounded-full blur-3xl opacity-20" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full mb-6 backdrop-blur-sm border border-white/10">
              <span className="w-2 h-2 bg-secondary-container rounded-full animate-pulse" />
              <span className="text-label-sm text-white/90">Đang hoạt động 24/7</span>
            </div>

            <h1 className="text-xl leading-tight mb-6">
              Thợ giỏi,{" "}
              <span className="text-secondary-container">đến ngay</span>{" "}
              khi bạn cần
            </h1>

            <p className="text-lg text-white/80 max-w-xl mb-10">
              Nền tảng kết nối bạn với thợ sửa chữa chuyên nghiệp, được xác minh.
              Đặt dịch vụ điện, nước, camera, cơ khí chỉ trong vài bước.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="btn-secondary !text-lg !py-4 !px-8 !rounded-xl"
                id="hero-cta"
              >
                Đặt dịch vụ ngay
                <ArrowRightIcon size={20} />
              </Link>
              <a
                href="tel:1900xxxx"
                className="btn-outline !border-white/30 !text-white hover:!bg-white/10 hover:!border-white/50 !py-4 !px-8 !rounded-xl"
                id="hero-call"
              >
                <PhoneIcon size={20} />
                Gọi: 1900 xxxx
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6 mt-10 text-white/70">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon size={18} />
                <span className="text-label-sm">Thợ xác minh</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon size={18} />
                <span className="text-label-sm">Phản hồi &lt; 5 phút</span>
              </div>
              <div className="flex items-center gap-2">
                <StarIcon size={18} className="text-secondary-container" />
                <span className="text-label-sm">4.8/5 sao</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-headline-md text-primary-container">{s.value}</div>
                <div className="text-sm text-on-surface-variant mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section id="services" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-label-md text-secondary-container uppercase tracking-wider">
              Dịch vụ
            </span>
            <h2 className="text-headline-lg text-on-surface mt-3">
              Đa dạng dịch vụ sửa chữa
            </h2>
            <p className="text-body-lg text-on-surface-variant mt-4 max-w-2xl mx-auto">
              Từ sửa điện, sửa nước đến lắp camera – tất cả đều có thợ chuyên nghiệp sẵn sàng
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.name}
                  className="card group cursor-pointer"
                  id={`service-${svc.name}`}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: svc.bgColor, color: svc.color }}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="text-headline-md text-lg font-semibold text-on-surface mb-2">
                    {svc.name}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mb-4">{svc.desc}</p>
                  <div className="flex items-center gap-1 text-primary-container text-label-md group-hover:gap-2 transition-all">
                    <span>Đặt ngay</span>
                    <ChevronRightIcon size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-label-md text-secondary-container uppercase tracking-wider">
              Quy trình
            </span>
            <h2 className="text-headline-lg text-on-surface mt-3">
              Đặt dịch vụ dễ dàng
            </h2>
            <p className="text-body-lg text-on-surface-variant mt-4 max-w-2xl mx-auto">
              Chỉ 4 bước đơn giản để có thợ giỏi đến tận nơi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, idx) => (
              <div key={item.step} className="relative">
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+32px)] w-[calc(100%-64px)] h-[2px] bg-outline-variant" />
                )}
                <div className="card-elevated text-center">
                  <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mx-auto mb-5">
                    <span className="text-headline-md text-primary-container font-bold">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-on-surface mb-2">{item.title}</h3>
                  <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY US SECTION ===== */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-label-md text-secondary-container uppercase tracking-wider">
                Tại sao chọn Alo Thợ
              </span>
              <h2 className="text-headline-lg text-on-surface mt-3 mb-8">
                Dịch vụ đáng tin cậy cho mọi gia đình
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Thợ được xác minh",
                    desc: "Tất cả thợ đều qua quy trình duyệt kỹ lưỡng bởi đội ngũ admin",
                  },
                  {
                    title: "Giá cả minh bạch",
                    desc: "Bảng giá cố định, rõ ràng — không phát sinh phí ẩn",
                  },
                  {
                    title: "Theo dõi realtime",
                    desc: "Xem trạng thái công việc từ lúc đặt đến khi hoàn thành",
                  },
                  {
                    title: "Đánh giá & bảo vệ",
                    desc: "Hệ thống đánh giá minh bạch, bảo vệ quyền lợi khách hàng",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-success-container flex items-center justify-center text-success mt-0.5">
                      <CheckCircleIcon size={22} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-on-surface mb-1">{item.title}</h4>
                      <p className="text-body-sm text-on-surface-variant">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Card */}
            <div className="relative">
              <div className="card-elevated !p-8 bg-gradient-to-br from-primary-fixed to-surface-container-lowest">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-lg">
                    NT
                  </div>
                  <div>
                    <div className="font-semibold text-on-surface">Nguyễn Thanh</div>
                    <div className="text-body-sm text-on-surface-variant">Thợ điện • 5 năm KN</div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-secondary-container">
                    <StarIcon size={16} />
                    <span className="font-semibold text-on-surface">4.9</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-b border-outline-variant/50">
                    <span className="text-body-sm text-on-surface-variant">Tổng jobs</span>
                    <span className="font-semibold text-on-surface">342</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-outline-variant/50">
                    <span className="text-body-sm text-on-surface-variant">Tỷ lệ hoàn thành</span>
                    <span className="font-semibold text-success">98%</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-body-sm text-on-surface-variant">Phản hồi TB</span>
                    <span className="font-semibold text-on-surface">3 phút</span>
                  </div>
                </div>
                <div className="mt-6 badge badge-done">
                  <CheckCircleIcon size={14} /> Đã xác minh
                </div>
              </div>

              {/* Floating notification */}
              <div className="absolute -top-4 -right-4 card-elevated !p-4 animate-float max-w-[220px]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-success-container flex items-center justify-center text-success">
                    <CheckCircleIcon size={16} />
                  </div>
                  <div>
                    <div className="text-label-sm text-on-surface font-semibold">Hoàn thành!</div>
                    <div className="text-label-sm text-on-surface-variant">Sửa ống nước • 45p</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== REVIEWS ===== */}
      <section id="reviews" className="py-20 lg:py-28 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-label-md text-secondary-container uppercase tracking-wider">
              Khách hàng nói gì
            </span>
            <h2 className="text-headline-lg text-on-surface mt-3">
              Đánh giá từ khách hàng
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card-elevated">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <StarIcon key={i} size={16} className="text-secondary-container" />
                  ))}
                  {Array.from({ length: 5 - t.rating }).map((_, i) => (
                    <StarIcon key={i} size={16} className="text-outline-variant" />
                  ))}
                </div>
                <p className="text-body-md text-on-surface mb-6 leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/50">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container font-semibold text-sm">
                    {t.name[0]}{t.name.split(" ").pop()?.[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-on-surface text-sm">{t.name}</div>
                    <div className="text-label-sm text-on-surface-variant">{t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-20 lg:py-28 bg-linear-to-r from-primary-container to-primary text-on-primary">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-lg mb-4">
            Bắt đầu sử dụng Alo Thợ ngay hôm nay
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Đăng ký miễn phí và trải nghiệm dịch vụ sửa chữa tại nhà chuyên nghiệp nhất
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="btn-secondary text-lg! py-4! px-10! rounded-xl!"
              id="cta-register"
            >
              Đăng ký miễn phí
              <ArrowRightIcon size={20} />
            </Link>
            <Link
              href="/register?role=worker"
              className="btn-outline !border-white/30 !text-white hover:!bg-white/10 hover:!border-white/50 !py-4 !px-10 !rounded-xl"
              id="cta-worker"
            >
              Đăng ký làm thợ
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-on-surface text-surface py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <LogoIcon size={32} />
                <span className="text-xl font-bold">Alo Thợ</span>
              </div>
              <p className="text-sm text-surface-container-high max-w-sm">
                Nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp. Dịch vụ uy tín, giá cả minh bạch.
              </p>
              <div className="flex items-center gap-2 mt-4 text-surface-container-high">
                <PhoneIcon size={16} />
                <span className="text-sm">Hotline: 1900 xxxx</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Dịch vụ</h4>
              <ul className="space-y-2 text-sm text-surface-container-high">
                <li><a href="#" className="hover:text-white transition-colors">Sửa điện</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Sửa nước</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Lắp camera</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cơ khí</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Thông tin</h4>
              <ul className="space-y-2 text-sm text-surface-container-high">
                <li><a href="#" className="hover:text-white transition-colors">Về chúng tôi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Điều khoản</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Chính sách</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Đăng nhập</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 text-center text-label-sm text-surface-container-high">
            © 2026 Alo Thợ. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>
    </div>
  );
}
