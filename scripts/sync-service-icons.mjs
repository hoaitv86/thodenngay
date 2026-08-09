import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(line => line && !line.trim().startsWith("#"))
    .map(line => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const normalize = value =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const keywordRules = [
  { icon: "Printer", keywords: ["may in", "printer", "muc", "cartridge", "catrig", "drum", "roller", "truc tu", "khay giay", "cum say", "bao lua", "gat", "scan", "fax", "ket giay", "do muc", "lem muc"] },
  { icon: "Cctv", keywords: ["camera", "dau ghi", "ghi hinh", "tu xa", "hinh anh"] },
  { icon: "Network", keywords: ["mang internet", "internet", "mang noi bo", "lan cap quang", "mang chap chon", "mat mang", "khong cap ip", "khong truy cap internet", "thi cong mang"] },
  { icon: "Wifi", keywords: ["wifi", "mesh"] },
  { icon: "Router", keywords: ["router", "modem", "switch"] },
  { icon: "Cable", keywords: ["day mang", "cap mang", "dut cap", "loi day", "di day", "noi day", "usb", "lan"] },
  { icon: "Laptop", keywords: ["may tinh", "laptop", "windows", "office", "anydesk", "teamviewer", "pc"] },
  { icon: "Monitor", keywords: ["man hinh", "vga", "am thanh"] },
  { icon: "Cpu", keywords: ["cpu", "ram", "main", "mainboard", "bo mach", "linh kien", "o cung", "ssd", "hdd"] },
  { icon: "Smartphone", keywords: ["dien thoai", "phone"] },
  { icon: "Bolt", keywords: ["dien", "nguon", "mat nguon", "o cam"] },
  { icon: "Droplets", keywords: ["nuoc"] },
  { icon: "AirVent", keywords: ["dieu hoa", "may lanh", "dien lanh"] },
  { icon: "Truck", keywords: ["van chuyen", "chuyen nha"] },
  { icon: "Sofa", keywords: ["noi that", "xay dung", "san vuon"] },
  { icon: "PaintRoller", keywords: ["son"] },
  { icon: "ShieldCheck", keywords: ["bao tri", "bao duong", "ve sinh", "kiem tra", "diet virus", "phan quyen", "bao hanh", "don rac", "tan nhiet"] },
  { icon: "Calendar", keywords: ["dinh ky", "hen gio", "lich"] },
  { icon: "Users", keywords: ["tai khoan", "nguoi dung", "mat khau", "cap lai"] },
  { icon: "MapPin", keywords: ["di chuyen", "di doi", "tai nha"] },
  { icon: "Star", keywords: ["nang cap", "toi uu", "tang toc"] },
  { icon: "Settings", keywords: ["cai dat", "cau hinh", "thiet lap", "dong bo"] },
  { icon: "Hammer", keywords: ["co khi"] },
];

const exactRules = new Map([
  ["mang internet", "Network"],
  ["may tinh", "Laptop"],
  ["may in", "Printer"],
  ["camera", "Cctv"],
  ["dien", "Bolt"],
  ["dien co", "Bolt"],
  ["dien lanh", "AirVent"],
  ["nuoc", "Droplets"],
  ["wifi", "Wifi"],
  ["khac", "Blocks"],
]);

const genericRules = new Map([
  ["sua chua", "Wrench"],
  ["bao tri", "ShieldCheck"],
  ["bao duong dinh ky", "Calendar"],
  ["bao tri dinh ky", "Calendar"],
  ["cai dat", "Settings"],
  ["lap dat", "PlusCircle"],
  ["lap moi", "PlusCircle"],
  ["di doi", "MapPin"],
  ["di chuyen", "MapPin"],
  ["nang cap", "Star"],
  ["du lieu", "Briefcase"],
  ["tai khoan", "Users"],
  ["linh kien", "Cpu"],
  ["muc in", "Printer"],
]);

function resolvePath(service, byId) {
  const names = [];
  let current = service;
  const seen = new Set();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parent_service_id ? byId.get(current.parent_service_id) : null;
  }

  return names.join(" / ");
}

function suggestIcon(service) {
  const normalizedName = normalize(service.name);

  if (exactRules.has(normalizedName)) return exactRules.get(normalizedName);
  if (genericRules.has(normalizedName)) return genericRules.get(normalizedName);

  for (const rule of keywordRules) {
    if (rule.keywords.some(keyword => normalizedName.includes(keyword))) return rule.icon;
  }

  const legacyIconMap = new Map([
    ["ZapIcon", "Bolt"],
    ["DropletIcon", "Droplets"],
    ["CogIcon", "Hammer"],
    ["WrenchIcon", "Wrench"],
  ]);

  return legacyIconMap.get(service.icon) || null;
}

const shouldApply = process.argv.includes("--apply");
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: services, error } = await supabase
  .from("services")
  .select("id,name,icon,parent_service_id,is_active")
  .order("name");

if (error) {
  console.error(error);
  process.exit(1);
}

const byId = new Map(services.map(service => [service.id, service]));
const changes = services
  .map(service => ({
    service,
    path: resolvePath(service, byId),
    nextIcon: suggestIcon(service),
  }))
  .filter(change => change.nextIcon && change.service.icon !== change.nextIcon);

console.log(`${shouldApply ? "Applying" : "Dry run"} ${changes.length} icon updates`);

for (const change of changes) {
  console.log(`${change.path}: ${change.service.icon || "(empty)"} -> ${change.nextIcon}`);
}

if (shouldApply) {
  for (const change of changes) {
    const { error: updateError } = await supabase
      .from("services")
      .update({ icon: change.nextIcon })
      .eq("id", change.service.id);

    if (updateError) {
      console.error(`Failed to update ${change.path}`, updateError);
      process.exit(1);
    }
  }
}