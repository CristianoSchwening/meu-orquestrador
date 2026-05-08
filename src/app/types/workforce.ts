export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
export type ExecutionMode = 'subagent' | 'team'
export type ExecutionPattern =
  | 'sequential'
  | 'parallel'
  | 'review_critic'
  | 'iterative_refinement'
  | 'human_in_the_loop'

export interface Tool {
  name: string
  description: string
  category: string
  params: { name: string; type: string; required: boolean }[]
}

export interface Agent {
  id: string
  name: string
  description: string
  tags: string[]
  toolkit: string[]
  max_concurrent: number | null
  color: string
  avatar: string
}

export interface Subtask {
  id: string
  description: string
  tool_name: string
  params: Record<string, any>
  depends_on: string[]
  blocked_reason: string | null
  status: TaskStatus
  output: any | null
  error: string | null
  claimed_by: string | null
  claimed_at: string | null
  metadata: Record<string, any>
  attempt: number
  parent_subtask_id: string | null
  quality_score: number | null
  critic_feedback: string | null
  started_at: string | null
  completed_at: string | null
}

export interface ExecutionBudget {
  max_iterations: number | null
  max_model_calls: number | null
  max_elapsed_ms: number | null
  quality_threshold: number | null
}

export interface DecisionMetadata {
  recommended_agents: number
  estimated_overhead: number
  independent_subtasks: number
  dependency_depth: number
  resource_conflict_score: number
  parallelism_worth_it: boolean
}

export interface ExecutionMetrics {
  total_elapsed_ms: number
  model_calls: number
  iterations: number
  critic_rejections: number
  subtask_latencies: Record<string, number>
}

export interface ExecutionEvent {
  id: string
  type: string
  timestamp: string
  subtask_id?: string
  agent?: string
  reason?: string
  from_agent?: string
  to_agent?: string
  attempt?: number
  iteration?: number
  iterations?: number
  mode?: string
  pattern?: string
  status?: string
  [key: string]: any
}

export interface WorkforceExecution {
  task_id: string
  task_name: string
  objective: string
  subtasks: Subtask[]
  mode: ExecutionMode
  pattern: ExecutionPattern
  agent_ids: string[]
  events: ExecutionEvent[]
  team_messages?: TeamMessage[]
  decision_metadata: DecisionMetadata
  metrics: ExecutionMetrics
  created_at: string
  updated_at: string
}

export interface WorkforceConfig {
  id: string
  name: string
  objective?: string
  agent_ids: string[]
  execution_mode: ExecutionMode
  execution_pattern: ExecutionPattern
  budget: ExecutionBudget
  has_critic: boolean
  has_human_gate: boolean
  has_dynamic_router: boolean
  created_at: string
}

export interface TeamMessage {
  id: string
  sender: string
  content: string
  subtask_id: string | null
  timestamp: string
}

export interface PlaygroundSubtask {
  id: string
  description: string
  tool_name: string
  agent_id: string
  status: TaskStatus
  depends_on: string[]
  output?: string
  quality_score?: number
  started_at?: number
  completed_at?: number
}

export interface PlaygroundScenario {
  id: string
  name: string
  objective: string
  agent_ids: string[]
  subtasks: Omit<PlaygroundSubtask, 'status'>[]
  delays: number[]
}
