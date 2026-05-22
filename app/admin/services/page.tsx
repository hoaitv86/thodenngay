"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SearchIcon,
  PlusIcon,
  FilterIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  SettingsIcon,
  DollarSignIcon,
  XIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon
} from "../../components/icons";

const iconMap: Record<string, any> = {
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  WrenchIcon,
  ShieldCheckIcon,
  StarIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon,
  BarChartIcon,
  CalendarIcon,
  PhoneIcon,
  UsersIcon
};

const iconColorMap: Record<string, string> = {
  ZapIcon: 'bg-amber-50 text-amber-600',
  DropletIcon: 'bg-blue-50 text-blue-600',
  CameraIcon: 'bg-purple-50 text-purple-600',
  CogIcon: 'bg-green-50 text-green-600',
  WrenchIcon: 'bg-primary-fixed text-primary-container',
  ShieldCheckIcon: 'bg-emerald-50 text-emerald-600',
  StarIcon: 'bg-yellow-50 text-yellow-600',
  ClockIcon: 'bg-indigo-50 text-indigo-600',
  MapPinIcon: 'bg-red-50 text-red-600',
  BriefcaseIcon: 'bg-slate-50 text-slate-600',
  BarChartIcon: 'bg-cyan-50 text-cyan-600',
  CalendarIcon: 'bg-rose-50 text-rose-600',
  PhoneIcon: 'bg-teal-50 text-teal-600',
  UsersIcon: 'bg-orange-50 text-orange-600',
  default: 'bg-surface-container text-on-surface-variant'
};

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    base_price: "",
    icon: "WrenchIcon",
    is_active: true
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setServices(data);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.base_price) {
      alert("Vui lòng điền tên dịch vụ và giá cơ bản.");
      return;
    }

    setIsSubmitting(true);
    const { data: insertedService, error } = await supabase.from('services').insert({
      name: newService.name,
      description: newService.description,
      base_price: parseInt(newService.base_price),
      icon: newService.icon,
      is_active: newService.is_active
    }).select().single();

    setIsSubmitting(false);

    if (error) {
      alert("Lỗi khi tạo dịch vụ: " + error.message);
      console.error(error);
    } else if (insertedService) {
      setIsModalOpen(false);
      setNewService({
        name: "",
        description: "",
        base_price: "",
        icon: "WrenchIcon",
        is_active: true
      });
      // Append and sort instantly
      setServices(prev => [...prev, insertedService].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const filteredServices = services.filter(service => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = service.name?.toLowerCase().includes(searchLower) || 
                          service.description?.toLowerCase().includes(searchLower);
     
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && service.is_active) ||
                          (statusFilter === 'inactive' && !service.is_active);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Dịch vụ & Bảng giá</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản lý danh mục dịch vụ, cài đặt giá cơ bản và cấu hình chi tiết
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary !py-2.5 !px-5 !rounded-xl flex items-center gap-2"
        >
          <PlusIcon size={20} />
          <span>Thêm dịch vụ</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="card-elevated !p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <SearchIcon size={20} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên dịch vụ, mô tả..."
            className="input-field !pl-10 !py-2.5 !rounded-xl w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {['all', 'active', 'inactive'].map(status => (
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
               status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
             <FilterIcon size={16} /> Lọc
          </button>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 text-outline">
            <WrenchIcon size={32} />
          </div>
          <p className="text-body-md font-medium text-on-surface-variant">Không tìm thấy dịch vụ nào phù hợp.</p>
          <button 
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
            className="mt-2 text-primary-container font-bold hover:underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map(service => {
            const Icon = iconMap[service.icon] || WrenchIcon;
            const colorClass = iconColorMap[service.icon] || iconColorMap.default;

            return (
              <div key={service.id} className="card-elevated group hover:border-primary-container/50 transition-all flex flex-col h-full relative overflow-hidden">
                {!service.is_active && (
                  <div className="absolute inset-0 bg-surface/40 z-10 pointer-events-none" />
                )}
                <div className="flex justify-between items-start mb-4 relative z-20">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass}`}>
                    <Icon size={24} />
                  </div>
                  <span className={`badge ${service.is_active ? 'badge-active' : 'badge-inactive'} text-[10px]`}>
                    {service.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                  </span>
                </div>
                
                <div className="flex-1 relative z-20">
                  <h3 className="text-body-lg font-bold text-on-surface mb-1">{service.name}</h3>
                  <p className="text-label-sm text-on-surface-variant line-clamp-2 leading-relaxed h-10">
                    {service.description || "Chưa có mô tả cho dịch vụ này."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between relative z-20">
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Giá cơ bản</span>
                    <div className="flex items-center gap-1 text-primary-container font-bold">
                      <DollarSignIcon size={14} className="text-primary" />
                      {service.base_price ? service.base_price.toLocaleString('vi-VN') + 'đ' : 'Liên hệ'}
                    </div>
                  </div>
                  <button className="w-10 h-10 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors group-hover:text-primary-container group-hover:bg-primary-fixed">
                    <SettingsIcon size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">Thêm dịch vụ mới</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="createServiceForm" onSubmit={handleCreateService} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Tên dịch vụ <span className="text-error">*</span></label>
                  <input 
                    type="text" 
                    placeholder="VD: Sửa chữa điện" 
                    className="input-field" 
                    required
                    value={newService.name}
                    onChange={e => setNewService({...newService, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Mô tả dịch vụ</label>
                  <textarea 
                    placeholder="Mô tả chi tiết các hạng mục khách hàng sẽ nhận được..." 
                    className="input-field min-h-[80px] resize-none" 
                    value={newService.description}
                    onChange={e => setNewService({...newService, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Giá cơ bản (VNĐ) <span className="text-error">*</span></label>
                  <input 
                    type="number" 
                    placeholder="VD: 150000" 
                    className="input-field" 
                    required
                    value={newService.base_price}
                    onChange={e => setNewService({...newService, base_price: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-on-surface block">Chọn biểu tượng (Icon) hiển thị</label>
                  <div className="flex flex-wrap gap-4">
                    {Object.keys(iconMap).map(iconName => {
                      const IconComp = iconMap[iconName];
                      const colorClass = iconColorMap[iconName] || iconColorMap.default;
                      const isSelected = newService.icon === iconName;
                      
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setNewService({...newService, icon: iconName})}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            isSelected 
                              ? `ring-2 ring-primary ring-offset-2 scale-110 ${colorClass}` 
                              : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          <IconComp size={24} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-outline-variant/30">
                  <div>
                    <label className="text-sm font-bold text-on-surface block">Trạng thái hiển thị</label>
                    <p className="text-xs text-on-surface-variant mt-1">Khách hàng có thể nhìn thấy và đặt dịch vụ này</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={newService.is_active}
                      onChange={e => setNewService({...newService, is_active: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                  </label>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-outline !py-2.5 !px-5"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                form="createServiceForm"
                className="btn-primary !py-2.5 !px-5 min-w-[140px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : "Lưu dịch vụ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
