export default function WorkerBillGoPage() {
  return (
    <div className="p-4 lg:p-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-primary">BillGo</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Quản lý khách hàng thu cước, công nợ và lịch sử thanh toán của thợ.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4">
            <p className="text-sm font-bold text-on-surface-variant">Tổng khách</p>
            <p className="mt-2 text-2xl font-extrabold">0</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-bold text-on-surface-variant">Cần thu hôm nay</p>
            <p className="mt-2 text-2xl font-extrabold">0</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-bold text-on-surface-variant">Quá hạn</p>
            <p className="mt-2 text-2xl font-extrabold">0</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm font-bold text-on-surface-variant">Đã thu tháng này</p>
            <p className="mt-2 text-2xl font-extrabold">0đ</p>
          </div>
        </div>
      </div>
    </div>
  );
}