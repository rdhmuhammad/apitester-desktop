export interface AutomationFile {
  id: string
  name: string
  filename: string
  content: string
  size: number
  lastRunStatus: 'passed' | 'failed' | 'running' | 'check' | 'unrun'
  lastRunAt?: string
  lastRunSummary?: string
}

export interface AutomationRunConfig {
  inventoryPath: string
  limit: string
  tags: string
  extraVars: string
  checkMode: boolean
  diffMode: boolean
}

export interface AutomationRuntime {
	available: boolean
	name: string
	version?: string
	pythonVersion?: string
	binary?: string
	runtimePath?: string
	message: string
}

export interface AutomationRunResult {
	stdout: string
	stderr: string
	durationMs: number
}
