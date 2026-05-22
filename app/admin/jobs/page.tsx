"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SearchIcon,
  FilterIcon,
  PlusIcon,
  ChevronRightIcon,
  ZapIcon,
  DropletIcon,
  CameraIcon,
  CogIcon,
  MapPinIcon,
  CalendarIcon,
  XIcon
} from "../../components/icons";

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const supabase = createClient();

  // Create Job Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newJob, setNewJob] = useState({
    customerId: "",
    serviceId: "",
    address: "",
    scheduledAt: "",
    quotedPrice: "",
    description: ""
  });

  // Assign Worker Modal states
  const [assignWorkerModalOpen, setAssignWorkerModalOpen] = useState(false);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []); 

  const fetchJobs = async () => {
    setLoading(true);
    let query = supabase
      .from('jobs')
      .select('*, customer:profiles!customer_id(*), service:services(*), worker:workers(profiles(full_name))')
      .order('created_at', { ascending: false });
    
    const { data } = await query;
    if (data) setJobs(data);
    setLoading(false);
  };

  const openModal = async () => {
    setIsModalOpen(true);
    if (customers.length === 0) {
      const { data: cData } = await supabase.from('profiles').select('id, full_name, phone').eq('role', 'customer');
      if (cData) setCustomers(cData);
    }
    if (services.length === 0) {
      const { data: sData } = await supabase.from('services').select('id, name, base_price').eq('is_active', true);
      if (sData) setServices(sData);
    }
    
    // Default time to tomorrow 9AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(tomorrow.getTime() - tzoffset)).toISOString().slice(0, 16);
    
    setNewJob(prev => ({
      ...prev,
      scheduledAt: localISOTime
    }));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.customerId || !newJob.serviceId || !newJob.address || !newJob.scheduledAt) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const jobCode = 'JOB' + Math.floor(10000 + Math.random() * 90000);

    const { data: insertedJob, error } = await supabase.from('jobs').insert({
      job_code: jobCode,
      customer_id: newJob.customerId,
      service_id: newJob.serviceId,
      address: newJob.address,
      scheduled_at: new Date(newJob.scheduledAt).toISOString(),
      quoted_price: newJob.quotedPrice ? parseInt(newJob.quotedPrice) : 0,
      description: newJob.description,
      status: 'pending',
      source: 'call',
      created_by: user?.id
    }).select('*, customer:profiles!customer_id(*), service:services(*), worker:workers(profiles(full_name))').single();

    setIsSubmitting(false);

    if (error) {
      alert("Lỗi khi tạo job: " + error.message);
      console.error(error);
    } else if (insertedJob) {
      setIsModalOpen(false);
      setNewJob({ customerId: "", serviceId: "", address: "", scheduledAt: "", quotedPrice: "", description: "" });
      // Prepend to list instantly to avoid any cache issues
      setJobs(prev => [insertedJob, ...prev]);
    }
  };

  const openAssignModal = async (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedWorkerId("");
    setAssignWorkerModalOpen(true);
    
    if (workersList.length === 0) {
      const { data } = await supabase
        .from('workers')
        .select('id, profiles(full_name, phone)')
        .eq('status', 'active');
      if (data) setWorkersList(data);
    }
  };

  const handleAssignWorker = async () => {
    if (!selectedWorkerId) {
      alert("Vui lòng chọn thợ để gán.");
      return;
    }
    
    setIsAssigning(true);
    const { error } = await supabase
      .from('jobs')
      .update({ worker_id: selectedWorkerId, status: 'assigned' })
      .eq('id', selectedJobId);
      
    setIsAssigning(false);
    
    if (error) {
      alert("Lỗi khi gán thợ: " + error.message);
      console.error(error);
    } else {
      setAssignWorkerModalOpen(false);
      
      const assignedWorker = workersList.find(w => w.id === selectedWorkerId);
      
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.id === selectedJobId) {
          return {
            ...job,
            status: 'assigned',
            worker: {
              profiles: {
                full_name: assignedWorker?.profiles?.full_name || 'Thợ đã gán'
              }
            }
          };
        }
        return job;
      }));
    }
  };

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    const jobCode = job.job_code?.toLowerCase() || "";
    const customerName = job.customer?.full_name?.toLowerCase() || "";
    const serviceName = job.service?.name?.toLowerCase() || "";
    
    const matchesSearch = jobCode.includes(searchLower) || customerName.includes(searchLower) || serviceName.includes(searchLower);
     
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'completed' 
        ? (job.status === 'completed' || job.status === 'done')
        : job.status === statusFilter);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Quản lý Job</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Theo dõi, điều phối và quản lý tất cả các công việc trên hệ thống
          </p>
        </div>
        <button onClick={openModal} className="btn-primary !py-2.5 !px-5 !rounded-xl flex items-center gap-2">
          <PlusIcon size={20} />
          <span>Tạo Job mới</span>
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
            placeholder="Tìm theo mã job, khách hàng, dịch vụ..."
            className="input-field !pl-10 !py-2.5 !rounded-xl w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
          {['all', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map(status => (
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
               status === 'pending' ? 'Chờ xử lý' :
               status === 'assigned' ? 'Đã gán' :
               status === 'in_progress' ? 'Đang làm' :
               status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
            </button>
          ))}
          <button className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors border bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low text-on-surface-variant flex items-center gap-2 ml-2">
             <FilterIcon size={16} /> Lọc thêm
          </button>
        </div>
      </div>

      {/* Jobs Table */}
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
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Mã Job / Ngày</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Khách hàng</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Dịch vụ</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Thợ phụ trách</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredJobs.length === 0 ? (
                   <tr>
                     <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                       <p className="text-body-md">Không tìm thấy job nào phù hợp.</p>
                       <button 
                         onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                         className="mt-4 text-primary-container font-bold hover:underline"
                       >
                         Xóa bộ lọc
                       </button>
                     </td>
                   </tr>
                ) : filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-primary-container font-bold">{job.job_code}</div>
                      <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mt-1.5">
                        <CalendarIcon size={14} />
                        {new Date(job.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-body-sm font-semibold text-on-surface">{job.customer?.full_name || 'Khách vãng lai'}</div>
                      {job.address && (
                        <div className="flex items-start gap-1.5 text-label-sm text-on-surface-variant mt-1.5 max-w-[200px]">
                          <MapPinIcon size={14} className="flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-tight">{job.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          job.service?.icon === 'ZapIcon' ? 'bg-amber-50 text-amber-600' :
                          job.service?.icon === 'DropletIcon' ? 'bg-blue-50 text-blue-600' :
                          job.service?.icon === 'CameraIcon' ? 'bg-purple-50 text-purple-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {job.service?.icon === "ZapIcon" && <ZapIcon size={18} />}
                          {job.service?.icon === "DropletIcon" && <DropletIcon size={18} />}
                          {job.service?.icon === "CameraIcon" && <CameraIcon size={18} />}
                          {job.service?.icon === "CogIcon" && <CogIcon size={18} />}
                          {!job.service?.icon && <CogIcon size={18} />}
                        </div>
                        <div>
                          <span className="text-body-sm text-on-surface font-bold block">{job.service?.name}</span>
                          <span className="text-label-sm text-success font-medium mt-0.5 block">{job.total_price ? `${job.total_price.toLocaleString('vi-VN')}đ` : 'Chưa báo giá'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {job.worker?.profiles?.full_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-xs font-bold text-primary-container">
                            {job.worker.profiles.full_name[0]}
                          </div>
                          <span className="text-body-sm text-on-surface font-medium">{job.worker.profiles.full_name}</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => openAssignModal(job.id)}
                          className="text-label-sm font-bold text-primary-container bg-primary-fixed px-3 py-1.5 rounded-lg hover:brightness-95 transition-all"
                        >
                          + Gán thợ
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge badge-${job.status === 'done' ? 'completed' : job.status} uppercase text-[10px] font-bold px-2.5 py-1`}>
                        {job.status === "pending" ? "Chờ xử lý" :
                          job.status === "assigned" ? "Đã gán" :
                            job.status === "in_progress" ? "Đang làm" :
                              (job.status === "completed" || job.status === "done") ? "Hoàn thành" : "Đã hủy"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-primary-container">
                        <ChevronRightIcon size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination placeholder */}
        {!loading && filteredJobs.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">Hiển thị <span className="font-bold text-on-surface">{filteredJobs.length}</span> kết quả</span>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang trước</button>
              <button className="px-3 py-1.5 rounded-lg text-sm bg-primary-container text-on-primary-container font-bold shadow-sm">1</button>
              <button className="px-3 py-1.5 rounded-lg text-sm border border-outline-variant disabled:opacity-50 text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors" disabled>Trang sau</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">Tạo Job mới (Điều phối)</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="createJobForm" onSubmit={handleCreateJob} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Khách hàng <span className="text-error">*</span></label>
                    <select 
                      className="input-field" 
                      required
                      value={newJob.customerId}
                      onChange={e => setNewJob({...newJob, customerId: e.target.value})}
                    >
                      <option value="" disabled>-- Chọn khách hàng --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone || 'Chưa cập nhật SĐT'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Dịch vụ <span className="text-error">*</span></label>
                    <select 
                      className="input-field" 
                      required
                      value={newJob.serviceId}
                      onChange={e => {
                        const selected = services.find(s => s.id === e.target.value);
                        setNewJob({
                          ...newJob, 
                          serviceId: e.target.value,
                          quotedPrice: selected ? selected.base_price.toString() : ""
                        });
                      }}
                    >
                      <option value="" disabled>-- Chọn dịch vụ --</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.base_price?.toLocaleString('vi-VN')}đ)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Địa chỉ thi công <span className="text-error">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Nhập địa chỉ chi tiết" 
                    className="input-field" 
                    required
                    value={newJob.address}
                    onChange={e => setNewJob({...newJob, address: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Thời gian dự kiến <span className="text-error">*</span></label>
                    <input 
                      type="datetime-local" 
                      className="input-field" 
                      required
                      value={newJob.scheduledAt}
                      onChange={e => setNewJob({...newJob, scheduledAt: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Báo giá tạm tính (VNĐ)</label>
                    <input 
                      type="number" 
                      placeholder="VD: 250000" 
                      className="input-field" 
                      value={newJob.quotedPrice}
                      onChange={e => setNewJob({...newJob, quotedPrice: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Mô tả chi tiết / Ghi chú</label>
                  <textarea 
                    placeholder="Tình trạng hỏng hóc, lưu ý đường đi..." 
                    className="input-field min-h-[100px] resize-none" 
                    value={newJob.description}
                    onChange={e => setNewJob({...newJob, description: e.target.value})}
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-outline !py-2.5 !px-5"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                form="createJobForm"
                className="btn-primary !py-2.5 !px-5 min-w-[140px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang tạo...
                  </span>
                ) : "Tạo Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {assignWorkerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">Gán thợ phụ trách</h2>
              <button 
                onClick={() => setAssignWorkerModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-body-sm text-on-surface-variant mb-4">
                Vui lòng chọn một thợ đang hoạt động để gán cho Job này:
              </p>
              
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {workersList.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-4">Đang tải danh sách thợ...</p>
                ) : workersList.map(worker => (
                  <label 
                    key={worker.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedWorkerId === worker.id 
                        ? 'border-primary-container bg-primary-fixed' 
                        : 'border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="worker" 
                      value={worker.id}
                      checked={selectedWorkerId === worker.id}
                      onChange={() => setSelectedWorkerId(worker.id)}
                      className="w-4 h-4 text-primary bg-surface border-outline focus:ring-primary focus:ring-2"
                    />
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex flex-shrink-0 items-center justify-center text-on-secondary-container font-bold">
                      {worker.profiles?.full_name ? worker.profiles.full_name[0] : 'T'}
                    </div>
                    <div>
                      <div className="text-body-sm font-bold text-on-surface">{worker.profiles?.full_name || 'Thợ chưa có tên'}</div>
                      <div className="text-label-sm text-on-surface-variant">{worker.profiles?.phone || 'Chưa cập nhật SĐT'}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                onClick={() => setAssignWorkerModalOpen(false)}
                className="btn-outline !py-2 !px-4"
                disabled={isAssigning}
              >
                Hủy
              </button>
              <button 
                onClick={handleAssignWorker}
                className="btn-primary !py-2 !px-4 min-w-[120px]"
                disabled={isAssigning || !selectedWorkerId}
              >
                {isAssigning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gán...
                  </span>
                ) : "Xác nhận gán"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
