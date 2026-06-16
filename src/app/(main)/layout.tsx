// 🔰 (main) 路由组布局：所有页面包裹 AppShell（桌面侧边栏 + header + 手机底部导航）
import { AppShell } from '@/components/layout/app-shell'

// 🔰 只对 (main) 路由组生效，page 内容注入到 children
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
