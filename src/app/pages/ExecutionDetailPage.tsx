import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, LayoutGrid, GitBranch, Activity, MessageSquare, BarChart3, Info, Users } from 'lucide-react'
import { Button } from '../components/ui/button'
import { StatusBadge } from '../components/shared/StatusBadge'
import { KanbanBoard } from '../components/execution/KanbanBoard'
import { DAGViewer } from '../components/execution/DAGViewer'
import { EventsLog } from '../components/execution/EventsLog'
import { MetricsPanel } from '../components/execution/MetricsPanel'
import { DecisionPanel } from '../components/execution/DecisionPanel'
import { TeamContextFeed } from '../components/execution/TeamContextFeed'
import { MOCK_EXECUTIONS, MOCK_AGENTS } from '../data/mockData'
import type { TaskStatus, WorkforceExecution } from '../types/workforce'

type Tab = 'kanban' | 'dag' | 'events' | 'metrics' | 'decision' | 'team_context'

const BASE_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'kanban', label: 'Task Board', icon: LayoutGrid },
  { id: 'dag', label: 'Grafo DAG', icon: GitBranch },
  { id: 'events', label: 'Eventos', icon: Activity },
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
  { id: 'decision', label: 'Decisão do Planner', icon: Info },
]

const TEAM_TAB: { id: Tab; label: string; icon: React.ElementType } = {
  id: 'team_context',
  label: 'Team Context',
  icon: Users,
}

function getOverallStatus(exec: WorkforceExecution): TaskStatus {
  if (exec.subtasks.every((s) => s.status === 'completed')) return 'completed'
  if (exec.subtasks.some((s) => s.status === 'running')) return 'running'
  if (exec.subtasks.some((s) => s.status === 'failed')) return 'failed'
  if (exec.subtasks.some((s) => s.status === 'pending')) return 'pending'
  return 'blocked'
}

const PATTERN_LABEL: Record<string, string> = {
  sequential: 'Sequencial',
  parallel: 'Paralelo',
  review_critic: 'Review-Critic',
  iterative_refinement: 'Iterativo',
  human_in_the_loop: 'Human-in-Loop',
}

const MODE_LABEL: Record<string, string> = {
  subagent: 'SubAgent',
  team: 'Team',
}

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('kanban')

  const exec = MOCK_EXECUTIONS.find((e) => e.task_id === id)
  if (!exec) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-slate-500">Execução não encontrada.</p>
        <Button variant="outline" onClick={() => navigate('/executions')}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
      </div>
    )
  }

  const agents = MOCK_AGENTS.filter((a) => exec.agent_ids.includes(a.id))
  const status = getOverallStatus(exec)
  const completedCount = exec.subtasks.filter((s) => s.status === 'completed').length
  const progress = Math.round((completedCount / exec.subtasks.length) * 100)

  const isTeamMode = exec.mode === 'team'
  const TABS = isTeamMode ? [...BASE_TABS, TEAM_TAB] : BASE_TABS

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/executions')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-slate-900">{exec.task_name}</h1>
              <StatusBadge status={status} />
              <span className="text-xs font-mono text-slate-400">{exec.task_id}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">{exec.objective}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-6 mt-4 ml-10">
          <MetaItem label="Modo" value={MODE_LABEL[exec.mode]} />
          <MetaItem label="Padrão" value={PATTERN_LABEL[exec.pattern]} />
          <MetaItem
            label="Agentes"
            value={
              <div className="flex items-center gap-1">
                {agents.map((a) => (
                  <div
                    key={a.id}
                    title={a.name}
                    className="size-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ backgroundColor: a.color }}
                  >
                    {a.avatar}
                  </div>
                ))}
              </div>
            }
          />
          <MetaItem
            label="Progresso"
            value={
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span>{completedCount}/{exec.subtasks.length}</span>
              </div>
            }
          />
          <MetaItem
            label="Criado"
            value={new Date(exec.created_at).toLocaleString('pt-BR')}
          />
          {exec.metrics.total_elapsed_ms > 0 && (
            <MetaItem
              label="Duração"
              value={exec.metrics.total_elapsed_ms >= 1000
                ? `${(exec.metrics.total_elapsed_ms / 1000).toFixed(1)}s`
                : `${Math.round(exec.metrics.total_elapsed_ms)}ms`}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 mt-4 ml-10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'kanban' && (
          <KanbanBoard subtasks={exec.subtasks} agents={MOCK_AGENTS} />
        )}
        {activeTab === 'dag' && (
          <DAGViewer subtasks={exec.subtasks} />
        )}
        {activeTab === 'events' && (
          <div className="max-w-2xl">
            <EventsLog events={exec.events} />
          </div>
        )}
        {activeTab === 'metrics' && (
          <MetricsPanel metrics={exec.metrics} subtasks={exec.subtasks} />
        )}
        {activeTab === 'decision' && (
          <div className="max-w-2xl">
            <DecisionPanel metadata={exec.decision_metadata} />
          </div>
        )}
        {activeTab === 'team_context' && (
          <TeamContextFeed
            messages={exec.team_messages ?? []}
            agents={agents}
          />
        )}
      </div>
    </div>
  )
}

function MetaItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400">{label}:</span>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </div>
  )
}