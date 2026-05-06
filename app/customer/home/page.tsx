import { Zap, Droplets, Camera, Wrench, ArrowRight, Star, MapPin } from "lucide-react";
import Link from "next/link";

const services = [
  { id: "1", icon: Zap, name: "Sửa điện", price: "200.000đ", color: "bg-amber-50 text-amber-600" },
  { id: "2", icon: Droplets, name: "Sửa nước", price: "150.000đ", color: "bg-blue-50 text-blue-600" },
  { id: "3", icon: Camera, name: "Lắp camera", price: "500.000đ", color: "bg-violet-50 text-violet-600" },
  { id: "4", icon: Wrench, name: "Cơ khí", price: "250.000đ", color: "bg-emerald-50 text-emerald-600" },
];

const topWorkers = [
  { name: "Anh Tuấn", specialty: "Điện", rating: 4.9, jobs: 230 },
  { name: "Anh Phát", specialty: "Nước", rating: 4.8, jobs: 185 },
  { name: "Anh Minh", specialty: "Camera", rating: 4.7, jobs: 142 },
];

export default function CustomerHome() {
  return (
    <div className="space-y-6 px-4 pt-4">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-primary-container to-primary rounded-2xl p-5 text-on-primary">
        <p className="text-body-sm opacity-80">Xin chào 👋</p>
        <h1 className="text-headline-md mt-1">Bạn cần sửa gì?</h1>
        <p className="text-body-sm opacity-70 mt-1">
          Chọn dịch vụ bên dưới hoặc mô tả vấn đề
        </p>
        <Link
          href="/customer/booking"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-secondary-container text-on-secondary font-semibold rounded-xl text-body-sm hover:opacity-90 transition-opacity shadow-sm"
        >
          Đặt dịch vụ ngay
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Services Grid */}
      <section>
        <h2 className="text-body-lg font-semibold text-on-surface mb-3">
          Dịch vụ
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map((svc) => (
            <Link
              key={svc.id}
              href={`/customer/booking?service=${svc.id}`}
              className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${svc.color}`}>
                <svc.icon className="w-5.5 h-5.5" />
              </div>
              <p className="text-body-sm font-semibold text-on-surface">{svc.name}</p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">
                Từ {svc.price}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Top Workers */}
      <section>
        <h2 className="text-body-lg font-semibold text-on-surface mb-3">
          Thợ nổi bật
        </h2>
        <div className="space-y-3">
          {topWorkers.map((w) => (
            <div
              key={w.name}
              className="flex items-center gap-3 bg-surface-container-lowest rounded-xl p-3.5 border border-outline-variant/20"
            >
              <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-label-md font-bold text-primary shrink-0">
                {w.name.split(" ").pop()?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-on-surface truncate">
                  {w.name}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Chuyên {w.specialty} · {w.jobs} việc
                </p>
              </div>
              <div className="flex items-center gap-1 text-label-sm font-semibold text-warning shrink-0">
                <Star className="w-4 h-4 fill-warning" />
                {w.rating}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
