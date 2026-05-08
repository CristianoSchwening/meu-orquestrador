import { useState } from 'react'
import { Search, Plus, Wrench, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import { Button } from '../components/ui/button'
import { MOCK_TOOLS } from '../data/mockData'
import type { Tool } from '../types/workforce'

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Web: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Shell: { bg: 'bg-slate-100', text: 'text-slate-700' },
  Code: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Files: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Analysis: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Visualization: { bg: 'bg-pink-100', text: 'text-pink-700' },
  Documents: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Database: { bg: 'bg-orange-100', text: 'text-orange-700' },
}

export default function ToolkitPage() {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const categories = Array.from(new Set(MOCK_TOOLS.map((t) => t.category)))

  const filtered = MOCK_TOOLS.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCategory === 'all' || t.category === filterCategory
    return matchSearch && matchCat
  })

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const grouped = filtered.reduce<Record<string, Tool[]>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = []
    acc[tool.category].push(tool)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Toolkit</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ferramentas disponíveis para os agentes utilizarem</p>
        </div>
        <Button size="sm">
          <Plus className="size-4" />
          Nova Ferramenta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
            placeholder="Buscar ferramenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const c = CATEGORY_COLORS[cat] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? 'bg-slate-900 text-white'
                    : `${c.bg} ${c.text} hover:opacity-80`
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-slate-400" />
          <span>{filtered.length} ferramentas</span>
        </div>
        <span>•</span>
        <span>{categories.length} categorias</span>
      </div>

      {/* Tool Groups */}
      {Object.entries(grouped).map(([category, tools]) => {
        const c = CATEGORY_COLORS[category] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
                <Tag className="size-2.5" />
                {category}
              </span>
              <span className="text-xs text-slate-400">{tools.length} ferramentas</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
              {tools.map((tool) => (
                <ToolRow
                  key={tool.name}
                  tool={tool}
                  expanded={expanded.has(tool.name)}
                  onToggle={() => toggleExpand(tool.name)}
                  categoryColors={c}
                />
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Wrench className="size-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhuma ferramenta encontrada.</p>
        </div>
      )}
    </div>
  )
}

function ToolRow({
  tool,
  expanded,
  onToggle,
  categoryColors,
}: {
  tool: Tool
  expanded: boolean
  onToggle: () => void
  categoryColors: { bg: string; text: string }
}) {
  return (
    <div>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className={`flex size-7 items-center justify-center rounded-lg ${categoryColors.bg} shrink-0`}>
          <Wrench className={`size-3.5 ${categoryColors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-slate-900">{tool.name}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{tool.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400">{tool.params.length} params</span>
          {expanded ? (
            <ChevronDown className="size-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="size-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">{tool.description}</p>
          {tool.params.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Parâmetros</p>
              <div className="space-y-1.5">
                {tool.params.map((param) => (
                  <div key={param.name} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="text-xs font-mono font-medium text-slate-800">{param.name}</span>
                    <span className="text-[10px] text-slate-400">{param.type}</span>
                    {param.required ? (
                      <span className="ml-auto text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5">obrigatório</span>
                    ) : (
                      <span className="ml-auto text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">opcional</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Categoria: {tool.category}</span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
              Testar ferramenta
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
