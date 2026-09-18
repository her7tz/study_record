import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "研习簿｜个人学习记录",
  description: "记录每一次专注，看见每天的积累。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
