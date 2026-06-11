'use client'

import { Button } from '@/components/ui/button'

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
        <Button
          type="button"
          variant="outline"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          上一页
        </Button>
        {items.map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-slate-400 dark:text-slate-500">...</span>
        ) : (
          <Button
            key={item}
            type="button"
            variant={item === currentPage ? 'default' : 'outline'}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          下一页
        </Button>
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
