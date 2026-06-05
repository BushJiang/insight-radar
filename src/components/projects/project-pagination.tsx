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
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="rounded-xl border border-slate-200 px-4 py-2 font-medium transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          上一页
        </button>
        {items.map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-slate-500 dark:text-slate-400">...</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            className={item === currentPage
              ? 'rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm transition active:scale-95'
              : 'rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900'}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="rounded-xl border border-slate-200 px-4 py-2 font-medium transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          下一页
        </button>
      </div>
      <p>第{currentPage}/{totalPages}页，共{totalItems}个项目</p>
    </div>
  )
}

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const visiblePages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  return visiblePages.flatMap((page, index) => {
    const previousPage = visiblePages[index - 1]

    if (!previousPage || page - previousPage === 1) {
      return [page]
    }

    return ['ellipsis', page]
  })
}
