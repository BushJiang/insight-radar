// 🔰 通用工具：cn() = clsx + tailwind-merge 安全合并 className，所有 shadcn 组件和页面通用
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
