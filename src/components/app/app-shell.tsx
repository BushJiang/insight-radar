import Link from 'next/link'
import type { ReactNode } from 'react'

const navigationItems = [
  { href: '/', label: '首页' },
  { href: '/projects', label: '创建项目库' },
  { href: '/search', label: '项目搜索' },
  { href: '/recommendations', label: '智能推荐' },
  { href: '/settings', label: '用户设置' },
]

interface AppShellProps {
  children: ReactNode
  currentPath?: string
}

export function AppShell({ children, currentPath = '/' }: AppShellProps) {
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
        </header>
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</div>
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
