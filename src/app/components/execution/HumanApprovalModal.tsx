import React, { useState } from 'react'
import {
  ShieldCheck,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  Bot,
  FileText,
  MessageSquare,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import type { HumanApprovalRequest, Agent } from '../../types/workforce'

interface HumanApprovalModalProps {
  open: boolean
  requests: HumanApprovalRequest[]
  agents: Agent[]
  onApprove: (requestId: string, comment?: string) => void
  onReject: (requestId: string, reason: string) => void
  onClose: () => void
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HumanApprovalModal({
  open,
  requests,
  agents,
  onApprove,
  onReject,
  onClose,
}: HumanApprovalModalProps) {
  const pending = requests.filter((r) => r.status === 'pending')
  const [index, setIndex] = useState(0)
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')

  const current = pending[index] ?? null

  function handleApprove() {
    if (!current) return
    onApprove(current.id, comment.trim() || undefined)
    setComment('')
    setRejectMode(false)
    if (index >= pending.length - 1) {
      onClose()
    }
  }

  function handleReject() {
    if (!current || !reason.trim()) return
    onReject(current.id, reason.trim())
    setReason('')
    setRejectMode(false)
    if (index >= pending.length - 1) {
      onClose()
    }
  }

  function handleNavigate(dir: -1 | 1) {
    setIndex((i) => Math.max(0, Math.min(pending.length - 1, i + dir)))
    setRejectMode(false)
    setReason('')
    setComment('')
  }

  const agent = current ? agents.find((a) => a.id === current.agent_id) : null

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center">
                <ShieldCheck className="size-4 text-amber-600" />
              </div>
              <DialogTitle className="text-sm font-semibold text-slate-900">
                Aprovação Humana
              </DialogTitle>
            </div>
            {pending.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleNavigate(-1)}
                  disabled={index === 0}
                  className="size-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="text-xs text-slate-500 min-w-[3rem] text-center">
                  {index + 1} / {pending.length}
                </span>
                <button
                  onClick={() => handleNavigate(1)}
                  disabled={index === pending.length - 1}
                  className="size-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 pt-4 pb-5 space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            <MetaPill icon={<FileText className="size-3" />} label={current.subtask_id} mono />
            <MetaPill icon={<Wrench className="size-3" />} label={current.tool_name} mono />
            {agent && (
              <MetaPill
                icon={
                  <span
                    className="size-3 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ fontSize: '6px', backgroundColor: agent.color }}
                  >
                    {agent.avatar}
                  </span>
                }
                label={agent.name}
                color={agent.color}
              />
            )}
            <MetaPill
              icon={<Clock className="size-3" />}
              label={formatTime(current.requested_at)}
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Subtarefa
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {current.subtask_description}
            </p>
          </div>

          {/* Output */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Output do Agente
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 max-h-36 overflow-y-auto">
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {current.output}
              </p>
            </div>
          </div>

          {/* Approve comment (only when not in reject mode) */}
          {!rejectMode && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                <MessageSquare className="size-3" />
                Comentário (opcional)
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Observação sobre a aprovação…"
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder-slate-400 text-slate-700"
              />
            </div>
          )}

          {/* Reject reason */}
          {rejectMode && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400 mb-1.5 flex items-center gap-1">
                <MessageSquare className="size-3" />
                Motivo da Rejeição
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o problema ou o que precisa ser corrigido…"
                rows={3}
                autoFocus
                className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 placeholder-slate-400 text-slate-700"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {!rejectMode ? (
              <>
                <Button
                  onClick={handleApprove}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9"
                >
                  <UserCheck className="size-3.5" />
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectMode(true)}
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1.5 h-9"
                >
                  <UserX className="size-3.5" />
                  Rejeitar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleReject}
                  disabled={!reason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5 h-9 disabled:opacity-50"
                >
                  <UserX className="size-3.5" />
                  Confirmar Rejeição
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setRejectMode(false); setReason('') }}
                  className="gap-1.5 h-9"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>

          {/* Already reviewed summary */}
          {requests.filter((r) => r.status !== 'pending').length > 0 && (
            <div className="pt-1 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1.5 font-medium uppercase tracking-wide">
                Já revisados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requests
                  .filter((r) => r.status !== 'pending')
                  .map((r) => (
                    <span
                      key={r.id}
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-mono rounded-full px-2 py-0.5 border',
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      )}
                    >
                      {r.status === 'approved' ? (
                        <UserCheck className="size-2.5" />
                      ) : (
                        <UserX className="size-2.5" />
                      )}
                      {r.subtask_id}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetaPill({
  icon,
  label,
  mono,
  color,
}: {
  icon: React.ReactNode
  label: string
  mono?: boolean
  color?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200',
        mono ? 'font-mono' : ''
      )}
      style={color ? { borderColor: `${color}40`, backgroundColor: `${color}10` } : {}}
    >
      <span className="text-slate-500" style={color ? { color } : {}}>
        {icon}
      </span>
      <span
        className="text-[10px] text-slate-600"
        style={color ? { color } : {}}
      >
        {label}
      </span>
    </div>
  )
}
