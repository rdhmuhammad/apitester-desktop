export interface AutomationFile {
  id: string
  name: string
  filename: string
  content: string
  size: number
  lastRunStatus: 'passed' | 'failed' | 'canceled' | 'running' | 'check' | 'unrun'
  lastRunAt?: string
  lastRunSummary?: string
}

export interface AutomationInventoryFile {
  id: string
  name: string
  filename: string
  content: string
  size: number
}

export interface AutomationRunConfig {
  inventoryFiles: string[]
  inventoryFile: string
  limit: string
  tags: string
  extraVars: string
  checkMode: boolean
  diffMode: boolean
}
