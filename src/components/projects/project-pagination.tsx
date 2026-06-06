'use client'

interface ProjectPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}

type PaginationItem = number | 'ellipsis'

export function ProjectPagination({ currentPage, totalPages, totalItems, onPageChange }: ProjectPaginationProps) {
  const items = buildPaginationItems(currentPage, totalPages)

  return (
    <div className="flex flex-col items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/40">
        <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="min-w-[84px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            上一页
          </button>
          {items.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-slate-400 dark:text-slate-500">...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? 'page' : undefined}
              className={item === currentPage
                ? 'min-w-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition active:scale-95 dark:bg-emerald-500'
                : 'min-w-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="min-w-[84px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            下一页
          </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">第{currentPage}/{totalPages}页，共{totalItems}个项目</p>
    </div>
  )
}

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 2) {
    return [1, 2, 3, 'ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 1) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
}
