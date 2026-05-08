import React from 'react'
import {
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Users,
  StopCircle,
  Repeat,
  Flag,
} from 'lucide-react'
import { cn } from '../ui/utils'
import type { ExecutionEvent } from '../../types/workforce'

const EVENT_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: (e: ExecutionEvent) => string }
> = {
  execution_started: {
    icon: Play,
    color: 'text-blue-500 bg-blue-50 border-blue-200',
    label: (e) => `Execução iniciada — modo: ${e.mode}, padrão: ${e.pattern}`,
  },
  execution_finished: {
    icon: Flag,
    color: 'text-slate-500 bg-slate-50 border-slate-200',
    label: (e) => `Execução finalizada com status: ${e.status}`,
  },
  subtask_completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    label: (e) => `Subtarefa ${e.subtask_id} concluída por ${e.agent}`,
  },
  subtask_failed: {
    icon: XCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    label: (e) => `Subtarefa ${e.subtask_id} falhou${e.reason ? ` — ${e.reason}` : ''}`,
  },
  subtask_retry: {
    icon: RefreshCw,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    label: (e) => `Subtarefa ${e.subtask_id} reagendada (tentativa #${e.attempt}) — ${e.critic_feedback ?? ''}`,
  },
  subtask_critic_exhausted: {
    icon: StopCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    label: (e) => `Crítico rejeitou subtarefa ${e.subtask_id} após ${e.attempts} tentativas`,
  },
  subtask_rerouted: {
    icon: ArrowRightLeft,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    label: (e) => `Subtarefa ${e.subtask_id} reroteada: ${e.from_agent} → ${e.to_agent}`,
  },
  subtask_human_approved: {
    icon: UserCheck,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    label: (e) => `Subtarefa ${e.subtask_id} aprovada pelo humano`,
  },
  subtask_human_rejected: {
    icon: UserX,
    color: 'text-red-600 bg-red-50 border-red-200',
    label: (e) => `Subtarefa ${e.subtask_id} rejeitada pelo humano`,
  },
  team_context_shared: {
    icon: Users,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    label: (e) => `Contexto de equipe compartilhado com ${e.agent} (${e.messages_so_far} mensagens)`,
  },
  budget_exceeded: {
    icon: AlertTriangle,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    label: (e) => `Budget excedido — ${e.reason}`,
  },
  refinement_cycle: {
    icon: Repeat,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    label: (e) => `Ciclo de refinamento iterativo — iteração #${e.iteration}`,
  },
  max_iterations_reached: {
    icon: StopCircle,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    label: (e) => `Máximo de iterações atingido (${e.iterations})`,
  },
}

interface EventsLogProps {
  events: ExecutionEvent[]
}

export function EventsLog({ events }: EventsLogProps) {
  if (!events.length) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        Nenhum evento registrado.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const config = EVENT_CONFIG[event.type] ?? {
          icon: Flag,
          color: 'text-slate-500 bg-slate-50 border-slate-200',
          label: () => event.type,
        }
        const Icon = config.icon
        return (
          <div key={event.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border mt-0.5', config.color)}>
              <Icon className="size-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700">{config.label(event)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(event.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}