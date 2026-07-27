export interface SettingsData {
  app_name: string;
  hotline: string;
  support_email: string;
  company_address: string;
  facebook_url: string;
  zalo_url: string;
  maintenance_mode: boolean;
  terms_url: string;
  privacy_url: string;
  apk_backup_download_url: string;
}

export const DEFAULT_SETTINGS: SettingsData = {
  app_name: "Thợ Đến Ngay",
  hotline: "1900 1234",
  support_email: "support@thodenngay.vn",
  company_address: "123 Đường A, Quận 1, TP.HCM",
  facebook_url: "https://facebook.com/thodenngay",
  zalo_url: "https://zalo.me/thodenngay",
  maintenance_mode: false,
  terms_url: "https://thodenngay.vn/terms",
  privacy_url: "https://thodenngay.vn/privacy",
  apk_backup_download_url: "https://raw.githubusercontent.com/tuananh9201/alo-tho/master/public/downloads/thodenngay.apk"
};
