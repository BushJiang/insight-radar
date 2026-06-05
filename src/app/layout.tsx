import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智源雷达（InsightRadar）",
  description: "找到 GitHub 上最有价值的开源项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
