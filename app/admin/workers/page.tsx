"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ChevronRightIcon,
  UserIcon,
  PhoneIcon,
  StarIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  CalendarIcon
} from "../../components/icons";

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    fetchWorkers();
  }, []); 

  const fetchWorkers = async () => {
    setLoading(true);
    let query = supabase
      .from('workers')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });
    
    const { data } = await query;
    if (data) setWorkers(data);
    setLoading(false);
  };

  const filteredWorkers = workers.filter(worker => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      worker.profiles?.full_name?.toLowerCase().includes(searchLower) || 
      worker.profiles?.phone?.toLowerCase().includes(searchLower) ||
      (worker.specialties && worker.specialties.some((s: string) => s.toLowerCase().includes(searchLower)))
    );
     
    const matchesStatus = statusFilter === 'all' || worker.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Quản lý Thợ</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Duyệt, quản lý, và theo dõi đội ngũ thợ trên hệ thống
          </p>
        </div>
        <button className="btn-primary !py-2.5 !px-5 !rounded-xl flex items-center gap-2">
          <PlusIcon size={20} />
          <span>Thêm thợ mới</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="card-elevated !p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="relative w-full xl:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <SearchIcon size={20} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên, số điện thoại, chuyên môn..."
            className="input-field !pl-10 !py-2.5 !rounded-xl w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {['all', 'pending', 'active', 'blocked'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border ${
                statusFilter === status 
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-sm' 
                  : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {status === 'all' ? 'Tất cả' :
               status === 'pending' ? 'Chờ duyệt' :
               status === 'active' ? 'Hoạt động' : 'Đã khóa'}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
             <FilterIcon size={16} /> Lọc thêm
          </button>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-64">
             <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Hồ sơ Thợ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Chuyên môn</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Hiệu suất</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Ngày tham gia</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredWorkers.length === 0 ? (
                   <tr>
                     <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                       <div className="flex flex-col items-center justify-center">
                         <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-outline">
                           <UserIcon size={32} />
                         </div>
                         <p className="text-body-md font-medium">Không tìm thấy thợ nào phù hợp.</p>
                         <button 
                           onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                           className="mt-2 text-primary-container font-bold hover:underline"
                         >
                           Xóa bộ lọc
                         </button>
                       </div>
                     </td>
                   </tr>
                ) : filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-lg font-bold text-primary-container uppercase shadow-sm">
                            {worker.profiles?.full_name ? worker.profiles.full_name[0] : 'W'}
                          </div>
                          {worker.status === 'active' && (
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckCircleIcon size={14} className="text-success" />
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-body-md text-on-surface font-bold block">{worker.profiles?.full_name || 'Chưa cập nhật'}</span>
                          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mt-0.5">
                            <PhoneIcon size={12} />
                            {worker.profiles?.phone || 'Chưa có SĐT'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        {worker.specialties && worker.specialties.length > 0 ? (
                          worker.specialties.map((spec: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-surface-container rounded-md text-[11px] font-medium text-on-surface-variant whitespace-nowrap">
                              {spec}
                            </span>
                          ))
                        ) : (
                          <span className="text-label-sm italic text-outline">Chưa có chuyên môn</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1 text-body-sm font-bold text-on-surface">
                          <StarIcon size={14} className="text-amber-500 fill-current" />
                          {worker.avg_rating ? worker.avg_rating.toFixed(1) : '5.0'}
                        </div>
                        <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                          <BriefcaseIcon size={12} />
                          {worker.total_jobs || 0} jobs hoàn thành
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                        <CalendarIcon size={14} />
                        {new Date(worker.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${worker.status} uppercase text-[10px] font-bold px-2.5 py-1`}>
                        {worker.status === "pending" ? "Chờ duyệt" :
                          worker.status === "active" ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {worker.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="px-3 py-1.5 rounded-lg bg-success-container text-success text-xs font-bold hover:brightness-95 transition-all">
                             Duyệt
                           </button>
                           <button className="px-3 py-1.5 rounded-lg bg-error-container text-error text-xs font-bold hover:brightness-95 transition-all">
                             Từ chối
                           </button>
                        </div>
                      ) : (
                        <button className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary-container">
                          <ChevronRightIcon size={20} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination placeholder */}
        {!loading && filteredWorkers.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">Hiển thị <span className="font-bold text-on-surface">{filteredWorkers.length}</span> kết quả</span>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang trước</button>
              <button className="px-3 py-1.5 rounded-lg text-sm bg-primary-container text-on-primary-container font-bold shadow-sm">1</button>
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang sau</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
