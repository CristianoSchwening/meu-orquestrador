import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Cpu,
  ShieldAlert,
} from 'lucide-react'
import { StatusBadge } from '../components/shared/StatusBadge'
import { Button } from '../components/ui/button'
import { MOCK_EXECUTIONS, MOCK_AGENTS } from '../data/mockData'
import { getOverallStatus, PATTERN_LABEL } from '../utils/execution'

export default function ExecutionsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const agentMap = Object.fromEntries(MOCK_AGENTS.map((a) => [a.id, a]))

  const filtered = MOCK_EXECUTIONS.filter((exec) => {
    const matchSearch =
      !search ||
      exec.task_name.toLowerCase().includes(search.toLowerCase()) ||
      exec.objective.toLowerCase().includes(search.toLowerCase())
    const status = getOverallStatus(exec)
    const matchStatus = filterStatus === 'all' || status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Execuções</h1>
          <p className="text-sm text-slate-500 mt-0.5">Histórico de todas as execuções de Workforce</p>
        </div>
        <Button size="sm" onClick={() => navigate('/workforce')}>
          <Cpu className="size-4" />
          Nova Execução
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
            placeholder="Buscar por nome ou objetivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-slate-400 shrink-0" />
          {(['all', 'completed', 'running', 'failed', 'pending', 'blocked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(
          [
            { status: 'completed', label: 'Concluídas', icon: CheckCircle2, color: 'text-emerald-600' },
            { status: 'running', label: 'Em execução', icon: Loader2, color: 'text-blue-600' },
            { status: 'failed', label: 'Com falha', icon: XCircle, color: 'text-red-600' },
            { status: 'pending', label: 'Pendentes', icon: Clock, color: 'text-slate-500' },
          ] as const
        ).map(({ status, label, icon: Icon, color }) => {
          const count = MOCK_EXECUTIONS.filter((e) => getOverallStatus(e) === status).length
          return (
            <button
              key={status}
              className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition-all ${
                filterStatus === status ? 'border-slate-400 shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            >
              <Icon className={`size-5 shrink-0 ${color}`} />
              <div>
                <p className="text-lg font-semibold text-slate-900">{count}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Execução</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Padrão</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Agentes</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Subtarefas</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Criado em</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    Nenhuma execução encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((exec) => {
                  const status = getOverallStatus(exec)
                  const completedCount = exec.subtasks.filter((s) => s.status === 'completed').length
                  return (
                    <tr
                      key={exec.task_id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/executions/${exec.task_id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-900">{exec.task_name}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[280px] mt-0.5">{exec.objective}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={status} size="sm" />
                          {exec.approval_requests?.some((r) => r.status === 'pending') && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                              <ShieldAlert className="size-2.5" />
                              Aguardando aprovação
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                          {PATTERN_LABEL[exec.pattern] ?? exec.pattern}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1">
                          {exec.agent_ids.slice(0, 3).map((id) => {
                            const agent = agentMap[id]
                            if (!agent) return null
                            return (
                              <div
                                key={id}
                                title={agent.name}
                                className="size-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white"
                                style={{ backgroundColor: agent.color }}
                              >
                                {agent.avatar}
                              </div>
                            )
                          })}
                          {exec.agent_ids.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{exec.agent_ids.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${(completedCount / exec.subtasks.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{completedCount}/{exec.subtasks.length}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-slate-500">
                        {new Date(exec.created_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-3.5">
                        <ArrowRight className="size-3.5 text-slate-400" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
