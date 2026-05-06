import { MapPin, Clock, Banknote, Check, X, ChevronRight } from "lucide-react";

const incomingJobs = [
  {
    id: "JOB-0156",
    service: "Sửa điện",
    address: "123 Nguyễn Huệ, Q.1, TP.HCM",
    scheduledAt: "Hôm nay, 14:00",
    price: "350.000đ",
    description: "Ổ cắm bị chập, cần kiểm tra và thay mới",
    isNew: true,
  },
  {
    id: "JOB-0155",
    service: "Lắp đèn",
    address: "456 Lê Lợi, Q.3, TP.HCM",
    scheduledAt: "Hôm nay, 16:30",
    price: "200.000đ",
    description: "Lắp 3 bóng đèn LED trần phòng khách",
    isNew: true,
  },
];

const activeJob = {
  id: "JOB-0153",
  service: "Sửa ống nước",
  address: "789 Trần Hưng Đạo, Q.5, TP.HCM",
  status: "in_progress" as const,
  price: "280.000đ",
  customer: "Chị Hương",
};

export default function WorkerJobs() {
  return (
    <div className="space-y-6 px-4 pt-4">
      {/* Active Job */}
      {activeJob && (
        <section>
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
            Đang thực hiện
          </h2>
          <div className="bg-primary-fixed/50 rounded-xl p-4 border-2 border-primary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-label-sm text-primary font-mono">
                {activeJob.id}
              </span>
              <span className="px-2.5 py-1 bg-primary-container text-on-primary text-label-sm rounded-full font-medium">
                Đang làm
              </span>
            </div>
            <h3 className="text-body-md font-semibold text-on-surface">
              {activeJob.service}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 text-body-sm text-on-surface-variant">
              <MapPin className="w-4 h-4 shrink-0" />
              {activeJob.address}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-body-sm text-on-surface-variant">
              <Banknote className="w-4 h-4 shrink-0" />
              {activeJob.price}
            </div>
            <button className="w-full mt-4 py-3 bg-success text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              Hoàn thành
            </button>
          </div>
        </section>
      )}

      {/* Incoming Jobs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider">
            Việc mới ({incomingJobs.length})
          </h2>
        </div>
        <div className="space-y-3">
          {incomingJobs.map((job) => (
            <div
              key={job.id}
              className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 relative overflow-hidden"
            >
              {job.isNew && (
                <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-secondary-container text-on-secondary text-[10px] font-bold rounded-bl-lg">
                  MỚI
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-sm text-on-surface-variant font-mono">
                  {job.id}
                </span>
              </div>
              <h3 className="text-body-md font-semibold text-on-surface">
                {job.service}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                {job.description}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-body-sm text-on-surface-variant">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{job.address}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                  <Clock className="w-4 h-4 shrink-0" />
                  {job.scheduledAt}
                </div>
                <div className="flex items-center gap-1.5 text-body-sm font-semibold text-on-surface">
                  <Banknote className="w-4 h-4 shrink-0" />
                  {job.price}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 py-2.5 bg-primary-container text-on-primary font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 text-body-sm">
                  <Check className="w-4 h-4" />
                  Nhận việc
                </button>
                <button className="py-2.5 px-4 bg-surface text-on-surface-variant font-semibold rounded-xl border border-outline-variant hover:bg-surface-container transition-colors text-body-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
