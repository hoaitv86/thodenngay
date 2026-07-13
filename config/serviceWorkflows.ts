export type WorkflowSectionKey =
  | "internet_account"
  | "wifi"
  | "billgo"
  | "camera_account"
  | "camera_devices"
  | "computer_info"
  | "printer_info";

export type ServiceWorkflowKey =
  | "internet_install"
  | "camera_install"
  | "computer_repair"
  | "printer_install";

export type WorkflowFieldType = "text" | "password" | "textarea" | "number" | "date" | "select";

export type WorkflowField = {
  key: string;
  label: string;
  type: WorkflowFieldType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type WorkflowSectionConfig = {
  key: WorkflowSectionKey;
  title: string;
  description?: string;
  fields?: WorkflowField[];
};

export type ServiceWorkflowConfig = {
  key: ServiceWorkflowKey;
  sections: WorkflowSectionKey[];
};

export type ServiceLikeForWorkflow = {
  id: string;
  name?: string | null;
  parentName?: string | null;
};

export type WorkflowData = Record<string, Record<string, unknown>>;

export const handoverWorkflowSectionKeys: WorkflowSectionKey[] = [
  "internet_account",
  "wifi",
  "camera_account",
  "camera_devices",
];

export const workflowSections: Record<WorkflowSectionKey, WorkflowSectionConfig> = {
  internet_account: {
    key: "internet_account",
    title: "Tai khoan Internet",
    fields: [
      { key: "pppoeUsername", label: "Tai khoan Internet/PPPoE", type: "text" },
      { key: "pppoePassword", label: "Mat khau Internet/PPPoE", type: "password" },
    ],
  },
  wifi: {
    key: "wifi",
    title: "WiFi",
    fields: [
      { key: "ssid", label: "Ten WiFi/SSID", type: "text" },
      { key: "password", label: "Mat khau WiFi", type: "password" },
    ],
  },
  billgo: {
    key: "billgo",
    title: "BillGo",
    description: "Thong tin thu cuoc dinh ky neu dich vu co phat sinh goi cuoc.",
    fields: [
      {
        key: "cycle",
        label: "Chu ky thu cuoc",
        type: "select",
        options: [
          { value: "monthly", label: "Hang thang" },
          { value: "three_months", label: "3 thang" },
          { value: "six_months", label: "6 thang" },
          { value: "yearly", label: "12 thang" },
        ],
      },
      { key: "startDate", label: "Ngay bat dau thu cuoc", type: "date" },
      { key: "amount", label: "Gia cuoc", type: "number" },
      { key: "note", label: "Ghi chu thu cuoc", type: "textarea" },
    ],
  },
  camera_account: {
    key: "camera_account",
    title: "Tai khoan Camera",
    fields: [
      { key: "username", label: "Tai khoan Camera", type: "text" },
      { key: "password", label: "Mat khau Camera", type: "password" },
    ],
  },
  camera_devices: {
    key: "camera_devices",
    title: "Danh sach Camera",
    description: "Chi luu QR Text, khong luu anh QR.",
  },
  computer_info: {
    key: "computer_info",
    title: "Thong tin may tinh",
    fields: [
      { key: "windowsPassword", label: "Mat khau Windows neu khach yeu cau luu", type: "password" },
      { key: "spec", label: "Cau hinh may", type: "textarea" },
      { key: "condition", label: "Tinh trang may", type: "textarea" },
      { key: "note", label: "Ghi chu", type: "textarea" },
    ],
  },
  printer_info: {
    key: "printer_info",
    title: "Thong tin may in",
    fields: [
      { key: "model", label: "Model may in", type: "text" },
      { key: "ip", label: "IP may in", type: "text" },
      { key: "driver", label: "Driver", type: "text" },
      { key: "note", label: "Ghi chu", type: "textarea" },
    ],
  },
};

export const serviceWorkflows: Record<ServiceWorkflowKey, ServiceWorkflowConfig> = {
  internet_install: {
    key: "internet_install",
    sections: ["internet_account", "wifi"],
  },
  camera_install: {
    key: "camera_install",
    sections: ["camera_account", "camera_devices"],
  },
  computer_repair: {
    key: "computer_repair",
    sections: ["computer_info"],
  },
  printer_install: {
    key: "printer_install",
    sections: ["printer_info"],
  },
};

const normalizeWorkflowText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

export function getServiceWorkflowKey(service: ServiceLikeForWorkflow): ServiceWorkflowKey | null {
  const text = normalizeWorkflowText(`${service.parentName || ""} ${service.name || ""}`);
  const isInstall = /lap|cai|install|setup|moi/.test(text);
  const isRepairLike = /sua|ve sinh|bao tri|repair|maintenance|windows|pc|laptop|may/.test(text);

  if (/internet|wifi|mang|router|pppoe/.test(text) && isInstall) return "internet_install";
  if (/camera|cctv|dau ghi/.test(text) && isInstall) return "camera_install";
  if (/may tinh|computer|laptop|pc|windows/.test(text) && isRepairLike) return "computer_repair";
  if (/may in|printer|driver/.test(text) && (isInstall || isRepairLike)) return "printer_install";

  return null;
}

function isBillGoInternetInstallService(service: ServiceLikeForWorkflow) {
  const name = normalizeWorkflowText(service.name || "");
  const parentName = normalizeWorkflowText(service.parentName || "");
  const isInternetService = /internet/.test(name) || (/internet|mang/.test(parentName) && /^lap( dat)?$/.test(name));
  const isInstallInternet = /lap|install|moi/.test(name) && isInternetService;

  return isInstallInternet && !/wifi|wi-fi|mesh|router|modem|lan|cap|day|sua|bao tri|di doi|cau hinh|mo rong|nang cap/.test(name);
}

type WorkflowSectionFilterOptions = {
  includeSectionKeys?: WorkflowSectionKey[];
  excludeSectionKeys?: WorkflowSectionKey[];
};

export function getWorkflowSectionsForServices(
  services: ServiceLikeForWorkflow[],
  options: WorkflowSectionFilterOptions = {}
) {
  const sectionKeys = new Set<WorkflowSectionKey>();
  const includeKeys = options.includeSectionKeys ? new Set(options.includeSectionKeys) : null;
  const excludeKeys = new Set(options.excludeSectionKeys || []);

  services.forEach((service) => {
    const workflowKey = getServiceWorkflowKey(service);
    if (!workflowKey) return;
    serviceWorkflows[workflowKey].sections.forEach((sectionKey) => {
      if (includeKeys && !includeKeys.has(sectionKey)) return;
      if (excludeKeys.has(sectionKey)) return;
      sectionKeys.add(sectionKey);
    });

    if (isBillGoInternetInstallService(service)) {
      if ((!includeKeys || includeKeys.has("billgo")) && !excludeKeys.has("billgo")) {
        sectionKeys.add("billgo");
      }
    }
  });

  return Array.from(sectionKeys).map((sectionKey) => workflowSections[sectionKey]);
}

export function pruneWorkflowData(
  data: WorkflowData,
  services: ServiceLikeForWorkflow[],
  options: WorkflowSectionFilterOptions = {}
): WorkflowData {
  const allowed = new Set(getWorkflowSectionsForServices(services, options).map((section) => section.key));
  return Object.fromEntries(Object.entries(data).filter(([sectionKey]) => allowed.has(sectionKey as WorkflowSectionKey)));
}
