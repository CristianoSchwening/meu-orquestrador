import type { TaskStatus, WorkforceExecution } from '../types/workforce'

export const PATTERN_LABEL: Record<string, string> = {
  sequential: 'Sequencial',
  parallel: 'Paralelo',
  review_critic: 'Review-Critic',
  iterative_refinement: 'Iterativo',
  human_in_the_loop: 'Human-in-Loop',
}

export const MODE_LABEL: Record<string, string> = {
  subagent: 'SubAgent',
  team: 'Team',
}

export function getOverallStatus(exec: WorkforceExecution): TaskStatus {
  if (exec.subtasks.every((s) => s.status === 'completed')) return 'completed'
  if (exec.subtasks.some((s) => s.status === 'running')) return 'running'
  if (exec.subtasks.some((s) => s.status === 'failed')) return 'failed'
  if (exec.subtasks.some((s) => s.status === 'pending')) return 'pending'
  return 'blocked'
}

export function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}
