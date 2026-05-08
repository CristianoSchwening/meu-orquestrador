import { CheckCircle2, Loader2, Clock, XCircle, Ban, Maximize2 } from 'lucide-react'
import { cn } from '../ui/utils'
import type { Agent, PlaygroundSubtask, TaskStatus } from '../../types/workforce'

const StatusIcon = ({ status }: { status: TaskStatus }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
    case 'running':
      return <Loader2 className="size-4 text-blue-500 shrink-0 animate-spin" />
    case 'failed':
      return <XCircle className="size-4 text-red-500 shrink-0" />
    case 'blocked':
      return <Ban className="size-4 text-amber-500 shrink-0" />
    default:
      return <Clock className="size-4 text-slate-300 shrink-0" />
  }
}

interface AgentColumnProps {
  agent: Agent
  subtasks: PlaygroundSubtask[]
  isActive?: boolean
}

export function AgentColumn({ agent, subtasks, isActive }: AgentColumnProps) {
  const runningCount = subtasks.filter((s) => s.status === 'running').length
  const doneCount = subtasks.filter((s) => s.status === 'completed').length
  const pendingCount = subtasks.filter((s) => s.status === 'pending').length

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white transition-all min-w-[280px] w-[280px]',
        isActive ? 'border-blue-200 shadow-md shadow-blue-50' : 'border-slate-200'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-100">
        <div className="flex items-start gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: agent.color }}
          >
            {agent.avatar}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{agent.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {agent.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-slate-400">
                  # {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Status bar */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="text-[10px] text-slate-500">All {subtasks.length}</span>
          {doneCount > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">{doneCount} Done</span>
          )}
          {runningCount > 0 && (
            <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
              {runningCount} Ongoing
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-[10px] text-slate-400">{pendingCount} Pending</span>
          )}
        </div>
      )}

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {subtasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <Clock className="size-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400">Aguardando tarefas...</p>
          </div>
        ) : (
          subtasks.map((task) => (
            <PlaygroundTaskItem key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  )
}

function PlaygroundTaskItem({ task }: { task: PlaygroundSubtask }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 transition-all',
        task.status === 'running' && 'border-blue-200 bg-blue-50/50',
        task.status === 'completed' && 'border-slate-200 bg-white',
        task.status === 'pending' && 'border-slate-100 bg-slate-50 opacity-60',
        task.status === 'failed' && 'border-red-200 bg-red-50/50',
      )}
    >
      <StatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs leading-relaxed',
          task.status === 'completed' ? 'text-slate-600' : 'text-slate-700',
          task.status === 'pending' && 'text-slate-400',
        )}>
          {task.description}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{task.tool_name}</span>
          {task.status === 'running' && (
            <span className="text-[10px] text-blue-500">Executando...</span>
          )}
          {task.status === 'completed' && task.quality_score !== undefined && (
            <span className="text-[10px] text-emerald-600">{Math.round(task.quality_score * 100)}% qualidade</span>
          )}
        </div>
      </div>
    </div>
  )
}
