import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  LayoutDashboard,
  Zap,
  ListChecks,
  Settings2,
  Users,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Bot,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '../ui/utils'
import { Button } from '../ui/button'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/', label: 'Playground', icon: Zap, end: true },
  { to: '/executions', label: 'Execuções', icon: ListChecks },
  { to: '/workforce', label: 'Workforce Builder', icon: Settings2 },
  { to: '/agents', label: 'Agentes', icon: Users },
  { to: '/toolkit', label: 'Toolkit', icon: Wrench },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300',
          collapsed ? 'w-16' : 'w-56',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-2 px-4 py-4 border-b border-slate-200', collapsed && 'justify-center px-2')}>
          <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-white shrink-0">
            <Bot className="size-4" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">Workforce</p>
              <p className="text-[10px] text-slate-400 leading-tight">Multi-Agent OS</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-slate-200 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-slate-500 hover:text-slate-900"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            {!collapsed && <span className="text-xs ml-1">Recolher</span>}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-600">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-slate-900 text-white">
              <Bot className="size-3" />
            </div>
            <span className="text-sm font-semibold text-slate-900">Workforce</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  onNavigate,
}: {
  to: string
  label: string
  icon: React.ElementType
  end?: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          collapsed && 'justify-center px-2'
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}