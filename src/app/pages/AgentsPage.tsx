import React, { useState } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { MOCK_AGENTS } from '../data/mockData'
import type { Agent } from '../types/workforce'
import { cn } from '../components/ui/utils'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS)
  const [search, setSearch] = useState('')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = agents.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  const handleDelete = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id))
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setShowForm(true)
  }

  const handleNew = () => {
    setEditingAgent(null)
    setShowForm(true)
  }

  const handleSave = (agent: Agent) => {
    if (editingAgent) {
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? agent : a)))
    } else {
      setAgents((prev) => [...prev, { ...agent, id: `agent-${Date.now()}` }])
    }
    setShowForm(false)
    setEditingAgent(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Agentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie os agentes disponíveis no sistema</p>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="size-4" />
          Novo Agente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
          placeholder="Buscar agentes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onEdit={() => handleEdit(agent)}
            onDelete={() => handleDelete(agent.id)}
          />
        ))}
        <button
          onClick={handleNew}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
        >
          <Plus className="size-6" />
          <span className="text-sm">Adicionar Agente</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <AgentFormModal
          agent={editingAgent}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingAgent(null) }}
        />
      )}
    </div>
  )
}

function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: Agent
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl text-white font-bold text-sm"
            style={{ backgroundColor: agent.color }}
          >
            {agent.avatar}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{agent.name}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-400">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={onEdit}
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Tags</p>
        <div className="flex flex-wrap gap-1">
          {agent.tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{tag}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Ferramentas</p>
        <div className="flex flex-wrap gap-1">
          {agent.toolkit.map((tool) => (
            <span key={tool} className="text-[10px] font-mono bg-slate-900 text-white rounded px-1.5 py-0.5">{tool}</span>
          ))}
        </div>
      </div>

      {agent.max_concurrent !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-[10px] text-slate-500">Concorrência máxima:</span>
          <span className="text-xs font-semibold text-slate-900">{agent.max_concurrent}</span>
        </div>
      )}
    </div>
  )
}

function AgentFormModal({
  agent,
  onSave,
  onClose,
}: {
  agent: Agent | null
  onSave: (a: Agent) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Agent>>(
    agent ?? {
      name: '',
      description: '',
      tags: [],
      toolkit: [],
      max_concurrent: null,
      color: '#3b82f6',
      avatar: '',
    }
  )
  const [tagInput, setTagInput] = useState('')
  const [toolInput, setToolInput] = useState('')

  const set = (key: keyof Agent, val: any) => setForm((p) => ({ ...p, [key]: val }))

  const addTag = () => {
    if (tagInput.trim()) {
      set('tags', [...(form.tags ?? []), tagInput.trim()])
      setTagInput('')
    }
  }
  const addTool = () => {
    if (toolInput.trim()) {
      set('toolkit', [...(form.toolkit ?? []), toolInput.trim()])
      setToolInput('')
    }
  }

  const handleSave = () => {
    if (!form.name) return
    onSave({
      id: agent?.id ?? '',
      name: form.name ?? '',
      description: form.description ?? '',
      tags: form.tags ?? [],
      toolkit: form.toolkit ?? [],
      max_concurrent: form.max_concurrent ?? null,
      color: form.color ?? '#3b82f6',
      avatar: form.avatar || (form.name?.charAt(0).toUpperCase() ?? '?'),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{agent ? 'Editar Agente' : 'Novo Agente'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <FormField label="Nome">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: Browser Agent"
            />
          </FormField>
          <FormField label="Descrição">
            <textarea
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cor">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color ?? '#3b82f6'}
                  onChange={(e) => set('color', e.target.value)}
                  className="size-8 rounded-lg border border-slate-200 cursor-pointer"
                />
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
                  value={form.color ?? ''}
                  onChange={(e) => set('color', e.target.value)}
                />
              </div>
            </FormField>
            <FormField label="Avatar (letra/texto)">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={form.avatar ?? ''}
                onChange={(e) => set('avatar', e.target.value)}
                placeholder="Ex: B"
              />
            </FormField>
          </div>
          <FormField label="Max Concorrência">
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              value={form.max_concurrent ?? ''}
              onChange={(e) => set('max_concurrent', e.target.value ? Number(e.target.value) : null)}
              placeholder="Deixe vazio para ilimitado"
            />
          </FormField>
          <FormField label="Tags">
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Adicionar tag..."
              />
              <Button size="sm" variant="outline" onClick={addTag}><Plus className="size-3.5" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(form.tags ?? []).map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  {tag}
                  <button onClick={() => set('tags', (form.tags ?? []).filter((_, j) => j !== i))}><X className="size-2.5" /></button>
                </span>
              ))}
            </div>
          </FormField>
          <FormField label="Ferramentas">
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTool()}
                placeholder="nome_da_ferramenta"
              />
              <Button size="sm" variant="outline" onClick={addTool}><Plus className="size-3.5" /></Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(form.toolkit ?? []).map((tool, i) => (
                <span key={i} className="flex items-center gap-1 text-xs font-mono bg-slate-900 text-white rounded px-1.5 py-0.5">
                  {tool}
                  <button onClick={() => set('toolkit', (form.toolkit ?? []).filter((_, j) => j !== i))}><X className="size-2.5" /></button>
                </span>
              ))}
            </div>
          </FormField>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={!form.name}>
            <CheckCircle2 className="size-3.5" />
            {agent ? 'Salvar' : 'Criar Agente'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  )
}