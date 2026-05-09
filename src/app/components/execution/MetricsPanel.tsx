import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Clock, Cpu, RefreshCw, ThumbsDown } from 'lucide-react'
import type { ExecutionMetrics, Subtask } from '../../types/workforce'
import { formatDuration } from '../../utils/execution'

const PIE_COLORS: Record<string, string> = {
  completed: '#10b981',
  running: '#3b82f6',
  pending: '#94a3b8',
  failed: '#ef4444',
  blocked: '#f59e0b',
}

interface MetricsPanelProps {
  metrics: ExecutionMetrics
  subtasks: Subtask[]
}

export function MetricsPanel({ metrics, subtasks }: MetricsPanelProps) {
  const latencyData = Object.entries(metrics.subtask_latencies).map(([id, ms]) => ({
    id: id.slice(0, 8),
    ms: Math.round(ms),
  }))

  const statusCounts = subtasks.reduce<Record<string, number>>((acc, st) => {
    acc[st.status] = (acc[st.status] ?? 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  const stats = [
    {
      label: 'Tempo Total',
      value: formatDuration(metrics.total_elapsed_ms),
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Model Calls',
      value: metrics.model_calls,
      icon: Cpu,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Iterações',
      value: metrics.iterations,
      icon: RefreshCw,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Rejeições Crítico',
      value: metrics.critic_rejections,
      icon: ThumbsDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className={`mb-2 inline-flex size-8 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`size-4 ${s.color}`} />
            </div>
            <p className="text-xl font-semibold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latency Bar Chart */}
        {latencyData.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Latência por Subtarefa (ms)</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={latencyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="id" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(val) => [`${val}ms`, 'Latência']}
                />
                <Bar key="bar-ms" dataKey="ms" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Status Pie Chart */}
        {pieData.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Distribuição por Status</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => <span style={{ fontSize: 11 }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}