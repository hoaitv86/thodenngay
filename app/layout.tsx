import type { Metadata, Viewport } from "next";
import "./app.css";
import OfflineRuntime from "@/app/components/OfflineRuntime";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Thợ đến ngay – Dịch vụ sửa chữa tại nhà",
  description:
    "Nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp. Đặt dịch vụ điện, nước, camera, cơ khí nhanh chóng, an toàn.",
  keywords: ["sửa chữa", "thợ điện", "thợ nước", "dịch vụ tại nhà", "Thợ đến ngay"],
  openGraph: {
    images: [
      {
        url: "https://thodenngay.vn/og-thodenngay-share-20260830.png",
        width: 1802,
        height: 1079,
      },
    ],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  manifest: '/site.webmanifest'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <OfflineRuntime />
        {children}
      </body>
    </html>
  );
}
