import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  ChevronDown,
  ChevronRight,
  Zap,
  Plus,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../components/ui/utils'
import { Button } from '../components/ui/button'
import { AgentColumn } from '../components/playground/AgentColumn'
import { MOCK_AGENTS, PLAYGROUND_SCENARIOS } from '../data/mockData'
import type { PlaygroundSubtask, TaskStatus, PlaygroundScenario } from '../types/workforce'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  thinking?: boolean
}

interface TaskGroup {
  name: string
  subtasks: PlaygroundSubtask[]
  total: number
}

const THINKING_PHRASES = [
  'Analisando o objetivo...',
  'Planejando subtarefas...',
  'Roteando para agentes...',
  'Iniciando execução...',
]

const AGENT_RESPONSES: Record<string, string> = {
  'scenario-ticket': `Claro! Vou acessar o sistema de tickets, verificar os arquivos locais e depois gerar um relatório estatístico completo.

Vou dividir isso em subtarefas e despachar para os agentes disponíveis.`,
  'scenario-research': `Entendido! Vou pesquisar os top 5 concorrentes no mercado de SaaS para gestão de projetos, coletar preços e montar um relatório comparativo.`,
  'scenario-code': `Perfeito! Vou executar análise estática, rodar os testes e depois gerar um relatório detalhado de code review com recomendações priorizadas.`,
  default: `Entendido! Estou analisando sua solicitação e vou planejar as subtarefas necessárias para completar o objetivo.

Despachando para os agentes relevantes agora.`,
}

function detectScenario(text: string): PlaygroundScenario {
  const lower = text.toLowerCase()
  if (lower.includes('ticket') || lower.includes('sistema')) return PLAYGROUND_SCENARIOS[0]
  if (lower.includes('research') || lower.includes('concorrent') || lower.includes('preço')) return PLAYGROUND_SCENARIOS[1]
  if (lower.includes('code') || lower.includes('código') || lower.includes('review') || lower.includes('lint')) return PLAYGROUND_SCENARIOS[2]
  return PLAYGROUND_SCENARIOS[0]
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [agentSubtasks, setAgentSubtasks] = useState<Record<string, PlaygroundSubtask[]>>({})
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])
  const [taskGroupExpanded, setTaskGroupExpanded] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'workspace' | 'agents' | 'triggers'>('workspace')
  const [currentScenario, setCurrentScenario] = useState<PlaygroundScenario | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: Math.random().toString(36).slice(2), timestamp: new Date() },
    ])
  }, [])

  const runSimulation = useCallback((scenario: PlaygroundScenario) => {
    const agents = MOCK_AGENTS.filter((a) => scenario.agent_ids.includes(a.id))
    const subtasksMap: Record<string, PlaygroundSubtask[]> = {}
    agents.forEach((a) => { subtasksMap[a.id] = [] })

    setAgentSubtasks(subtasksMap)
    setCurrentScenario(scenario)

    // Phase 1: Add all tasks as pending after brief delay
    const t1 = setTimeout(() => {
      const allSubtasks: PlaygroundSubtask[] = scenario.subtasks.map((st) => ({
        ...st,
        status: 'pending' as TaskStatus,
      }))

      const newMap: Record<string, PlaygroundSubtask[]> = {}
      agents.forEach((a) => { newMap[a.id] = [] })
      allSubtasks.forEach((st) => {
        if (newMap[st.agent_id]) newMap[st.agent_id].push(st)
        else newMap[st.agent_id] = [st]
      })
      setAgentSubtasks(newMap)

      setTaskGroups([{
        name: scenario.name,
        subtasks: allSubtasks,
        total: allSubtasks.length,
      }])
      setTaskGroupExpanded({ [scenario.name]: true })
    }, 1200)

    // Phase 2+: Animate each subtask through running → completed
    scenario.subtasks.forEach((stDef, idx) => {
      const baseDelay = 2000 + (scenario.delays[idx + 1] ?? 0)

      // Start running
      const tRun = setTimeout(() => {
        setAgentSubtasks((prev) => {
          const next = { ...prev }
          const agentTasks = [...(next[stDef.agent_id] ?? [])]
          const i = agentTasks.findIndex((t) => t.id === stDef.id)
          if (i !== -1) agentTasks[i] = { ...agentTasks[i], status: 'running', started_at: Date.now() }
          next[stDef.agent_id] = agentTasks
          return next
        })
      }, baseDelay)

      // Complete
      const tDone = setTimeout(() => {
        setAgentSubtasks((prev) => {
          const next = { ...prev }
          const agentTasks = [...(next[stDef.agent_id] ?? [])]
          const i = agentTasks.findIndex((t) => t.id === stDef.id)
          if (i !== -1) agentTasks[i] = {
            ...agentTasks[i],
            status: 'completed',
            completed_at: Date.now(),
            quality_score: 0.85 + Math.random() * 0.15,
          }
          next[stDef.agent_id] = agentTasks
          return next
        })
        setTaskGroups((prev) => prev.map((g) => ({
          ...g,
          subtasks: g.subtasks.map((s) =>
            s.id === stDef.id ? { ...s, status: 'completed' as TaskStatus } : s
          ),
        })))
      }, baseDelay + 2400 + Math.random() * 1200)

      timersRef.current.push(tRun, tDone)
    })

    // Final: Done message
    const lastDelay = scenario.delays[scenario.subtasks.length] ?? 0
    const tFinal = setTimeout(() => {
      const completedCount = scenario.subtasks.length
      addMessage({
        role: 'assistant',
        content: `✅ Todas as ${completedCount} subtarefas foram concluídas com sucesso!\n\nO workflow "${scenario.name}" foi finalizado. Você pode ver o histórico completo na seção de Execuções.`,
      })
      setIsRunning(false)
    }, 2000 + (lastDelay || 0) + scenario.subtasks.length * 3600 + 1000)

    timersRef.current.push(t1, tFinal)
  }, [addMessage])

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text || isRunning) return

    clearTimers()
    setIsRunning(true)
    setInput('')
    setAgentSubtasks({})
    setTaskGroups([])

    addMessage({ role: 'user', content: text })

    const scenario = detectScenario(text)

    // Thinking animation
    const msgId = Math.random().toString(36).slice(2)
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: new Date(), thinking: true },
    ])

    let phraseIdx = 0
    const thinkingInterval = setInterval(() => {
      phraseIdx++
      if (phraseIdx >= THINKING_PHRASES.length) {
        clearInterval(thinkingInterval)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  thinking: false,
                  content: AGENT_RESPONSES[scenario.id] ?? AGENT_RESPONSES.default,
                }
              : m
          )
        )
        runSimulation(scenario)
      }
    }, 350)

    timersRef.current.push(thinkingInterval as any)
  }, [input, isRunning, clearTimers, addMessage, runSimulation])

  const handleReset = useCallback(() => {
    clearTimers()
    setIsRunning(false)
    setMessages([])
    setAgentSubtasks({})
    setTaskGroups([])
    setCurrentScenario(null)
  }, [clearTimers])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const activeAgents = currentScenario
    ? MOCK_AGENTS.filter((a) => currentScenario.agent_ids.includes(a.id))
    : MOCK_AGENTS.slice(0, 3)

  const totalDone = Object.values(agentSubtasks).flat().filter((s) => s.status === 'completed').length
  const totalRunning = Object.values(agentSubtasks).flat().filter((s) => s.status === 'running').length
  const totalTasks = Object.values(agentSubtasks).flat().length

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left: Chat Panel */}
      <div className="flex flex-col w-[340px] shrink-0 border-r border-slate-200 bg-white">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <span className="text-sm font-semibold text-slate-900">Playground</span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleReset}>
                <RefreshCw className="size-3" />
                Resetar
              </Button>
            )}
          </div>
        </div>

        {/* Scenario shortcuts */}
        {messages.length === 0 && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Cenários de exemplo:</p>
            <div className="space-y-1.5">
              {PLAYGROUND_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  onClick={() => setInput(s.objective)}
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <br />
                  <span className="text-slate-400 line-clamp-1">{s.objective.slice(0, 60)}...</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.role === 'user' ? (
                <div className="flex gap-2 justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-900 px-3 py-2.5 text-xs text-white leading-relaxed">
                    {msg.content}
                  </div>
                  <div className="size-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="size-3 text-slate-600" />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="size-6 rounded-full bg-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="size-3 text-white" />
                  </div>
                  <div className="max-w-[85%]">
                    {msg.thinking ? (
                      <ThinkingBubble />
                    ) : (
                      <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2.5 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Task Groups */}
        {taskGroups.map((group) => {
          const done = group.subtasks.filter((s) => s.status === 'completed').length
          const ongoing = group.subtasks.filter((s) => s.status === 'running').length
          const isOpen = taskGroupExpanded[group.name]
          return (
            <div key={group.name} className="border-t border-slate-100 bg-slate-50">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors"
                onClick={() => setTaskGroupExpanded((p) => ({ ...p, [group.name]: !p[group.name] }))}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-slate-800">{group.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">
                    {done > 0 && <span className="text-emerald-600">{done} Done</span>}
                    {done > 0 && ongoing > 0 && ' • '}
                    {ongoing > 0 && <span className="text-blue-600">{ongoing} Ongoing</span>}
                    {done === 0 && ongoing === 0 && `${group.total} total`}
                  </span>
                  {isOpen ? <ChevronDown className="size-3 text-slate-400" /> : <ChevronRight className="size-3 text-slate-400" />}
                </div>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1.5">
                      {group.subtasks.map((st, i) => (
                        <div key={st.id} className="flex items-start gap-2">
                          {st.status === 'completed' ? (
                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : st.status === 'running' ? (
                            <Loader2 className="size-3.5 text-blue-500 shrink-0 mt-0.5 animate-spin" />
                          ) : (
                            <div className="size-3.5 rounded-full border border-slate-300 shrink-0 mt-0.5" />
                          )}
                          <p className={cn(
                            'text-[10px] leading-relaxed',
                            st.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-700',
                            st.status === 'pending' && 'text-slate-400',
                          )}>
                            {i + 1}. {st.description.slice(0, 80)}{st.description.length > 80 ? '...' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Input */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-slate-400 transition-colors">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none min-h-[36px] max-h-[120px]"
              placeholder="Descreva o objetivo ou tarefa a executar..."
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
            />
            <div className="flex items-center gap-1 shrink-0">
              <button className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <Zap className="size-3.5" />
              </button>
              <button
                className={cn(
                  'flex size-7 items-center justify-center rounded-lg transition-colors',
                  input.trim() && !isRunning
                    ? 'bg-slate-900 text-white hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
                onClick={handleSubmit}
                disabled={!input.trim() || isRunning}
              >
                {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Agent Workspace */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Workspace Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-0.5">
            {(['workspace', 'agents', 'triggers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                )}
              >
                {tab === 'workspace' ? 'Workspace' : tab === 'agents' ? 'Agent Folder' : 'Trigger'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {totalTasks > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {totalRunning > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Loader2 className="size-3 animate-spin" />
                    {totalRunning} em execução
                  </span>
                )}
                {totalDone > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="size-3" />
                    {totalDone}/{totalTasks} concluídas
                  </span>
                )}
              </div>
            )}
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
              <Plus className="size-3" />
              Add
            </Button>
          </div>
        </div>

        {/* Agent Columns */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'workspace' && (
            <div className="flex gap-4 h-full">
              {activeAgents.map((agent) => {
                const tasks = agentSubtasks[agent.id] ?? []
                const hasActive = tasks.some((t) => t.status === 'running')
                return (
                  <AgentColumn
                    key={agent.id}
                    agent={agent}
                    subtasks={tasks}
                    isActive={hasActive}
                  />
                )
              })}

              {/* Custom Agent placeholder */}
              <div className="flex flex-col rounded-xl border border-dashed border-slate-300 bg-white/50 min-w-[240px] w-[240px] items-center justify-center p-6 gap-3">
                <div className="size-10 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center">
                  <Plus className="size-5 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-600">Agente Personalizado</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Adicione um novo agente ao workflow</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Adicionar Agente
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
              {MOCK_AGENTS.map((agent) => (
                <div key={agent.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-xl text-white font-bold"
                      style={{ backgroundColor: agent.color }}
                    >
                      {agent.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                      <p className="text-[10px] text-slate-400">{agent.tags.slice(0, 2).join(', ')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {agent.toolkit.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-mono">{t}</span>
                    ))}
                    {agent.toolkit.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{agent.toolkit.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'triggers' && (
            <div className="max-w-lg">
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Zap className="size-8 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-slate-700 mb-1">Nenhum trigger configurado</h3>
                <p className="text-xs text-slate-400">Configure triggers para executar workflows automaticamente.</p>
                <Button variant="outline" size="sm" className="mt-4 text-xs">
                  <Plus className="size-3 mr-1" />
                  Adicionar Trigger
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThinkingBubble() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setPhase((p) => (p + 1) % THINKING_PHRASES.length), 700)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Loader2 className="size-3 text-slate-400 animate-spin shrink-0" />
        <p className="text-xs text-slate-400">{THINKING_PHRASES[phase]}</p>
      </div>
    </div>
  )
}
