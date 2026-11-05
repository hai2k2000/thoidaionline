import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ActionFeedbackProvider from "@/components/ActionFeedbackProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const vietnamSans = Be_Vietnam_Pro({
  variable: "--font-vietnam-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Thời Đại Work", statusBarStyle: "default" },
  title: "Thời Đại Work",
  description: "Hệ thống quản lý công việc nội bộ Báo Thời Đại",
  icons: {
    icon: "/favicon-td.png",
    shortcut: "/favicon-td.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#ea580c" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html lang="vi">
      <body
        className={`${vietnamSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <ActionFeedbackProvider><AuthProvider>{children}</AuthProvider></ActionFeedbackProvider>
      </body>
    </html>
  );
}
