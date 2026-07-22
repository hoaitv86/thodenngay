"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  serviceMatchesSpecialties,
} from "@/lib/service-categories";
import {
  getCustomerServiceBasePrice,
  getCustomerServiceDisplayName,
  getCustomerServiceGroups,
  getCustomerServicePathLabel,
} from "@/lib/customer-service-catalog";
import {
  applyDefaultServiceParents,
  getServiceDisplayCategoryId,
} from "@/lib/service-hierarchy";
import { filterStandardServiceCatalog } from "@/lib/standard-service-catalog";
import { DynamicServiceWorkflowForm } from "@/app/components/DynamicServiceWorkflowForm";
import { HierarchicalServiceSelector } from "@/app/components/HierarchicalServiceSelector";
import { attachJobServices, isMissingWorkflowColumn, normalizeServiceIds } from "@/lib/job-workflow";
import { handoverWorkflowSectionKeys, pruneWorkflowData, type WorkflowData } from "@/config/serviceWorkflows";
import {
  MapPinIcon,
  ClockIcon,
  BriefcaseIcon,
  CogIcon,
  ZapIcon,
  DropletIcon,
  WrenchIcon,
  CameraIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XIcon
} from "../../components/icons";

type ServiceOption = {
  id: string;
  name: string;
  icon?: string | null;
  base_price?: number | null;
  parent_service_id?: string | null;
  parentName?: string | null;
};

type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
};

const serviceVisuals = [
  {
    match: ["điện", "dien", "electric"],
    icon: ZapIcon,
    iconClass: "bg-primary-fixed text-primary-container",
    selectedClass: "border-primary-container bg-primary-fixed/40 shadow-blue-900/10",
    labelClass: "text-primary-container",
    chipClass: "bg-primary-fixed text-primary-container",
  },
  {
    match: ["nước", "nuoc", "ống", "ong", "plumb"],
    icon: DropletIcon,
    iconClass: "bg-primary-fixed text-primary",
    selectedClass: "border-primary bg-primary-fixed/35 shadow-blue-900/10",
    labelClass: "text-primary",
    chipClass: "bg-primary-fixed text-primary",
  },
  {
    match: ["camera", "cam", "cctv"],
    icon: CameraIcon,
    iconClass: "bg-secondary-fixed text-primary",
    selectedClass: "border-secondary-container bg-secondary-fixed shadow-blue-900/10",
    labelClass: "text-primary",
    chipClass: "bg-secondary-fixed text-primary",
  },
  {
    match: ["cơ khí", "co khi", "sắt", "sat", "khóa", "khoa"],
    icon: CogIcon,
    iconClass: "bg-primary-fixed text-primary-container",
    selectedClass: "border-primary-container bg-primary-fixed/40 shadow-blue-900/10",
    labelClass: "text-primary-container",
    chipClass: "bg-primary-fixed text-primary-container",
  },
  {
    match: ["sửa", "sua", "lắp", "lap", "bảo trì", "bao tri"],
    icon: WrenchIcon,
    iconClass: "bg-secondary-fixed text-primary-container",
    selectedClass: "border-secondary-container bg-secondary-fixed shadow-blue-900/10",
    labelClass: "text-primary-container",
    chipClass: "bg-secondary-fixed text-primary-container",
  },
];

const defaultServiceVisual = {
  icon: BriefcaseIcon,
  iconClass: "bg-primary-fixed text-primary-container",
  selectedClass: "border-primary-container bg-primary-fixed/40 shadow-blue-900/10",
  labelClass: "text-primary-container",
  chipClass: "bg-primary-fixed text-primary-container",
};

const getServiceVisual = (service: ServiceOption) => {
  const nameLower = (service.name || "").toLowerCase();
  const matched = serviceVisuals.find(v =>
    v.match.some(m => nameLower.includes(m))
  );
  return matched || defaultServiceVisual;
};

export default function CustomerBooking() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CustomerBookingContent />
    </Suspense>
  );
}

function CustomerBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceFromUrl = searchParams.get("service") || "";
  const categoryFromUrl = searchParams.get("category") || "";
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null }>({ message: '', type: null });
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    serviceId: "",
    serviceIds: [] as string[],
    address: "",
    scheduledAt: "",
    description: "",
    gpsLocation: null as GpsLocation | null,
  });
  const [workflowData, setWorkflowData] = useState<WorkflowData>({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      // Fetch active services
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, icon, base_price, parent_service_id')
        .eq('is_active', true)
        .order('name');

      const loadedServices = filterStandardServiceCatalog(applyDefaultServiceParents(servicesData || []));
      setServices(loadedServices);

      // Fetch user profile for address
      let userAddress = "";
      let userGpsLocation: GpsLocation | null = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('address, gps_location')
          .eq('id', user.id)
          .single();
        if (profile?.address) {
          userAddress = profile.address;
        }
        if (profile?.gps_location) {
          userGpsLocation = profile.gps_location as GpsLocation;
        }
      }

      // Default time: Tomorrow 9:00 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
      const localISOTime = new Date(tomorrow.getTime() - tzoffset).toISOString().slice(0, 16);

      const hasServiceFromUrl = loadedServices.some((service) => service.id === serviceFromUrl);
      const selectedServiceFromUrl = loadedServices.find((service) => service.id === serviceFromUrl);
      const firstCategoryId = getCustomerServiceGroups(loadedServices)[0]?.category.id || "";
      const selectedCategoryFromUrl = selectedServiceFromUrl ? getServiceDisplayCategoryId(loadedServices, selectedServiceFromUrl.id) : "";

      setSelectedCategoryId(categoryFromUrl || selectedCategoryFromUrl || firstCategoryId);

      setFormData(prev => ({
        ...prev,
        scheduledAt: localISOTime,
        address: userAddress,
        gpsLocation: userGpsLocation,
        serviceId: hasServiceFromUrl ? serviceFromUrl : prev.serviceId,
        serviceIds: hasServiceFromUrl ? [serviceFromUrl] : prev.serviceIds,
      }));
      setLoading(false);
    };
    init();
  }, [categoryFromUrl, serviceFromUrl, supabase]);

  const serviceGroups = useMemo(() => getCustomerServiceGroups(services), [services]);
  const selectedGroup = serviceGroups.find((group) => group.category.id === selectedCategoryId) || serviceGroups[0];
  const selectedServiceIds = normalizeServiceIds(formData.serviceId, formData.serviceIds);
  const selectedServices = selectedServiceIds
    .map(serviceId => services.find(service => service.id === serviceId))
    .filter((service): service is ServiceOption => Boolean(service));

  const toggleService = (serviceId: string) => {
    setFormData(prev => {
      const current = normalizeServiceIds(prev.serviceId, prev.serviceIds);
      const nextIds = current.includes(serviceId)
        ? current.filter(id => id !== serviceId)
        : [...current, serviceId];
      const nextServices = nextIds
        .map(id => services.find(service => service.id === id))
        .filter((service): service is ServiceOption => Boolean(service));
      setWorkflowData(prevWorkflow => pruneWorkflowData(prevWorkflow, nextServices, { excludeSectionKeys: handoverWorkflowSectionKeys }));
      return { ...prev, serviceId: nextIds[0] || "", serviceIds: nextIds };
    });
  };

  const updateSelectedServices = (nextIds: string[]) => {
    const nextServices = nextIds
      .map(id => services.find(service => service.id === id))
      .filter((service): service is ServiceOption => Boolean(service));
    setWorkflowData(prevWorkflow => pruneWorkflowData(prevWorkflow, nextServices, { excludeSectionKeys: handoverWorkflowSectionKeys }));
    setFormData(prev => ({ ...prev, serviceId: nextIds[0] || "", serviceIds: nextIds }));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (type === 'error') {
      setTimeout(() => setToast({ message: '', type: null }), 3000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    const oversized = imageFiles.find(file => file.size > 8 * 1024 * 1024);
    if (oversized) {
      showToast("Mỗi ảnh tối đa 8MB.", "error");
      e.target.value = "";
      return;
    }

    const nextFiles = [...selectedFiles, ...imageFiles].slice(0, 5);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(nextFiles);
    setPreviewUrls(nextFiles.map(file => URL.createObjectURL(file)));
    e.target.value = "";
  };

  const removeSelectedFile = (index: number) => {
    const nextFiles = selectedFiles.filter((_, i) => i !== index);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles(nextFiles);
    setPreviewUrls(nextFiles.map(file => URL.createObjectURL(file)));
  };

  const uploadRequestImages = async (userId: string) => {
    const imageUrls: string[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const ext = file.name.split(".").pop() || "jpg";
      // eslint-disable-next-line react-hooks/purity
      const filePath = `requests/${userId}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage
        .from("job-photos")
        .upload(filePath, file);

      if (error) {
        throw new Error("Không thể tải ảnh lên: " + error.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("job-photos")
        .getPublicUrl(filePath);
      imageUrls.push(publicUrl);
    }
    return imageUrls;
  };

  const hasActiveWorkerForService = async (service: ServiceOption) => {
    const { data, error } = await supabase
      .from('workers')
      .select('id, specialties')
      .eq('status', 'active');

    if (error) {
      throw new Error(error.message);
    }

    const parentService = service.parent_service_id
      ? services.find(item => item.id === service.parent_service_id)
      : null;
    const serviceWithParent = {
      ...service,
      parentName: parentService?.name || service.parentName || null,
    };

    return (data || []).some((worker) => serviceMatchesSpecialties(serviceWithParent, worker.specialties || []));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0 || !formData.address || !formData.scheduledAt) {
      showToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "error");
      return;
    }

    setIsSubmitting(true);

    // Get current user for customer_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Bạn chưa đăng nhập!", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      // Determine quoted_price based on selected service
      if (selectedServices.length === 0) {
        showToast("Vui lòng chọn dịch vụ hợp lệ!", "error");
        setIsSubmitting(false);
        return;
      }

      const hasAvailableWorker = await Promise.all(selectedServices.map(service => hasActiveWorkerForService(service)));
      if (!hasAvailableWorker.some(Boolean)) {
        showToast("Hiện tại chưa có thợ làm cho dịch vụ mà bạn chọn ở khu vực này", "error");
        setIsSubmitting(false);
        return;
      }

      const quotedPrice = selectedServices.reduce((sum, service) => sum + getCustomerServiceBasePrice(service, services), 0);
      const imageUrls = await uploadRequestImages(user.id);
      // eslint-disable-next-line react-hooks/purity
      const jobCode = 'APP' + Math.floor(10000 + Math.random() * 90000);

      const insertPayload = {
        job_code: jobCode,
        customer_id: user.id,
        service_id: selectedServices[0].id,
        address: formData.address,
        gps_location: formData.gpsLocation,
        customer_gps_location: formData.gpsLocation,
        scheduled_at: new Date(formData.scheduledAt).toISOString(),
        description: formData.description,
        quoted_price: quotedPrice,
        images: imageUrls,
        workflow_data: pruneWorkflowData(workflowData, selectedServices, { excludeSectionKeys: handoverWorkflowSectionKeys }),
        status: 'pending',
        source: 'app',
        created_by: user.id
      };

      let insertResult = await supabase.from('jobs').insert(insertPayload).select("id").single();
      if (insertResult.error && isMissingWorkflowColumn(insertResult.error.message)) {
        const legacyPayload = { ...insertPayload };
        delete (legacyPayload as Partial<typeof insertPayload>).workflow_data;
        insertResult = await supabase.from('jobs').insert(legacyPayload).select("id").single();
      }

      if (insertResult.error) {
        throw new Error(insertResult.error.message);
      }

      if (insertResult.data?.id) {
        await attachJobServices(supabase, insertResult.data.id, selectedServices.map(service => service.id));
      }

      setIsSubmitting(false);
      showToast("Đặt dịch vụ thành công! Hệ thống đang tìm thợ cho bạn.", "success");
      setTimeout(() => {
        router.push("/customer/jobs");
      }, 1500);
    } catch (error: unknown) {
      setIsSubmitting(false);
      const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
      showToast("Lỗi khi đặt dịch vụ: " + message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-8rem)] bg-surface animate-fade-in relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-lg shadow-lg border animate-fade-in flex items-start gap-3 ${toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' : 'bg-error-container text-on-error-container border-error/30'
          }`}>
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' ? <CheckCircleIcon size={20} /> : <XIcon size={20} />}
          </div>
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="hero-gradient relative overflow-hidden px-4 pb-12 pt-7 text-white shadow-sm sm:px-6">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" />
        <h1 className="relative text-2xl font-extrabold leading-tight text-white">Đặt dịch vụ mới</h1>
        <p className="relative mt-2 max-w-[19rem] text-sm leading-6 text-white/80">
          Chúng tôi sẽ tìm thợ phù hợp nhất với yêu cầu của bạn.
        </p>
      </div>

      {/* Booking Form */}
      <div className="-mt-6 flex-1 px-4 sm:mx-auto sm:w-full sm:max-w-md lg:max-w-4xl lg:px-8">
        <div className="rounded-lg border border-outline-variant bg-white p-4 shadow-card sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Service Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-extrabold text-primary-container">
                  <BriefcaseIcon size={18} />
                  Chọn loại dịch vụ <span className="text-error">*</span>
                </label>
                <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-[10px] font-bold uppercase text-primary-container">
                  Bắt buộc
                </span>
              </div>

              <HierarchicalServiceSelector
                services={services}
                value={selectedServiceIds}
                onChange={updateSelectedServices}
              />

              {false && <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {serviceGroups.map(({ category, services: categoryServices }) => {
                  const isSelected = selectedGroup?.category.id === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setFormData(prev => ({ ...prev, serviceId: "", serviceIds: [] }));
                        setWorkflowData({});
                      }}
                      className={`min-h-[104px] rounded-lg border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98] ${isSelected
                          ? "border-primary-container bg-primary-fixed/40 shadow-card-hover"
                          : "border-outline-variant/30 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary-fixed/20"
                        }`}
                    >
                      <span className="block text-2xl leading-none">{category.emoji || "•"}</span>
                      <span className={`mt-3 block text-sm font-extrabold leading-5 ${isSelected ? "text-primary-container" : "text-on-surface"}`}>
                        {category.name}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-extrabold text-on-surface-variant">
                        {categoryServices.length} dịch vụ
                      </span>
                    </button>
                  );
                })}
              </div>}

              {false && selectedServices.length > 0 && (
                <div className="flex flex-wrap gap-2 rounded-lg border border-success/20 bg-success-container/60 px-3 py-2 text-sm font-extrabold text-success">
                  {selectedServices.map(service => (
                    <span key={service.id} className="rounded-full bg-white/80 px-3 py-1 text-xs">
                      {getCustomerServicePathLabel(service, services).replace(" / ", " → ")}
                    </span>
                  ))}
                </div>
              )}

              {false && selectedGroup && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-on-surface-variant">
                    Dịch vụ trong {selectedGroup.category.name}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {selectedGroup.services.map(service => {
                  const visual = getServiceVisual(service);
                  const Icon = visual.icon;
                  const isSelected = selectedServiceIds.includes(service.id);
                  const displayName = getCustomerServiceDisplayName(service);
                  const displayPrice = getCustomerServiceBasePrice(service, services);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={`flex min-h-[128px] flex-col items-start justify-between rounded-lg border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98] sm:p-4 ${isSelected
                          ? `${visual.selectedClass} shadow-md`
                          : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/30 hover:bg-primary-fixed/20'
                        }`}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-lg shadow-sm ${isSelected ? 'bg-white text-on-surface' : visual.iconClass}`}>
                          <Icon size={21} />
                        </div>
                        {isSelected && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
                            <CheckCircleIcon size={14} />
                          </span>
                        )}
                      </div>
                      <div className="mt-3 min-w-0">
                        <span className={`block text-sm font-extrabold leading-5 ${isSelected ? visual.labelClass : 'text-on-surface'}`}>
                          {displayName}
                        </span>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isSelected ? visual.chipClass : 'bg-surface-container text-on-surface-variant'}`}>
                          Từ {displayPrice.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </button>
                  );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DynamicServiceWorkflowForm
              services={selectedServices}
              value={workflowData}
              onChange={setWorkflowData}
              excludeSectionKeys={handoverWorkflowSectionKeys}
            />

            <div className="grid gap-6 lg:grid-cols-2">
            {/* Address */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <MapPinIcon size={18} />
                Địa chỉ thực hiện <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Số nhà, Tên đường, Phường/Xã..."
                className="input-field w-full !border-primary-fixed !bg-primary-fixed/20 font-semibold text-on-surface placeholder:text-on-surface-variant/60"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Schedule */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <ClockIcon size={18} />
                Thời gian mong muốn <span className="text-error">*</span>
              </label>
              <input
                type="datetime-local"
                required
                className="input-field w-full !border-primary-fixed !bg-primary-fixed/20 font-semibold text-on-surface"
                value={formData.scheduledAt}
                onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
              />
            </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container">
                Mô tả tình trạng (Tùy chọn)
              </label>
              <textarea
                placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."
                className="input-field w-full min-h-[112px] resize-none !border-outline-variant/40 !bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Request Images */}
            <div className="space-y-3">
              <label className="text-sm font-extrabold text-primary-container flex items-center gap-2">
                <CameraIcon size={18} />
                Ảnh hiện trạng / khu vực làm việc
              </label>
              <p className="text-xs text-on-surface-variant">
                Tải tối đa 5 ảnh để thợ xem trước địa hình và chuẩn bị dụng cụ phù hợp.
              </p>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-secondary-container/50 bg-secondary-container/5 px-4 py-5 text-center transition-colors hover:bg-secondary-container/10">
                <CameraIcon size={26} className="mb-2 text-secondary-container" />
                <span className="text-sm font-bold text-secondary">Thêm ảnh</span>
                <span className="mt-1 text-[11px] text-on-surface-variant">PNG, JPG, JPEG • tối đa 8MB/ảnh</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container">
                      <Image src={url} alt={`Ảnh hiện trạng ${idx + 1}`} fill sizes="(max-width: 640px) 30vw, 120px" className="object-cover" unoptimized />
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
                        aria-label="Xóa ảnh"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || selectedServices.length === 0 || !formData.address || !formData.scheduledAt}
              className="btn-secondary mt-4 w-full py-4 text-base"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                <>
                  Xác nhận đặt lịch
                  <ArrowRightIcon size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      <div className="h-6"></div>
    </div>
  );
}
