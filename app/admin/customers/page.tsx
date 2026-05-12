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
  MapPinIcon,
  CalendarIcon,
  CheckCircleIcon,
  BriefcaseIcon
} from "../../components/icons";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    fetchCustomers();
  }, []); 

  const fetchCustomers = async () => {
    setLoading(true);
    // Note: jobs(id) counts jobs where customer_id matches profile.id
    const { data } = await supabase
      .from('profiles')
      .select('*, jobs(id)')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    
    if (data) setCustomers(data);
    setLoading(false);
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      customer.full_name?.toLowerCase().includes(searchLower) || 
      customer.phone?.toLowerCase().includes(searchLower)
    );
     
    // Assume all profiles returned are 'active' unless there's a status column
    const customerStatus = customer.status || 'active';
    const matchesStatus = statusFilter === 'all' || customerStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Khách hàng</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản lý danh sách khách hàng, theo dõi lịch sử dịch vụ và thông tin liên hệ
          </p>
        </div>
        <button className="btn-primary !py-2.5 !px-5 !rounded-xl flex items-center gap-2">
          <PlusIcon size={20} />
          <span>Thêm khách hàng</span>
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
            placeholder="Tìm theo tên khách hàng, số điện thoại..."
            className="input-field !pl-10 !py-2.5 !rounded-xl w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {['all', 'active', 'blocked'].map(status => (
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
               status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
             <FilterIcon size={16} /> Lọc thêm
          </button>
        </div>
      </div>

      {/* Customers Table */}
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
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Khách hàng</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Liên hệ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Ngày đăng ký</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Lịch sử</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredCustomers.length === 0 ? (
                   <tr>
                     <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                       <div className="flex flex-col items-center justify-center">
                         <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-outline">
                           <UserIcon size={32} />
                         </div>
                         <p className="text-body-md font-medium">Không tìm thấy khách hàng nào phù hợp.</p>
                         <button 
                           onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                           className="mt-2 text-primary-container font-bold hover:underline"
                         >
                           Xóa bộ lọc
                         </button>
                       </div>
                     </td>
                   </tr>
                ) : filteredCustomers.map((customer) => {
                  const jobCount = customer.jobs ? customer.jobs.length : 0;
                  const cStatus = customer.status || 'active';

                  return (
                  <tr key={customer.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-sm font-bold text-secondary-container uppercase shadow-sm">
                            {customer.full_name ? customer.full_name[0] : 'C'}
                          </div>
                          {cStatus === 'active' && (
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckCircleIcon size={12} className="text-success" />
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-body-md text-on-surface font-bold block">{customer.full_name || 'Khách vãng lai'}</span>
                          <span className="text-label-sm text-on-surface-variant font-mono mt-0.5 block">{customer.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-body-sm text-on-surface font-medium">
                          <PhoneIcon size={14} className="text-on-surface-variant" />
                          {customer.phone || 'Chưa cập nhật'}
                        </div>
                        {customer.address && (
                          <div className="flex items-start gap-2 text-label-sm text-on-surface-variant max-w-[200px]">
                            <MapPinIcon size={14} className="flex-shrink-0 mt-0.5" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-1.5 text-body-sm text-on-surface">
                        <CalendarIcon size={16} className="text-on-surface-variant" />
                        {new Date(customer.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-body-sm font-bold text-primary-container">
                        <BriefcaseIcon size={16} />
                        {jobCount} <span className="font-normal text-on-surface-variant">jobs</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${cStatus === 'active' ? 'badge-active' : 'badge-blocked'} uppercase text-[10px] font-bold px-2.5 py-1`}>
                        {cStatus === "active" ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary-container">
                        <ChevronRightIcon size={20} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination placeholder */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">Hiển thị <span className="font-bold text-on-surface">{filteredCustomers.length}</span> kết quả</span>
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
