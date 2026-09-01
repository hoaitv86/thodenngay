import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.thodenngay.app',
  appName: 'Thợ Đến Ngay',
  webDir: 'public',
  server: {
    url: 'https://thodenngay.vn/login?app=android',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
