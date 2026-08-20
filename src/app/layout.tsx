import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ActionFeedbackProvider from "@/components/ActionFeedbackProvider";

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
  title: "Thời Đại Work",
  description: "Hệ thống quản lý công việc nội bộ Báo Thời Đại",
  icons: {
    icon: "/favicon-td.png",
    shortcut: "/favicon-td.png",
    apple: "/favicon-td.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${vietnamSans.variable} ${geistMono.variable} antialiased`}
      >
        <ActionFeedbackProvider><AuthProvider>{children}</AuthProvider></ActionFeedbackProvider>
      </body>
    </html>
  );
}
