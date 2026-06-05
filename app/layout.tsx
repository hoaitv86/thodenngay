import type { Metadata } from "next";
import "./app.css";

export const metadata: Metadata = {
  title: "Alo Thợ – Dịch vụ sửa chữa tại nhà",
  description:
    "Nền tảng kết nối khách hàng với thợ sửa chữa chuyên nghiệp. Đặt dịch vụ điện, nước, camera, cơ khí nhanh chóng, an toàn.",
  keywords: ["sửa chữa", "thợ điện", "thợ nước", "dịch vụ tại nhà", "Alo Thợ"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
