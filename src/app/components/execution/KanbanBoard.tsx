import { useMemo } from 'react'
import { SubtaskCard } from './SubtaskCard'
import { StatusBadge } from '../shared/StatusBadge'
import type { Subtask, TaskStatus, Agent } from '../../types/workforce'

const COLUMNS: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'blocked']

interface KanbanBoardProps {
  subtasks: Subtask[]
  agents: Agent[]
}

export function KanbanBoard({ subtasks, agents }: KanbanBoardProps) {
  const agentMap = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents]
  )

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Subtask[]> = {
      pending: [],
      running: [],
      completed: [],
      failed: [],
      blocked: [],
    }
    subtasks.forEach((st) => map[st.status].push(st))
    return map
  }, [subtasks])

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((status) => {
        const items = grouped[status]
        return (
          <div key={status} className="flex flex-col gap-2 min-w-[260px] w-[260px]">
            <div className="flex items-center justify-between px-1">
              <StatusBadge status={status} />
              <span className="text-xs text-slate-500 font-medium">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  Nenhuma tarefa
                </div>
              ) : (
                items.map((st, i) => (
                  <SubtaskCard
                    key={st.id}
                    subtask={st}
                    index={subtasks.indexOf(st)}
                    agentName={st.claimed_by ? agentMap[st.claimed_by]?.name : undefined}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
