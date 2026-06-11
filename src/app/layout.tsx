import type { Metadata } from "next";
// 🔰 Tailwind CSS、shadcn/ui 变量、品牌色，所有页面生效
import "./globals.css";
// 🔰 next/font/google 构建时下载字体到本地，不产生外部网络请求
import { Geist } from "next/font/google";
// 🔰 clsx + tailwind-merge，安全合并 className
import { cn } from "@/lib/utils";
// 🔰 next-themes 封装，所有子组件能用 useTheme()
import { ThemeProvider } from "@/components/shared/theme-provider";

// 🔰 subsets 只加载拉丁字符集减小体积，variable 注册为 CSS 变量
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// 🔰 Next.js 自动转为 <title> 和 <meta> 标签插入 HTML <head>
export const metadata: Metadata = {
  title: "智源雷达（InsightRadar）",
  description: "找到 GitHub 上最有价值的开源项目",
};

// 🔰 根布局：所有页面共用，只执行一次。children = 当前路由 page.tsx 的渲染结果
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 🔰 lang 告诉浏览器中文页面，antialiased 字体抗锯齿，suppressHydrationWarning 抑制 next-themes 警告
    <html lang="zh-CN" className={cn("h-full antialiased", "font-sans", geist.variable)} suppressHydrationWarning>
      {/* 🔰 min-h-full 撑满视口，flex flex-col 纵向排列 */}
      <body className="min-h-full flex flex-col">
        {/* 🔰 attribute="class" 通过 html 的 class 切换 dark/light */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
