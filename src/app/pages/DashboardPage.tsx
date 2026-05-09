import React from 'react'
import { useNavigate } from 'react-router'
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  Cpu,
  Zap,
  Plus,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { StatusBadge } from '../components/shared/StatusBadge'
import { MOCK_EXECUTIONS, MOCK_AGENTS } from '../data/mockData'
import type { WorkforceExecution } from '../types/workforce'
import { getOverallStatus } from '../utils/execution'

const ACTIVITY_DATA = [
  { day: 'Seg', executions: 3, success: 3 },
  { day: 'Ter', executions: 7, success: 6 },
  { day: 'Qua', executions: 5, success: 4 },
  { day: 'Qui', executions: 9, success: 8 },
  { day: 'Sex', executions: 12, success: 10 },
  { day: 'Sáb', executions: 4, success: 4 },
  { day: 'Dom', executions: 6, success: 5 },
]

// ── Inline SVG bar+line chart (avoids Recharts duplicate-key bug) ─────────────
function ActivityChart() {
  const W = 480
  const H = 180
  const padL = 28
  const padR = 12
  const padT = 10
  const padB = 28

  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxVal = Math.max(...ACTIVITY_DATA.map((d) => d.executions))
  const barGroupW = chartW / ACTIVITY_DATA.length
  const barW = barGroupW * 0.55

  const scaleY = (v: number) => chartH - (v / maxVal) * chartH

  // Line points for success
  const linePoints = ACTIVITY_DATA.map((d, i) => {
    const cx = padL + i * barGroupW + barGroupW / 2
    const cy = padT + scaleY(d.success)
    return `${cx},${cy}`
  }).join(' ')

  const yTicks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ display: 'block' }}>
      {/* Y grid lines + labels */}
      {yTicks.map((t) => {
        const y = padT + scaleY(t)
        return (
          <g key={`ytick-${t}`}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
              {t}
            </text>
          </g>
        )
      })}

      {/* Bars + X labels */}
      {ACTIVITY_DATA.map((d, i) => {
        const x = padL + i * barGroupW + (barGroupW - barW) / 2
        const bh = (d.executions / maxVal) * chartH
        const by = padT + chartH - bh
        const cx = padL + i * barGroupW + barGroupW / 2
        return (
          <g key={`bar-${d.day}`}>
            <rect x={x} y={by} width={barW} height={bh} fill="#e2e8f0" rx={2} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">
              {d.day}
            </text>
          </g>
        )
      })}

      {/* Success line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Success dots */}
      {ACTIVITY_DATA.map((d, i) => {
        const cx = padL + i * barGroupW + barGroupW / 2
        const cy = padT + scaleY(d.success)
        return <circle key={`dot-${d.day}`} cx={cx} cy={cy} r={3} fill="#3b82f6" />
      })}
    </svg>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const completed = MOCK_EXECUTIONS.filter((e) => getOverallStatus(e) === 'completed').length
  const running = MOCK_EXECUTIONS.filter((e) => getOverallStatus(e) === 'running').length
  const failed = MOCK_EXECUTIONS.filter((e) => getOverallStatus(e) === 'failed').length
  const totalSubtasks = MOCK_EXECUTIONS.reduce((a, e) => a + e.subtasks.length, 0)

  const stats = [
    { label: 'Execuções Totais', value: MOCK_EXECUTIONS.length, icon: Cpu, color: 'text-blue-600', bg: 'bg-blue-50', change: '+12%' },
    { label: 'Concluídas', value: completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', change: '+8%' },
    { label: 'Em Execução', value: running, icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', change: '0%' },
    { label: 'Com Falha', value: failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', change: '-3%' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral do sistema de orquestração multi-agente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/playground')}>
            <Zap className="size-4" />
            Playground
          </Button>
          <Button size="sm" onClick={() => navigate('/workforce')}>
            <Plus className="size-4" />
            Nova Execução
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`flex size-9 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`size-4 ${s.color}`} />
              </div>
              <span className={`text-xs font-medium ${s.change.startsWith('+') ? 'text-emerald-600' : s.change.startsWith('-') ? 'text-red-500' : 'text-slate-400'}`}>
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-900">Atividade da Semana</h3>
              <p className="text-xs text-slate-400">Execuções totais vs. concluídas com sucesso</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="inline-block w-3 h-2.5 rounded-sm bg-slate-200" /> Total
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" /> Sucesso
              </span>
              <TrendingUp className="size-4 text-slate-400" />
            </div>
          </div>
          <div className="h-[200px]">
            <ActivityChart />
          </div>
        </div>

        {/* Agents Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900">Agentes</h3>
            <Users className="size-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {MOCK_AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3">
                <div
                  className="flex size-8 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{agent.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{agent.tags.slice(0, 2).join(', ')}</p>
                </div>
                <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-4 text-xs" onClick={() => navigate('/agents')}>
            Ver todos os agentes
          </Button>
        </div>
      </div>

      {/* Recent Executions */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-slate-900">Execuções Recentes</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/executions')}>
            Ver todas <ArrowRight className="size-3" />
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_EXECUTIONS.map((exec) => (
            <ExecutionRow key={exec.task_id} exec={exec} onClick={() => navigate(`/executions/${exec.task_id}`)} />
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Subtarefas Totais"
          value={totalSubtasks}
          sub="em todas as execuções"
          icon={<Clock className="size-4 text-slate-400" />}
        />
        <StatCard
          label="Agentes Disponíveis"
          value={MOCK_AGENTS.length}
          sub="prontos para execução"
          icon={<Users className="size-4 text-slate-400" />}
        />
        <StatCard
          label="Taxa de Sucesso"
          value={`${Math.round((completed / MOCK_EXECUTIONS.length) * 100)}%`}
          sub="últimas 7 dias"
          icon={<TrendingUp className="size-4 text-slate-400" />}
        />
      </div>
    </div>
  )
}

function ExecutionRow({ exec, onClick }: { exec: WorkforceExecution; onClick: () => void }) {
  const status = getOverallStatus(exec)

  return (
    <button
      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-slate-900 truncate">{exec.task_name}</p>
          <StatusBadge status={status} size="sm" />
        </div>
        <p className="text-xs text-slate-400 truncate">{exec.objective}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-slate-500">{exec.subtasks.length} subtarefas</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{exec.pattern}</p>
      </div>
      <ArrowRight className="size-3.5 text-slate-400 shrink-0" />
    </button>
  )
}

function StatCard({ label, value, sub, icon }: { label: string; value: any; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 shrink-0">{icon}</div>
      <div>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-[10px] text-slate-400">{sub}</p>
      </div>
    </div>
  )
}