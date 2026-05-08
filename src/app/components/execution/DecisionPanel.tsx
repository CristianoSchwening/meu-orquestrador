import React from 'react'
import { Users, GitBranch, Layers, Zap, Activity, CheckCircle2, XCircle } from 'lucide-react'
import type { DecisionMetadata } from '../../types/workforce'

interface DecisionPanelProps {
  metadata: DecisionMetadata
}

export function DecisionPanel({ metadata }: DecisionPanelProps) {
  const items = [
    {
      icon: Users,
      label: 'Agentes Recomendados',
      value: metadata.recommended_agents,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: GitBranch,
      label: 'Subtarefas Independentes',
      value: metadata.independent_subtasks,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      icon: Layers,
      label: 'Profundidade de Dependências',
      value: metadata.dependency_depth,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      icon: Activity,
      label: 'Score de Conflito de Recursos',
      value: metadata.resource_conflict_score.toFixed(2),
      color: metadata.resource_conflict_score > 0.5 ? 'text-amber-600' : 'text-emerald-600',
      bg: metadata.resource_conflict_score > 0.5 ? 'bg-amber-50' : 'bg-emerald-50',
    },
    {
      icon: Zap,
      label: 'Overhead Estimado',
      value: metadata.estimated_overhead.toFixed(2),
      color: metadata.estimated_overhead > 0.7 ? 'text-red-600' : 'text-emerald-600',
      bg: metadata.estimated_overhead > 0.7 ? 'bg-red-50' : 'bg-emerald-50',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Parallelism Verdict */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        metadata.parallelism_worth_it
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        {metadata.parallelism_worth_it ? (
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="size-5 text-amber-600 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${metadata.parallelism_worth_it ? 'text-emerald-800' : 'text-amber-800'}`}>
            {metadata.parallelism_worth_it
              ? 'Paralelismo recomendado'
              : 'Paralelismo não recomendado'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {metadata.parallelism_worth_it
              ? 'O planner identificou que executar subtarefas em paralelo é benéfico para este workflow.'
              : 'A profundidade de dependências ou overhead torna a execução sequencial mais eficiente.'}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className={`mb-2 inline-flex size-7 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`size-3.5 ${item.color}`} />
            </div>
            <p className="text-lg font-semibold text-slate-900">{item.value}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}