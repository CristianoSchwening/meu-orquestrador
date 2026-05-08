import { useMemo } from 'react'
import type { Subtask } from '../../types/workforce'
import { cn } from '../ui/utils'

const STATUS_COLORS = {
  pending: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', dot: 'bg-slate-400' },
  running: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', dot: 'bg-blue-500' },
  completed: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', dot: 'bg-red-500' },
  blocked: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', dot: 'bg-amber-500' },
}

const NODE_W = 180
const NODE_H = 72
const H_GAP = 60
const V_GAP = 20

interface DAGViewerProps {
  subtasks: Subtask[]
}

export function DAGViewer({ subtasks }: DAGViewerProps) {
  const { layers, positions, edges } = useMemo(() => {
    if (!subtasks.length) return { layers: [], positions: {}, edges: [] }

    const depMap: Record<string, string[]> = {}
    subtasks.forEach((st) => { depMap[st.id] = st.depends_on })

    // Assign layers via longest path from root
    const layerOf: Record<string, number> = {}
    function getLayer(id: string): number {
      if (layerOf[id] !== undefined) return layerOf[id]
      const deps = depMap[id] ?? []
      if (!deps.length) { layerOf[id] = 0; return 0 }
      const l = 1 + Math.max(...deps.map(getLayer))
      layerOf[id] = l
      return l
    }
    subtasks.forEach((st) => getLayer(st.id))

    const maxLayer = Math.max(...Object.values(layerOf))
    const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
    subtasks.forEach((st) => layers[layerOf[st.id]].push(st.id))

    // Calculate positions
    const positions: Record<string, { x: number; y: number }> = {}
    const totalH = Math.max(...layers.map((l) => l.length)) * (NODE_H + V_GAP) - V_GAP
    layers.forEach((layer, li) => {
      const colH = layer.length * (NODE_H + V_GAP) - V_GAP
      const startY = (totalH - colH) / 2
      layer.forEach((id, ni) => {
        positions[id] = {
          x: li * (NODE_W + H_GAP),
          y: startY + ni * (NODE_H + V_GAP),
        }
      })
    })

    const edges: { from: string; to: string }[] = []
    subtasks.forEach((st) => {
      st.depends_on.forEach((dep) => {
        if (positions[dep]) edges.push({ from: dep, to: st.id })
      })
    })

    return { layers, positions, edges }
  }, [subtasks])

  if (!subtasks.length) return null

  const allX = Object.values(positions).map((p) => p.x)
  const allY = Object.values(positions).map((p) => p.y)
  const svgW = Math.max(...allX) + NODE_W + 20
  const svgH = Math.max(...allY) + NODE_H + 20

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Arrows */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
        </defs>
        {edges.map(({ from, to }) => {
          const f = positions[from]
          const t = positions[to]
          if (!f || !t) return null
          const x1 = f.x + NODE_W
          const y1 = f.y + NODE_H / 2
          const x2 = t.x
          const y2 = t.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <path
              key={`${from}-${to}`}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              stroke="#94a3b8"
              strokeWidth="1.5"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          )
        })}

        {/* Nodes */}
        {subtasks.map((st) => {
          const pos = positions[st.id]
          if (!pos) return null
          const c = STATUS_COLORS[st.status]
          return (
            <g key={st.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className={cn(c.bg, c.border)}
                fill="white"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              {/* Status dot */}
              <circle cx={14} cy={14} r={5} className={c.dot} fill="currentColor" />
              {/* ID */}
              <text x={24} y={18} fontSize={9} fill="#94a3b8" fontFamily="monospace">
                {st.id.slice(0, 8)}
              </text>
              {/* Description */}
              <foreignObject x={8} y={24} width={NODE_W - 16} height={40}>
                <div className="text-[10px] leading-tight text-slate-700 overflow-hidden" style={{ maxHeight: 40 }}>
                  {st.description.length > 80 ? st.description.slice(0, 80) + '…' : st.description}
                </div>
              </foreignObject>
              {/* Tool */}
              <text x={8} y={66} fontSize={8} fill="#94a3b8" fontFamily="monospace">
                {st.tool_name}
              </text>
              {st.quality_score !== null && (
                <text x={NODE_W - 8} y={66} fontSize={8} fill="#10b981" fontFamily="monospace" textAnchor="end">
                  {Math.round(st.quality_score * 100)}%
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
