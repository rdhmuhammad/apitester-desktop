export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'rollback-failed'

export type AutomationEventStream = 'stdout' | 'stderr' | 'system'

export interface AutomationRunRequest {
  filename: string
  inventoryFile?: string
  targets?: string[]
  runtimeOverrides?: Record<string, string>
}

export interface AutomationStopRequest {
  runId: string
}

export interface AutomationRunResponse {
  runId: string
  automationId: string
  filename: string
  inventoryFile?: string
  status: AutomationRunStatus
  startedAt: string
}

export interface AutomationRunSummary {
  runId: string
  automationId: string
  filename: string
  inventoryFile?: string
  status: AutomationRunStatus
  startedAt: string
  finishedAt?: string
  durationMs?: number
  jobCount: number
  hostCount: number
  taskCount: number
  errorSummary?: string
  rollbackSummary?: string
}

export interface AutomationRunListResponse {
  items: AutomationRunSummary[]
  page: number
  pageSize: number
  total: number
}

export interface AutomationRunDetailResponse {
  summary: AutomationRunSummary
  events: AutomationRunEvent[]
}

export interface AutomationRunEvent {
  eventId: string
  runId: string
  automationId: string
  filename: string
  timestamp: string
  sequence: number
  jobId?: string
  jobName?: string
  group?: string
  host?: string
  taskId?: string
  taskName?: string
  taskType?: string
  rollback?: boolean
  stream?: AutomationEventStream
  message?: string
  status?: AutomationRunStatus
  finishedAt?: string
}

export interface AutomationRunSnapshot {
  summary: AutomationRunSummary
  activeStepId?: string
  events: AutomationRunEvent[]
  latestSequence: number
}
