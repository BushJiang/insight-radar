// 🔰 AppShell 提供侧边导航 + header + 手机导航
import { AppShell } from '@/components/layout/app-shell'

// 🔰 只对 (main) 路由组生效，page 内容注入到 children
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
