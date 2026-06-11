'use client'

// 🔰 客户端路由组件，点击不刷新页面，只替换内容区
import Link from 'next/link'
// 🔰 获取当前 URL 路径，用于高亮导航项
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Container } from '@/components/shared/container'
import { ThemeToggle } from '@/components/shared/theme-toggle'

// 🔰 导航项在桌面侧边栏和手机底部导航两处复用，只定义一次
const navigationItems = [
  { href: '/', label: '首页' },
  { href: '/projects', label: '创建项目库' },
  { href: '/search', label: '项目搜索' },
  { href: '/recommendations', label: '智能推荐' },
  { href: '/settings', label: '用户设置' },
]

// 🔰 外壳组件：侧边栏 + header + 内容区 + 手机导航。children 由 layout.tsx 传入
export function AppShell({ children }: { children: ReactNode }) {
  // 🔰 当前路由路径，用于高亮导航项
  const currentPath = usePathname()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:block">
        <nav className="space-y-2" aria-label="主导航">
          {navigationItems.map((item) => {
            const active = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-4 py-3 text-sm transition ${active
                  ? 'bg-white font-medium text-emerald-700 dark:bg-slate-950 dark:text-emerald-400'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-slate-600 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-slate-300'
                  }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-6">
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </header>
        <Container className="pb-24 pt-6 lg:pb-10">{children}</Container>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden" aria-label="移动端主导航">
        {navigationItems.map((item) => {
          const active = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))

          return (
            <Link key={item.href} href={item.href} className={`px-2 py-3 text-center text-xs transition ${active ? 'bg-white font-medium text-emerald-700 dark:bg-slate-950 dark:text-emerald-400' : 'text-slate-500 hover:bg-emerald-50 hover:text-slate-500 dark:text-slate-400 dark:hover:bg-emerald-950/40 dark:hover:text-slate-400'}`}>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
