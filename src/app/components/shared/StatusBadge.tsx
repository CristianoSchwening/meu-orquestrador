import { cn } from '../ui/utils'
import type { TaskStatus } from '../../types/workforce'

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: 'Pendente',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  running: {
    label: 'Executando',
    className: 'bg-blue-50 text-blue-600 border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
  },
  completed: {
    label: 'Concluído',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Falhou',
    className: 'bg-red-50 text-red-600 border-red-200',
    dot: 'bg-red-500',
  },
  blocked: {
    label: 'Bloqueado',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
}

interface StatusBadgeProps {
  status: TaskStatus
  size?: 'sm' | 'md'
  showDot?: boolean
  className?: string
}

export function StatusBadge({
  status,
  size = 'md',
  showDot = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        config.className,
        className
      )}
    >
      {showDot && (
        <span className={cn('size-1.5 rounded-full', config.dot)} />
      )}
      {config.label}
    </span>
  )
}
