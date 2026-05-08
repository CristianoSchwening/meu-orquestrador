import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import {
  ChevronRight,
  ChevronLeft,
  Users,
  Zap,
  Settings,
  Wrench,
  CheckCircle2,
  Play,
  Plus,
  Trash2,
  GitBranch,
  Repeat,
  UserCheck,
  List,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { MOCK_AGENTS } from '../data/mockData'
import type { ExecutionPattern, ExecutionMode } from '../types/workforce'
import { cn } from '../components/ui/utils'

type Step = 'agents' | 'pattern' | 'budget' | 'hooks' | 'review'

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'agents', label: 'Agentes', icon: Users },
  { id: 'pattern', label: 'Padrão', icon: Zap },
  { id: 'budget', label: 'Budget', icon: Settings },
  { id: 'hooks', label: 'Hooks', icon: Wrench },
  { id: 'review', label: 'Revisão', icon: CheckCircle2 },
]

const PATTERNS: { id: ExecutionPattern; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'sequential', label: 'Sequencial', description: 'Executa subtarefas uma a uma, na ordem de dependência.', icon: List },
  { id: 'parallel', label: 'Paralelo', description: 'Executa subtarefas independentes simultaneamente.', icon: Zap },
  { id: 'review_critic', label: 'Review-Critic', description: 'Um crítico avalia o output de cada subtarefa antes de avançar.', icon: UserCheck },
  { id: 'iterative_refinement', label: 'Refinamento Iterativo', description: 'Ciclos de execução e melhoria até atingir o quality threshold.', icon: Repeat },
  { id: 'human_in_the_loop', label: 'Human-in-the-Loop', description: 'Requer aprovação humana após cada subtarefa concluída.', icon: UserCheck },
]

interface FormValues {
  name: string
  objective: string
  agent_ids: string[]
  execution_mode: ExecutionMode
  execution_pattern: ExecutionPattern
  max_iterations: string
  max_model_calls: string
  max_elapsed_ms: string
  quality_threshold: string
  has_critic: boolean
  has_human_gate: boolean
  has_dynamic_router: boolean
  has_on_task_created: boolean
  has_on_task_completed: boolean
}

export default function WorkforceBuilderPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('agents')
  const [launched, setLaunched] = useState(false)

  const { register, watch, setValue, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      name: '',
      objective: '',
      agent_ids: [],
      execution_mode: 'subagent',
      execution_pattern: 'sequential',
      max_iterations: '5',
      max_model_calls: '20',
      max_elapsed_ms: '',
      quality_threshold: '0.8',
      has_critic: false,
      has_human_gate: false,
      has_dynamic_router: false,
      has_on_task_created: false,
      has_on_task_completed: false,
    },
  })

  const values = watch()
  const currentStepIdx = STEPS.findIndex((s) => s.id === step)

  const toggleAgent = (id: string) => {
    const current = values.agent_ids
    if (current.includes(id)) {
      setValue('agent_ids', current.filter((a) => a !== id))
    } else {
      setValue('agent_ids', [...current, id])
    }
  }

  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.id === step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id)
  }
  const goPrev = () => {
    const idx = STEPS.findIndex((s) => s.id === step)
    if (idx > 0) setStep(STEPS[idx - 1].id)
  }

  const onSubmit = () => {
    setLaunched(true)
    setTimeout(() => navigate('/executions/exec-003'), 2000)
  }

  if (launched) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Play className="size-8 text-emerald-600" />
        </div>
        <h2 className="text-slate-900">Workforce iniciado!</h2>
        <p className="text-sm text-slate-500">Redirecionando para o monitor de execução...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-slate-900">Workforce Builder</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure e lance um novo workflow multi-agente</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, idx) => {
          const isCurrent = s.id === step
          const isDone = idx < currentStepIdx
          return (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <button
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors flex-1 justify-center',
                  isCurrent ? 'bg-slate-900 text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                )}
                onClick={() => setStep(s.id)}
              >
                {isDone ? <CheckCircle2 className="size-3.5" /> : <s.icon className="size-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && <ChevronRight className="size-3 text-slate-300 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">

        {step === 'agents' && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-800">Nome do Workflow</label>
              <input
                {...register('name')}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                placeholder="Ex: Ticket Automation Pipeline"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">Objetivo</label>
              <textarea
                {...register('objective')}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors resize-none"
                placeholder="Descreva o objetivo principal do workflow..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800 block mb-2">Selecionar Agentes</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MOCK_AGENTS.map((agent) => {
                  const selected = values.agent_ids.includes(agent.id)
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                        selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div
                        className="flex size-8 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: agent.color }}
                      >
                        {agent.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-900">{agent.name}</p>
                          {selected && <CheckCircle2 className="size-3.5 text-emerald-500 ml-auto shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{agent.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {agent.tags.map((t) => (
                            <span key={t} className="text-[10px] text-slate-400">#{t}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800 block mb-2">Modo de Execução</label>
              <div className="flex gap-3">
                {(['subagent', 'team'] as ExecutionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setValue('execution_mode', mode)}
                    className={cn(
                      'flex-1 rounded-lg border px-4 py-3 text-sm transition-all',
                      values.execution_mode === mode ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'
                    )}
                  >
                    {mode === 'subagent' ? 'SubAgent' : 'Team'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'pattern' && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-800 block mb-1">Padrão de Execução</label>
            {PATTERNS.map((p) => {
              const selected = values.execution_pattern === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setValue('execution_pattern', p.id)}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                    selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className={cn('flex size-8 items-center justify-center rounded-lg shrink-0', selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500')}>
                    <p.icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{p.label}</p>
                      {selected && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {step === 'budget' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Defina limites de execução para o workflow. Deixe em branco para ilimitado.</p>
            {[
              { name: 'max_iterations' as const, label: 'Máximo de Iterações', placeholder: 'Ex: 5', desc: 'Número máximo de ciclos de refinamento iterativo.' },
              { name: 'max_model_calls' as const, label: 'Máximo de Model Calls', placeholder: 'Ex: 20', desc: 'Total de chamadas ao modelo durante toda a execução.' },
              { name: 'max_elapsed_ms' as const, label: 'Tempo Máximo (ms)', placeholder: 'Ex: 300000', desc: 'Tempo máximo de execução em milissegundos.' },
              { name: 'quality_threshold' as const, label: 'Quality Threshold (0–1)', placeholder: 'Ex: 0.8', desc: 'Score mínimo aceito pelo crítico para aprovar subtarefas.' },
            ].map((field) => (
              <div key={field.name}>
                <label className="text-sm font-medium text-slate-800">{field.label}</label>
                <p className="text-xs text-slate-400 mb-1">{field.desc}</p>
                <input
                  {...register(field.name)}
                  type="number"
                  step="any"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        {step === 'hooks' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Configure funcionalidades avançadas do Workforce.</p>
            {[
              { name: 'has_critic' as const, label: 'Critic Function', desc: 'Habilita revisão automática de qualidade após cada subtarefa completada.' },
              { name: 'has_human_gate' as const, label: 'Human Approval Gate', desc: 'Requer aprovação manual para cada subtarefa antes de avançar.' },
              { name: 'has_dynamic_router' as const, label: 'Dynamic Router', desc: 'Roteia subtarefas automaticamente para o agente menos ocupado.' },
              { name: 'has_on_task_created' as const, label: 'Hook: on_task_created', desc: 'Callback executado quando uma nova subtarefa é criada.' },
              { name: 'has_on_task_completed' as const, label: 'Hook: on_task_completed', desc: 'Callback executado quando uma subtarefa é concluída.' },
            ].map((toggle) => (
              <div key={toggle.name} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{toggle.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{toggle.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue(toggle.name, !values[toggle.name])}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                    values[toggle.name] ? 'bg-slate-900' : 'bg-slate-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-4 rounded-full bg-white shadow transition-transform',
                      values[toggle.name] ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Revise a configuração antes de lançar.</p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200">
              <ReviewRow label="Nome" value={values.name || '(sem nome)'} />
              <ReviewRow label="Modo" value={values.execution_mode} />
              <ReviewRow label="Padrão" value={values.execution_pattern} />
              <ReviewRow
                label="Agentes"
                value={
                  <div className="flex gap-1 flex-wrap">
                    {values.agent_ids.length === 0 ? (
                      <span className="text-slate-400">Nenhum selecionado</span>
                    ) : (
                      values.agent_ids.map((id) => {
                        const agent = MOCK_AGENTS.find((a) => a.id === id)
                        return agent ? (
                          <span key={id} className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">{agent.name}</span>
                        ) : null
                      })
                    )}
                  </div>
                }
              />
              <ReviewRow label="Max Iterações" value={values.max_iterations || '∞'} />
              <ReviewRow label="Max Model Calls" value={values.max_model_calls || '∞'} />
              <ReviewRow label="Quality Threshold" value={values.quality_threshold || 'N/A'} />
              <ReviewRow label="Critic" value={values.has_critic ? 'Ativado' : 'Desativado'} />
              <ReviewRow label="Human Gate" value={values.has_human_gate ? 'Ativado' : 'Desativado'} />
              <ReviewRow label="Dynamic Router" value={values.has_dynamic_router ? 'Ativado' : 'Desativado'} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goPrev} disabled={currentStepIdx === 0}>
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        {step === 'review' ? (
          <Button onClick={handleSubmit(onSubmit)} className="gap-2">
            <Play className="size-4" />
            Lançar Workforce
          </Button>
        ) : (
          <Button onClick={goNext}>
            Próximo
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-800">{value}</span>
    </div>
  )
}