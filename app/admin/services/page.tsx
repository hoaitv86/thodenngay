"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { getCanonicalServiceCategories } from "@/lib/service-categories";
import { getDefaultServiceParentId } from "@/lib/service-hierarchy";
import {
  AirVent,
  Blocks,
  Bolt,
  Bath,
  Briefcase,
  Cable,
  Cpu,
  Calendar,
  Camera,
  Cctv,
  Clock,
  Computer,
  Drill,
  Edit,
  Eye,
  EyeOff,
  Fan,
  Hammer,
  HousePlug,
  HouseWifi,
  Layers,
  Laptop,
  Lightbulb,
  MapPin,
  Monitor,
  Network,
  Paintbrush,
  PaintRoller,
  Phone,
  Plug,
  PlusCircle,
  Printer,
  Refrigerator,
  Router,
  Smartphone,
  Settings,
  ShieldCheck,
  Snowflake,
  Sofa,
  Star,
  Tv,
  Toilet,
  Trash2,
  Truck,
  Users,
  Wind,
  WashingMachine,
  Wifi,
  Wrench,
  Droplets,
} from "lucide-react";
import {
  SearchIcon,
  PlusIcon,
  FilterIcon,
  WrenchIcon,
  XIcon,
} from "../../components/icons";

type ServiceItem = {
  id: string;
  parent_service_id?: string | null;
  name: string;
  description?: string | null;
  base_price?: number | string | null;
  icon?: string | null;
  is_active: boolean;
};

type ServiceFormState = {
  name: string;
  description: string;
  base_price: string;
  icon: string;
  is_active: boolean;
  parent_service_id: string | null;
};

type ServiceMutationError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type ServiceParentMap = Record<string, string | null>;

const SERVICE_PARENT_STORAGE_KEY = "alo_tho_service_parent_map";

const getStoredServiceParentMap = (): ServiceParentMap => {
  if (typeof window === "undefined") return {};

  try {
    const rawValue = window.localStorage.getItem(SERVICE_PARENT_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) as ServiceParentMap : {};
  } catch {
    return {};
  }
};

const saveStoredServiceParentMap = (parentMap: ServiceParentMap) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SERVICE_PARENT_STORAGE_KEY, JSON.stringify(parentMap));
};

const getServiceErrorMessage = (error: ServiceMutationError) => {
  const rawError = JSON.stringify(error);
  const text = [
    error.message,
    error.details,
    error.hint,
    error.code,
    rawError,
  ].filter(Boolean).join(" ");

  if (text.includes("parent_service_id") || text.includes("PGRST204")) {
    return "Database chưa có cột parent_service_id cho cấu trúc 3 cấp. Vui lòng chạy migration supabase/migration_service_children_admin_policies.sql rồi thử lại.";
  }

  return error.message || error.details || rawError || "Không xác định";
};

type ServiceIconOption = {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  className: string;
};

const serviceIconOptions: ServiceIconOption[] = [
  { name: "HouseWifi", label: "Internet nhà", icon: HouseWifi, className: "bg-primary-fixed text-primary" },
  { name: "Network", label: "Mạng Internet", icon: Network, className: "bg-primary-fixed text-primary" },
  { name: "Laptop", label: "Laptop", icon: Laptop, className: "bg-surface-container text-on-surface-variant" },
  { name: "Tv", label: "Thiết bị màn hình", icon: Tv, className: "bg-surface-container text-on-surface-variant" },
  { name: "Bolt", label: "Điện nhanh", icon: Bolt, className: "bg-warning-container text-warning" },
  { name: "Wind", label: "Máy lạnh", icon: Wind, className: "bg-sky-50 text-sky-500" },
  { name: "Blocks", label: "Xem tất cả", icon: Blocks, className: "bg-primary-fixed text-primary" },
  { name: "PlusCircle", label: "Lắp đặt", icon: PlusCircle, className: "bg-primary-fixed text-primary-container" },
  { name: "Cpu", label: "Linh kiện", icon: Cpu, className: "bg-surface-container text-on-surface-variant" },
  { name: "Smartphone", label: "Điện thoại", icon: Smartphone, className: "bg-primary-fixed text-primary-container" },
  { name: "Lightbulb", label: "Điện", icon: Lightbulb, className: "bg-primary-fixed text-primary-container" },
  { name: "HousePlug", label: "Ổ cắm", icon: HousePlug, className: "bg-secondary-fixed text-primary" },
  { name: "Plug", label: "Thiết bị điện", icon: Plug, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Droplets", label: "Nước", icon: Droplets, className: "bg-secondary-fixed text-primary" },
  { name: "Bath", label: "Phòng tắm", icon: Bath, className: "bg-primary-fixed text-primary-container" },
  { name: "Toilet", label: "Bồn cầu", icon: Toilet, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Cctv", label: "Camera", icon: Cctv, className: "bg-secondary-fixed text-primary" },
  { name: "Camera", label: "Hình ảnh", icon: Camera, className: "bg-primary-fixed text-primary-container" },
  { name: "Hammer", label: "Cơ khí", icon: Hammer, className: "bg-surface-container text-on-surface-variant" },
  { name: "Drill", label: "Khoan lắp", icon: Drill, className: "bg-surface-container text-on-surface-variant" },
  { name: "Wrench", label: "Sửa chữa", icon: Wrench, className: "bg-primary-fixed text-primary-container" },
  { name: "AirVent", label: "Điều hòa", icon: AirVent, className: "bg-secondary-fixed text-primary" },
  { name: "Snowflake", label: "Điện lạnh", icon: Snowflake, className: "bg-primary-fixed text-primary-container" },
  { name: "Fan", label: "Quạt gió", icon: Fan, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Refrigerator", label: "Tủ lạnh", icon: Refrigerator, className: "bg-secondary-fixed text-primary" },
  { name: "WashingMachine", label: "Máy giặt", icon: WashingMachine, className: "bg-primary-fixed text-primary-container" },
  { name: "Wifi", label: "Wifi", icon: Wifi, className: "bg-secondary-fixed text-primary" },
  { name: "Router", label: "Router", icon: Router, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Cable", label: "Dây mạng", icon: Cable, className: "bg-primary-fixed text-primary-container" },
  { name: "Truck", label: "Vận chuyển", icon: Truck, className: "bg-secondary-fixed text-primary" },
  { name: "Sofa", label: "Đồ nội thất", icon: Sofa, className: "bg-primary-fixed text-primary-container" },
  { name: "PaintRoller", label: "Sơn nhà", icon: PaintRoller, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Paintbrush", label: "Trang trí", icon: Paintbrush, className: "bg-secondary-fixed text-primary" },
  { name: "Computer", label: "Máy tính", icon: Computer, className: "bg-surface-container text-on-surface-variant" },
  { name: "Monitor", label: "Màn hình", icon: Monitor, className: "bg-surface-container text-on-surface-variant" },
  { name: "Printer", label: "Máy in", icon: Printer, className: "bg-surface-container text-on-surface-variant" },
  { name: "MapPin", label: "Tại nhà", icon: MapPin, className: "bg-primary-fixed text-primary-container" },
  { name: "Clock", label: "Hẹn giờ", icon: Clock, className: "bg-secondary-fixed text-primary" },
  { name: "ShieldCheck", label: "Bảo hành", icon: ShieldCheck, className: "bg-primary-fixed-dim text-primary-container" },
  { name: "Star", label: "Nổi bật", icon: Star, className: "bg-primary-fixed text-primary-container" },
  { name: "Briefcase", label: "Dịch vụ", icon: Briefcase, className: "bg-surface-container text-on-surface-variant" },
  { name: "Settings", label: "Kỹ thuật", icon: Settings, className: "bg-secondary-fixed text-primary" },
  { name: "Calendar", label: "Lịch hẹn", icon: Calendar, className: "bg-primary-fixed text-primary-container" },
  { name: "Phone", label: "Liên hệ", icon: Phone, className: "bg-secondary-fixed text-primary" },
  { name: "Users", label: "Đội thợ", icon: Users, className: "bg-primary-fixed-dim text-primary-container" },
];

const getServiceIconOption = (name: string, fallback = "Wrench") =>
  serviceIconOptions.find(option => option.name === name)
  || serviceIconOptions.find(option => option.name === fallback)
  || serviceIconOptions[0];

const legacyIconAliases: Record<string, ServiceIconOption> = {
  ZapIcon: getServiceIconOption("Bolt", "Lightbulb"),
  DropletIcon: getServiceIconOption("Droplets"),
  CameraIcon: getServiceIconOption("Camera", "Cctv"),
  CogIcon: getServiceIconOption("Settings"),
  WrenchIcon: getServiceIconOption("Wrench"),
  ShieldCheckIcon: getServiceIconOption("ShieldCheck"),
  StarIcon: getServiceIconOption("Star"),
  ClockIcon: getServiceIconOption("Clock"),
  MapPinIcon: getServiceIconOption("MapPin"),
  BriefcaseIcon: getServiceIconOption("Briefcase"),
  BarChartIcon: getServiceIconOption("Network", "Briefcase"),
  CalendarIcon: getServiceIconOption("Calendar"),
  PhoneIcon: getServiceIconOption("Phone"),
  UsersIcon: getServiceIconOption("Users"),
  Network: getServiceIconOption("Network", "Wifi"),
  Laptop: getServiceIconOption("Laptop", "Computer"),
  Grid3X3: getServiceIconOption("Blocks", "Briefcase"),
};

const iconMap = {
  ...Object.fromEntries(serviceIconOptions.map(option => [option.name, option.icon])),
  ...Object.fromEntries(Object.entries(legacyIconAliases).map(([name, option]) => [name, option.icon])),
} as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

const iconColorMap = {
  ...Object.fromEntries(serviceIconOptions.map(option => [option.name, option.className])),
  ...Object.fromEntries(Object.entries(legacyIconAliases).map(([name, option]) => [name, option.className])),
  default: "bg-surface-container text-on-surface-variant",
} as Record<string, string>;

export default function AdminServices() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUnusedCategories, setShowUnusedCategories] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [supportsServiceHierarchy, setSupportsServiceHierarchy] = useState(true);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>({
    name: "",
    description: "",
    base_price: "0",
    icon: "WrenchIcon",
    is_active: true,
    parent_service_id: null
  });

  const serviceById = useMemo(() => new Map(services.map(service => [service.id, service])), [services]);

  const getServiceLevel = useCallback((service: ServiceItem | null | undefined) => {
    if (!service) return 0;

    let level = 0;
    let parentId = service.parent_service_id;
    const visited = new Set<string>();

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = serviceById.get(parentId);
      if (!parent) break;
      level += 1;
      parentId = parent.parent_service_id;
    }

    return level;
  }, [serviceById]);

  const getLevelLabel = (level: number) => {
    if (level === 0) return "danh mục cha";
    if (level === 1) return "danh mục con";
    return "dịch vụ";
  };

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { error: hierarchyError } = await supabase
      .from('services')
      .select('id, parent_service_id')
      .limit(1);
    const hasHierarchyColumn = !hierarchyError;
    setSupportsServiceHierarchy(hasHierarchyColumn);

    const { data } = await supabase
      .from('services')
      .select('id, name, description, base_price, icon, is_active, parent_service_id, created_at, updated_at')
      .order('name', { ascending: true });
    
    if (data) {
      const storedParentMap = hasHierarchyColumn ? {} : getStoredServiceParentMap();
      setServices(data.map(service => ({
        ...service,
        parent_service_id: service.parent_service_id || storedParentMap[service.id] || getDefaultServiceParentId(service.id) || null,
      })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchServices();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchServices]);

  const resetServiceForm = () => {
    setEditingService(null);
    setFormError("");
    setServiceForm({
      name: "",
      description: "",
      base_price: "0",
      icon: "WrenchIcon",
      is_active: true,
      parent_service_id: null
    });
  };

  const openCreateModal = () => {
    resetServiceForm();
    setIsModalOpen(true);
  };

  const openCreateChildModal = (parentService: ServiceItem) => {
    setEditingService(null);
    setFormError("");
    setServiceForm({
      name: "",
      description: "",
      base_price: "0",
      icon: parentService.icon || "WrenchIcon",
      is_active: true,
      parent_service_id: parentService.id
    });
    setIsModalOpen(true);
  };

  const openCreateServiceModal = (childCategory: ServiceItem) => {
    setEditingService(null);
    setFormError("");
    setServiceForm({
      name: "",
      description: "",
      base_price: childCategory.base_price != null && Number(childCategory.base_price) > 0 ? String(childCategory.base_price) : "",
      icon: childCategory.icon || "WrenchIcon",
      is_active: true,
      parent_service_id: childCategory.id
    });
    setIsModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setFormError("");
    setServiceForm({
      name: service.name || "",
      description: service.description || "",
      base_price: service.base_price != null ? String(service.base_price) : "",
      icon: service.icon || "WrenchIcon",
      is_active: service.is_active,
      parent_service_id: service.parent_service_id || null
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetServiceForm();
  };

  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const trimmedName = serviceForm.name.trim();
    const trimmedDescription = serviceForm.description.trim();
    const basePrice = Number(serviceForm.base_price);
    const parentServiceId = serviceForm.parent_service_id || null;

    const parentService = parentServiceId ? serviceById.get(parentServiceId) : null;
    const nextLevel = parentService ? getServiceLevel(parentService) + 1 : 0;

    if (nextLevel > 2) {
      alert("Cấu trúc chỉ hỗ trợ 3 cấp: danh mục cha, danh mục con và dịch vụ.");
      return;
    }

    if (!trimmedName || (nextLevel === 2 && serviceForm.base_price === "")) {
      alert(nextLevel === 2 ? "Vui lòng điền tên dịch vụ và giá cơ bản." : "Vui lòng điền tên danh mục.");
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      alert("Giá cơ bản không hợp lệ.");
      return;
    }

    if (editingService && parentServiceId === editingService.id) {
      alert("Danh mục không thể chọn chính nó làm danh mục cha.");
      return;
    }

    const payload = {
      name: trimmedName,
      description: trimmedDescription,
      base_price: basePrice,
      icon: serviceForm.icon,
      is_active: serviceForm.is_active,
      parent_service_id: parentServiceId
    };

    const dbPayload = supportsServiceHierarchy
      ? payload
      : {
        name: payload.name,
        description: payload.description,
        base_price: payload.base_price,
        icon: payload.icon,
        is_active: payload.is_active,
      };

    setIsSubmitting(true);
    const { data: savedService, error } = editingService
      ? await supabase.from('services').update(dbPayload).eq('id', editingService.id).select('id, name, description, base_price, icon, is_active, parent_service_id, created_at, updated_at').maybeSingle()
      : await supabase.from('services').insert(dbPayload).select('id, name, description, base_price, icon, is_active, parent_service_id, created_at, updated_at').single();

    setIsSubmitting(false);

    if (error) {
      setFormError(`${editingService ? "Lỗi khi cập nhật" : "Lỗi khi tạo"} ${getLevelLabel(nextLevel)}: ${getServiceErrorMessage(error)}`);
      console.error(error);
    } else {
      const nextService = savedService || (editingService ? { ...editingService, ...payload } : null);
      if (!nextService) {
        alert("Không thể lấy dữ liệu danh mục vừa tạo.");
        return;
      }

      if (!supportsServiceHierarchy) {
        const parentMap = getStoredServiceParentMap();
        parentMap[nextService.id] = parentServiceId;
        saveStoredServiceParentMap(parentMap);
      }

      handleCloseModal();
      const serviceWithParent = {
        ...nextService,
        parent_service_id: parentServiceId,
      };
      setServices(prev => {
        const exists = prev.some(service => service.id === serviceWithParent.id);
        const nextServices = exists
          ? prev.map(service => service.id === serviceWithParent.id ? serviceWithParent : service)
          : [...prev, serviceWithParent];
        return nextServices.sort((a, b) => a.name.localeCompare(b.name));
      });
    }
  };

  const handleDeleteService = async (service: ServiceItem) => {
    const descendantIds = getDescendantIds(service.id);
    const message = descendantIds.length > 0
      ? `${service.name} có ${descendantIds.length} mục bên trong. Xóa mục này sẽ xóa toàn bộ danh mục con/dịch vụ liên quan. Bạn có chắc không?`
      : `Bạn có chắc muốn xóa ${getLevelLabel(getServiceLevel(service))} này không?`;

    if (!window.confirm(message)) return;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', service.id);

    if (error) {
      alert("Không thể xóa danh mục: " + error.message);
      console.error(error);
      return;
    }

    const idsToRemove = new Set([service.id, ...descendantIds]);
    if (!supportsServiceHierarchy) {
      const parentMap = getStoredServiceParentMap();
      idsToRemove.forEach(id => {
        delete parentMap[id];
      });
      saveStoredServiceParentMap(parentMap);
    }
    setServices(prev => prev.filter(item => !idsToRemove.has(item.id)));
  };

  const servicesByParent = services.reduce<Record<string, ServiceItem[]>>((acc, service) => {
    if (service.parent_service_id) {
      acc[service.parent_service_id] = [...(acc[service.parent_service_id] || []), service];
    }
    return acc;
  }, {});

  const getDescendantIds = (serviceId: string): string[] => {
    const directChildren = servicesByParent[serviceId] || [];
    return directChildren.flatMap(child => [child.id, ...getDescendantIds(child.id)]);
  };

  const editingServiceHasChildren = Boolean(
    editingService && servicesByParent[editingService.id]?.length
  );

  const isEditingRootService = Boolean(
    editingService && !editingService.parent_service_id
  );

  const formParentService = serviceForm.parent_service_id ? serviceById.get(serviceForm.parent_service_id) : null;
  const formLevel = editingService
    ? getServiceLevel({ ...editingService, parent_service_id: serviceForm.parent_service_id })
    : formParentService ? getServiceLevel(formParentService) + 1 : 0;
  const parentSelectDisabled = isEditingRootService || editingServiceHasChildren;
  const unavailableParentIds = new Set(editingService ? [editingService.id, ...getDescendantIds(editingService.id)] : []);
  const parentOptions = services
    .filter(service => !unavailableParentIds.has(service.id))
    .filter(service => getServiceLevel(service) < 2)
    .sort((a, b) => getServiceLevel(a) - getServiceLevel(b) || a.name.localeCompare(b.name));

  const isInServiceTree = (service: ServiceItem) =>
    Boolean(service.parent_service_id || servicesByParent[service.id]?.length);

  const isUnusedService = (service: ServiceItem) =>
    !service.is_active || (!isInServiceTree(service) && getCanonicalServiceCategories(service).length === 0);

  const unusedServiceCount = services.filter(isUnusedService).length;

  const visibleServices = services.filter(service => {
    const searchLower = searchQuery.toLowerCase();
    if (!showUnusedCategories && isUnusedService(service)) return false;

    const matchesStatus = statusFilter === 'all' ||
                          (statusFilter === 'active' && service.is_active) ||
                          (statusFilter === 'inactive' && !service.is_active);
    if (!matchesStatus) return false;
    if (!searchLower) return true;

    return service.name?.toLowerCase().includes(searchLower) ||
      service.description?.toLowerCase().includes(searchLower);
  });

  const visibleServiceIds = new Set(visibleServices.map(service => service.id));
  const hasVisibleDescendant = (serviceId: string): boolean => {
    return (servicesByParent[serviceId] || []).some(child =>
      visibleServiceIds.has(child.id) || hasVisibleDescendant(child.id)
    );
  };

  const rootServices = services
    .filter(service => !service.parent_service_id)
    .filter(service => {
      if (visibleServiceIds.has(service.id)) return true;
      return hasVisibleDescendant(service.id);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const getVisibleChildren = (parentId: string) => {
    return (servicesByParent[parentId] || [])
      .filter(child => visibleServiceIds.has(child.id) || hasVisibleDescendant(child.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-headline-md text-on-surface font-bold">Danh mục & Bảng giá</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Quản lý danh mục cha, danh mục con và dịch vụ theo cây 3 cấp
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="btn-primary !py-2.5 !px-5 flex items-center gap-2"
        >
          <PlusIcon size={20} />
          <span>Thêm danh mục cha</span>
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
            placeholder="Tìm theo tên danh mục, mô tả..."
            className="input-field !pl-10 !py-2.5 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          <button
            type="button"
            onClick={() => setShowUnusedCategories(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border flex items-center gap-2 ${
              showUnusedCategories
                ? 'bg-secondary-container text-white border-secondary-container shadow-sm'
                : 'bg-white border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
            }`}
            title={showUnusedCategories ? "Ẩn các mục chưa dùng đến" : "Hiện các mục chưa dùng đến"}
          >
            {showUnusedCategories ? <EyeOff size={16} /> : <Eye size={16} />}
            {showUnusedCategories ? 'Ẩn mục chưa dùng' : 'Hiện mục chưa dùng'}
            {unusedServiceCount > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                showUnusedCategories ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
              }`}>
                {unusedServiceCount}
              </span>
            )}
          </button>
          {['all', 'active', 'inactive'].map(status => (
            <button
              key={status}
              onClick={() => {
                if (status === 'inactive') setShowUnusedCategories(true);
                setStatusFilter(status);
              }}
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

      {/* Services Tree */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rootServices.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 text-outline">
            <WrenchIcon size={32} />
          </div>
          <p className="text-body-md font-medium text-on-surface-variant">Không tìm thấy danh mục nào phù hợp.</p>
          <button 
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); setShowUnusedCategories(true); }}
            className="mt-2 text-primary-container font-bold hover:underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rootServices.map(parentService => {
            const iconName = parentService.icon || "WrenchIcon";
            const Icon = iconMap[iconName] || WrenchIcon;
            const colorClass = iconColorMap[iconName] || iconColorMap.default;
            const childServices = getVisibleChildren(parentService.id);

            return (
              <section
                key={parentService.id}
                className="overflow-hidden rounded-xl border border-outline-variant/25 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-4 border-b border-outline-variant/20 bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-[10px] font-extrabold uppercase text-primary-container">
                          Cấp 1 · Danh mục cha
                        </span>
                        <span className={`badge ${parentService.is_active ? 'badge-active' : 'badge-inactive'} text-[10px]`}>
                          {parentService.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                        </span>
                      </div>
                      <h3 className="truncate text-lg font-extrabold text-on-surface">{parentService.name}</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {parentService.description || "Chưa có mô tả cho danh mục này."}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <div className="rounded-lg bg-surface-container-low px-3 py-2 text-right">
                      <div className="text-[10px] font-bold uppercase text-on-surface-variant">Danh mục con</div>
                      <div className="text-sm font-extrabold text-primary-container">{childServices.length}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateChildModal(parentService)}
                      className="h-9 w-9 rounded-lg hover:bg-primary-fixed flex items-center justify-center text-on-surface-variant transition-colors hover:text-primary-container"
                      title="Thêm danh mục con"
                    >
                      <PlusCircle size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(parentService)}
                      className="h-9 w-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors hover:text-primary-container"
                      title="Sửa danh mục"
                    >
                      <Edit size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(parentService)}
                      className="h-9 w-9 rounded-lg hover:bg-error-container flex items-center justify-center text-on-surface-variant transition-colors hover:text-error"
                      title="Xóa danh mục"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-outline-variant/20">
                  {childServices.length === 0 ? (
                    <div className="p-4 text-sm italic text-on-surface-variant">
                      Chưa có danh mục con. Bấm nút + ở danh mục cha để thêm.
                    </div>
                  ) : childServices.map(child => {
                    const serviceItems = getVisibleChildren(child.id);

                    return (
                      <div key={child.id} className="bg-white">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary-container">
                              <Layers size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-extrabold uppercase text-on-surface-variant">
                                  Cấp 2 · Danh mục con
                                </span>
                                <span className={`badge ${child.is_active ? 'badge-active' : 'badge-inactive'} text-[10px]`}>
                                  {child.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                </span>
                              </div>
                              <p className="truncate text-base font-extrabold text-on-surface">{child.name}</p>
                              <p className="mt-0.5 text-sm text-on-surface-variant">
                                {child.description || "Chưa có mô tả cho danh mục con này."}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                            <div className="rounded-lg bg-surface-container-low px-3 py-2 text-right">
                              <div className="text-[10px] font-bold uppercase text-on-surface-variant">Dịch vụ</div>
                              <div className="text-sm font-extrabold text-primary-container">{serviceItems.length}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openCreateServiceModal(child)}
                              className="h-8 w-8 rounded-lg hover:bg-primary-fixed flex items-center justify-center text-on-surface-variant hover:text-primary-container"
                              title="Thêm dịch vụ"
                            >
                              <PlusCircle size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(child)}
                              className="h-8 w-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary-container"
                              title="Sửa danh mục con"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(child)}
                              className="h-8 w-8 rounded-lg hover:bg-error-container flex items-center justify-center text-on-surface-variant hover:text-error"
                              title="Xóa danh mục con"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
                          {serviceItems.length === 0 ? (
                            <div className="pl-11 text-sm italic text-on-surface-variant">
                              Chưa có dịch vụ trong danh mục con này.
                            </div>
                          ) : (
                            <div className="space-y-2 pl-0 sm:pl-11">
                              {serviceItems.map(serviceItem => (
                                <div key={serviceItem.id} className="flex flex-col gap-2 rounded-lg border border-outline-variant/20 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-secondary-fixed px-2 py-0.5 text-[10px] font-extrabold uppercase text-on-secondary-container">
                                        Cấp 3 · Dịch vụ
                                      </span>
                                      <span className={`badge ${serviceItem.is_active ? 'badge-active' : 'badge-inactive'} text-[10px]`}>
                                        {serviceItem.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                      </span>
                                    </div>
                                    <p className="truncate text-sm font-extrabold text-on-surface">{serviceItem.name}</p>
                                    <p className="text-xs text-on-surface-variant">
                                      {serviceItem.description || "Chưa có mô tả dịch vụ."}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center justify-between gap-2">
                                    <div className="text-sm font-extrabold text-primary-container">
                                      {serviceItem.base_price ? Number(serviceItem.base_price).toLocaleString('vi-VN') + 'đ' : 'Liên hệ'}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(serviceItem)}
                                      className="h-7 w-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary-container"
                                      title="Sửa dịch vụ"
                                    >
                                      <Edit size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteService(serviceItem)}
                                      className="h-7 w-7 rounded-lg hover:bg-error-container flex items-center justify-center text-on-surface-variant hover:text-error"
                                      title="Xóa dịch vụ"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Create Service Modal */}
      {isModalOpen && typeof document !== "undefined" && createPortal((
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="flex w-full max-w-xl max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-5rem)]">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/50">
              <h2 className="text-xl font-bold text-on-surface">
                {editingService
                  ? `Sửa ${getLevelLabel(formLevel)}`
                  : `Thêm ${getLevelLabel(formLevel)}`}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="serviceForm" onSubmit={handleSubmitService} className="space-y-5">
                {formError && (
                  <div className="rounded-lg border border-error/25 bg-error-container p-3 text-sm font-semibold text-error">
                    {formError}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Danh mục cha</label>
                  <select
                    className="input-field"
                    value={serviceForm.parent_service_id || ""}
                    onChange={e => setServiceForm({...serviceForm, parent_service_id: e.target.value || null})}
                    disabled={parentSelectDisabled}
                  >
                    <option value="">Không có - danh mục chính</option>
                    {parentOptions
                      .map(service => (
                        <option key={service.id} value={service.id}>
                          {getLevelLabel(getServiceLevel(service))}: {service.name}
                        </option>
                      ))}
                  </select>
                  {editingServiceHasChildren ? (
                    <p className="text-xs font-semibold text-on-surface-variant">
                      Mục này đang có cấp con nên không thể chuyển cấp.
                    </p>
                  ) : isEditingRootService ? (
                    <p className="text-xs font-semibold text-on-surface-variant">
                      Đây là danh mục cha cấp cao nhất.
                    </p>
                  ) : serviceForm.parent_service_id ? (
                    <p className="text-xs font-semibold text-on-surface-variant">
                      Đang tạo/sửa {getLevelLabel(formLevel)} trong {getLevelLabel(getServiceLevel(formParentService || null))} “{formParentService?.name}”.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Tên {getLevelLabel(formLevel)} <span className="text-error">*</span></label>
                  <input 
                    type="text" 
                    placeholder={formLevel === 2 ? "VD: Thay ổ cắm điện" : "VD: Sửa chữa điện"} 
                    className="input-field" 
                    required
                    value={serviceForm.name}
                    onChange={e => setServiceForm({...serviceForm, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface">Mô tả {getLevelLabel(formLevel)}</label>
                  <textarea 
                    placeholder="Mô tả chi tiết các hạng mục khách hàng sẽ nhận được..." 
                    className="input-field min-h-[80px] resize-none" 
                    value={serviceForm.description}
                    onChange={e => setServiceForm({...serviceForm, description: e.target.value})}
                  />
                </div>

                {formLevel === 2 && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-on-surface">Giá cơ bản (VNĐ) <span className="text-error">*</span></label>
                    <input 
                      type="number" 
                      placeholder="VD: 150000" 
                      className="input-field" 
                      required
                      value={serviceForm.base_price}
                      onChange={e => setServiceForm({...serviceForm, base_price: e.target.value})}
                    />
                  </div>
                )}

                {formLevel < 2 && (
                  <input
                    type="hidden"
                    value={serviceForm.base_price}
                    onChange={e => setServiceForm({...serviceForm, base_price: e.target.value})}
                  />
                )}

                <div className="space-y-3">
                  <label className="text-sm font-bold text-on-surface block">Chọn biểu tượng (Icon) hiển thị</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {serviceIconOptions.map(iconOption => {
                      const IconComp = iconOption.icon;
                      const isSelected = serviceForm.icon === iconOption.name || legacyIconAliases[serviceForm.icon]?.name === iconOption.name;
                      
                      return (
                        <button
                          key={iconOption.name}
                          type="button"
                          onClick={() => setServiceForm({...serviceForm, icon: iconOption.name})}
                          className={`min-h-20 rounded-lg border p-2 transition-all ${
                            isSelected 
                              ? `border-primary bg-primary-fixed shadow-sm ring-2 ring-primary/20` 
                              : 'border-outline-variant/50 bg-white hover:border-primary/40 hover:bg-surface-container-low'
                          }`}
                          title={iconOption.label}
                        >
                          <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg ${iconOption.className}`}>
                            <IconComp size={20} />
                          </span>
                          <span className="mt-1 block truncate text-[11px] font-bold text-on-surface">
                            {iconOption.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-outline-variant/30">
                  <div>
                    <label className="text-sm font-bold text-on-surface block">Trạng thái hiển thị</label>
                    <p className="text-xs text-on-surface-variant mt-1">Khách hàng có thể nhìn thấy và đặt danh mục này</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={serviceForm.is_active}
                      onChange={e => setServiceForm({...serviceForm, is_active: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                  </label>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-outline-variant/50 flex justify-end gap-3 bg-surface-container-lowest rounded-b-2xl">
              <button 
                type="button"
                onClick={handleCloseModal}
                className="btn-outline !py-2.5 !px-5"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                form="serviceForm"
                className="btn-primary !py-2.5 !px-5 min-w-[140px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : editingService ? "Cập nhật danh mục" : "Lưu danh mục"}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
