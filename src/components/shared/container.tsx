interface ContainerProps {
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses: Record<NonNullable<ContainerProps['size']>, string> = {
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
