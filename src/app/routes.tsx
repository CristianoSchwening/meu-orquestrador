import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import PlaygroundPage from './pages/PlaygroundPage'
import ExecutionsPage from './pages/ExecutionsPage'
import ExecutionDetailPage from './pages/ExecutionDetailPage'
import WorkforceBuilderPage from './pages/WorkforceBuilderPage'
import AgentsPage from './pages/AgentsPage'
import ToolkitPage from './pages/ToolkitPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: PlaygroundPage },
      { path: 'dashboard', Component: DashboardPage },
      { path: 'playground', Component: PlaygroundPage },
      { path: 'executions', Component: ExecutionsPage },
      { path: 'executions/:id', Component: ExecutionDetailPage },
      { path: 'workforce', Component: WorkforceBuilderPage },
      { path: 'agents', Component: AgentsPage },
      { path: 'toolkit', Component: ToolkitPage },
    ],
  },
])