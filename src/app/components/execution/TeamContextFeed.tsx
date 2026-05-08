import React, { useState } from 'react'
import { MessageSquare, Link2 } from 'lucide-react'
import { cn } from '../ui/utils'
import type { TeamMessage, Agent } from '../../types/workforce'

interface TeamContextFeedProps {
  messages: TeamMessage[]
  agents: Agent[]
}

function getAgent(agents: Agent[], senderId: string): Agent | undefined {
  return agents.find((a) => a.id === senderId)
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TeamContextFeed({ messages, agents }: TeamContextFeedProps) {
  const [filter, setFilter] = useState<string>('all')

  if (!messages.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <MessageSquare className="size-8 opacity-40" />
        <p className="text-sm">Nenhuma mensagem no contexto de equipe.</p>
      </div>
    )
  }

  const senderIds = Array.from(new Set(messages.map((m) => m.sender)))

  const filtered =
    filter === 'all' ? messages : messages.filter((m) => m.sender === filter)

  let lastDate = ''

  return (
    <div className="max-w-2xl space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
          )}
        >
          Todos ({messages.length})
        </button>
        {senderIds.map((sid) => {
          const agent = getAgent(agents, sid)
          const count = messages.filter((m) => m.sender === sid).length
          return (
            <button
              key={sid}
              onClick={() => setFilter(sid)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                filter === sid
                  ? 'text-white border-transparent'
                  : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-400'
              )}
              style={filter === sid ? { backgroundColor: agent?.color ?? '#64748b' } : {}}
            >
              {agent && (
                <span
                  className="size-3.5 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ fontSize: '7px', backgroundColor: agent.color }}
                >
                  {agent.avatar}
                </span>
              )}
              {agent?.name ?? sid} ({count})
            </button>
          )
        })}
      </div>

      {/* Message list */}
      <div className="space-y-2">
        {filtered.map((msg) => {
          const agent = getAgent(agents, msg.sender)
          const dateLabel = new Date(msg.timestamp).toLocaleDateString('pt-BR')
          const showDateSeparator = dateLabel !== lastDate
          lastDate = dateLabel

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {formatDate(msg.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              )}
              <div className="flex items-start gap-3 group">
                {/* Avatar */}
                <div
                  className="size-7 rounded-full flex items-center justify-center text-white font-bold shrink-0 mt-0.5 shadow-sm"
                  style={{
                    backgroundColor: agent?.color ?? '#94a3b8',
                    fontSize: agent && agent.avatar.length > 1 ? '8px' : '11px',
                  }}
                  title={agent?.name ?? msg.sender}
                >
                  {agent?.avatar ?? msg.sender[0].toUpperCase()}
                </div>

                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: agent?.color ?? '#64748b' }}
                    >
                      {agent?.name ?? msg.sender}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div className="rounded-xl rounded-tl-sm bg-slate-50 border border-slate-100 px-3 py-2.5 group-hover:border-slate-200 transition-colors">
                    <p className="text-xs text-slate-700 leading-relaxed">{msg.content}</p>

                    {msg.subtask_id && (
                      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                        <Link2 className="size-2.5 text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.subtask_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* Footer count */}
      <p className="text-[11px] text-slate-400 text-right">
        {filtered.length} de {messages.length} mensagem{messages.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
