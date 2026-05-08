import { cn } from '../ui/utils'

interface QualityScoreProps {
  score: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function QualityScore({
  score,
  size = 'md',
  showLabel = true,
  className,
}: QualityScoreProps) {
  const pct = Math.round(score * 100)

  const color =
    pct >= 90
      ? 'text-emerald-600'
      : pct >= 70
      ? 'text-amber-600'
      : 'text-red-600'

  const barColor =
    pct >= 90
      ? 'bg-emerald-500'
      : pct >= 70
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className={cn('font-semibold tabular-nums', color, size === 'sm' ? 'text-xs' : 'text-sm')}>
          {pct}%
        </span>
      )}
      <div className={cn('rounded-full bg-slate-200 overflow-hidden', size === 'sm' ? 'h-1 w-12' : 'h-1.5 w-16')}>
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
