// 通用工具：cn() = clsx + tailwind-merge 安全合并 className，所有 shadcn 组件和页面通用
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 清洗 HTML 标签和实体，合并多余空白，输出纯文本
export function stripHtml(text: string) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 从纯文本中截取前 N 个字符，在最近的空格处截断避免断字
export function truncateText(text: string, maxLength: number) {
  const trimmed = text.trim()

  if (trimmed.length <= maxLength) return trimmed

  const slice = trimmed.slice(0, maxLength)
  const lastSpace = slice.lastIndexOf(' ')

  return lastSpace > maxLength * 0.7 ? slice.slice(0, lastSpace) : slice
}
