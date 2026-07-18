const digitWords = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const unitWords = ["", "nghìn", "triệu", "tỷ"];

const readThreeDigits = (value: number, full = false) => {
  const hundred = Math.floor(value / 100);
  const ten = Math.floor((value % 100) / 10);
  const unit = value % 10;
  const parts: string[] = [];

  if (hundred > 0 || full) parts.push(`${digitWords[hundred]} trăm`);
  if (ten > 1) {
    parts.push(`${digitWords[ten]} mươi`);
    if (unit === 1) parts.push("mốt");
    else if (unit === 5) parts.push("lăm");
    else if (unit > 0) parts.push(digitWords[unit]);
  } else if (ten === 1) {
    parts.push("mười");
    if (unit === 5) parts.push("lăm");
    else if (unit > 0) parts.push(digitWords[unit]);
  } else if (unit > 0) {
    if (hundred > 0 || full) parts.push("lẻ");
    parts.push(unit === 5 && (hundred > 0 || full) ? "năm" : digitWords[unit]);
  }

  return parts.join(" ");
};

export const readVietnameseMoney = (amount: number | string | null | undefined) => {
  const rounded = Math.round(Number(amount || 0));
  if (!Number.isFinite(rounded) || rounded < 0) return "Không đồng";
  if (rounded === 0) return "Không đồng";

  const groups: number[] = [];
  let remaining = rounded;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words = groups
    .map((group, index) => {
      if (group === 0) return "";
      return `${readThreeDigits(group, index < groups.length - 1)} ${unitWords[index] || ""}`.trim();
    })
    .reverse()
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng`;
};
