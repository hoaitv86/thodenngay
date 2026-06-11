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
}

export const DEFAULT_SETTINGS: SettingsData = {
  app_name: "Alo Thợ",
  hotline: "1900 1234",
  support_email: "support@alotho.vn",
  company_address: "123 Đường A, Quận 1, TP.HCM",
  facebook_url: "https://facebook.com/alotho",
  zalo_url: "https://zalo.me/alotho",
  maintenance_mode: false,
  terms_url: "https://alotho.vn/terms",
  privacy_url: "https://alotho.vn/privacy"
};
