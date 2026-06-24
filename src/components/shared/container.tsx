// 布局容器：控制内容最大宽度和水平居中，支持 sm/md/lg/xl 四种尺寸。首页横幅和内容区使用
interface ContainerProps {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
}

export function Container({ children, size = 'md', className = '' }: ContainerProps) {
  return (
    <div className={`mx-auto px-4 ${sizeClasses[size]} ${className}`.trim()}>
      {children}
    </div>
  )
}
