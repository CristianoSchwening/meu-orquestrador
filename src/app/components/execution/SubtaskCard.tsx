import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock, Ban, Loader2 } from 'lucide-react'
import { cn } from '../ui/utils'
import { StatusBadge } from '../shared/StatusBadge'
import { QualityScore } from '../shared/QualityScore'
import type { Subtask } from '../../types/workforce'

const STATUS_ICON = {
  pending: <Clock className="size-4 text-slate-400" />,
  running: <Loader2 className="size-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="size-4 text-emerald-500" />,
  failed: <AlertCircle className="size-4 text-red-500" />,
  blocked: <Ban className="size-4 text-amber-500" />,
}

interface SubtaskCardProps {
  subtask: Subtask
  agentName?: string
  index: number
}

export function SubtaskCard({ subtask, agentName, index }: SubtaskCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-all',
        subtask.status === 'running' && 'border-blue-200 shadow-sm shadow-blue-50',
        subtask.status === 'completed' && 'border-slate-200',
        subtask.status === 'failed' && 'border-red-200',
        subtask.status === 'blocked' && 'border-amber-200',
        subtask.status === 'pending' && 'border-slate-200 opacity-70',
      )}
    >
      <button
        className="w-full flex items-start gap-3 p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="mt-0.5 shrink-0">{STATUS_ICON[subtask.status]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-400">#{index + 1}</span>
            <StatusBadge status={subtask.status} size="sm" showDot={false} />
            {subtask.quality_score !== null && (
              <QualityScore score={subtask.quality_score} size="sm" />
            )}
            {subtask.attempt > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1">retry #{subtask.attempt}</span>
            )}
          </div>
          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">{subtask.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{subtask.tool_name}</span>
            {agentName && (
              <span className="text-[10px] text-slate-400">→ {agentName}</span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="size-3.5 text-slate-400 shrink-0 mt-1" />
        ) : (
          <ChevronRight className="size-3.5 text-slate-400 shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-2.5">
          {subtask.depends_on.length > 0 && (
            <DetailRow label="Depende de">
              <div className="flex flex-wrap gap-1">
                {subtask.depends_on.map((dep) => (
                  <span key={dep} className="text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{dep}</span>
                ))}
              </div>
            </DetailRow>
          )}

          {subtask.output && (
            <DetailRow label="Output">
              <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 leading-relaxed">{subtask.output}</p>
            </DetailRow>
          )}

          {subtask.error && (
            <DetailRow label="Erro">
              <p className="text-xs text-red-600 bg-red-50 rounded p-2 leading-relaxed">{subtask.error}</p>
            </DetailRow>
          )}

          {subtask.blocked_reason && (
            <DetailRow label="Razão do Bloqueio">
              <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 leading-relaxed">{subtask.blocked_reason}</p>
            </DetailRow>
          )}

          {subtask.critic_feedback && (
            <DetailRow label="Feedback do Crítico">
              <p className="text-xs text-slate-600 bg-purple-50 rounded p-2 leading-relaxed">{subtask.critic_feedback}</p>
            </DetailRow>
          )}

          {(subtask.started_at || subtask.completed_at) && (
            <div className="flex gap-4">
              {subtask.started_at && (
                <DetailRow label="Iniciado">
                  <span className="text-xs text-slate-500">{new Date(subtask.started_at).toLocaleTimeString('pt-BR')}</span>
                </DetailRow>
              )}
              {subtask.completed_at && (
                <DetailRow label="Concluído">
                  <span className="text-xs text-slate-500">{new Date(subtask.completed_at).toLocaleTimeString('pt-BR')}</span>
                </DetailRow>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      {children}
    </div>
  )
}
