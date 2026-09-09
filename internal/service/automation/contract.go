package automation

// Task types supported by Automation Runner Contract v1.
const (
	TaskTypeSSH          = "ssh"
	TaskTypeCLIExecute   = "cli-execute"
	TaskTypeFileTransfer = "file-transfer"
	TaskTypeRESTAPI      = "rest-api"
	TaskTypeLog          = "log"
)

const (
	EventRunStarted       = "automation:run-started"
	EventStepStarted      = "automation:step-started"
	EventLog              = "automation:log"
	EventStepFinished     = "automation:step-finished"
	EventRollbackStarted  = "automation:rollback-started"
	EventRollbackFinished = "automation:rollback-finished"
	EventRunFinished      = "automation:run-finished"
	EventRunError         = "automation:run-error"
	EventRunCanceled      = "automation:run-canceled"
)

type AutomationJob struct {
	Name      string            `yaml:"name" json:"name"`
	Hosts     []string          `yaml:"hosts" json:"hosts"`
	Variables map[string]string `yaml:"variables,omitempty" json:"variables,omitempty"`
	Tasks     []AutomationTask  `yaml:"tasks" json:"tasks"`
}

type AutomationTask struct {
	Name     string            `yaml:"name" json:"name"`
	Type     string            `yaml:"type" json:"type"`
	Script   string            `yaml:"script,omitempty" json:"script,omitempty"`
	Src      string            `yaml:"src,omitempty" json:"src,omitempty"`
	Dest     string            `yaml:"dest,omitempty" json:"dest,omitempty"`
	Method   string            `yaml:"method,omitempty" json:"method,omitempty"`
	URL      string            `yaml:"url,omitempty" json:"url,omitempty"`
	Headers  map[string]string `yaml:"headers,omitempty" json:"headers,omitempty"`
	Body     any               `yaml:"body,omitempty" json:"body,omitempty"`
	Timeout  string            `yaml:"timeout,omitempty" json:"timeout,omitempty"`
	Message  string            `yaml:"message,omitempty" json:"message,omitempty"`
	Rollback []AutomationTask  `yaml:"rollback,omitempty" json:"rollback,omitempty"`
}

type AutomationRunRequest struct {
	Filename         string            `json:"filename"`
	InventoryFile    string            `json:"inventoryFile,omitempty"`
	Targets          []string          `json:"targets,omitempty"`
	RuntimeOverrides map[string]string `json:"runtimeOverrides,omitempty"`
}

type AutomationStopRequest struct {
	RunID string `json:"runId"`
}

type AutomationRunStatus string

const (
	RunStatusQueued         AutomationRunStatus = "queued"
	RunStatusRunning        AutomationRunStatus = "running"
	RunStatusStopping       AutomationRunStatus = "stopping"
	RunStatusPassed         AutomationRunStatus = "passed"
	RunStatusFailed         AutomationRunStatus = "failed"
	RunStatusCanceled       AutomationRunStatus = "canceled"
	RunStatusRollbackFailed AutomationRunStatus = "rollback-failed"
)

type AutomationRunResponse struct {
	RunID         string              `json:"runId"`
	AutomationID  string              `json:"automationId"`
	Filename      string              `json:"filename"`
	InventoryFile string              `json:"inventoryFile,omitempty"`
	Status        AutomationRunStatus `json:"status"`
	StartedAt     string              `json:"startedAt"`
}

type AutomationRunSummary struct {
	RunID           string              `json:"runId"`
	AutomationID    string              `json:"automationId"`
	Filename        string              `json:"filename"`
	InventoryFile   string              `json:"inventoryFile,omitempty"`
	Status          AutomationRunStatus `json:"status"`
	StartedAt       string              `json:"startedAt"`
	FinishedAt      string              `json:"finishedAt,omitempty"`
	DurationMs      int64               `json:"durationMs,omitempty"`
	JobCount        int                 `json:"jobCount"`
	HostCount       int                 `json:"hostCount"`
	TaskCount       int                 `json:"taskCount"`
	ErrorSummary    string              `json:"errorSummary,omitempty"`
	RollbackSummary string              `json:"rollbackSummary,omitempty"`
}

type AutomationRunListResponse struct {
	Items    []AutomationRunSummary `json:"items"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
	Total    int                    `json:"total"`
}

type AutomationRunDetailResponse struct {
	Summary AutomationRunSummary `json:"summary"`
	Events  []AutomationRunEvent `json:"events"`
}

type AutomationEventStream string

const (
	EventStreamStdout AutomationEventStream = "stdout"
	EventStreamStderr AutomationEventStream = "stderr"
	EventStreamSystem AutomationEventStream = "system"
)

type AutomationRunEvent struct {
	EventID      string                `json:"eventId"`
	RunID        string                `json:"runId"`
	AutomationID string                `json:"automationId"`
	Filename     string                `json:"filename"`
	Timestamp    string                `json:"timestamp"`
	Sequence     uint64                `json:"sequence"`
	JobID        string                `json:"jobId,omitempty"`
	JobName      string                `json:"jobName,omitempty"`
	Group        string                `json:"group,omitempty"`
	Host         string                `json:"host,omitempty"`
	TaskID       string                `json:"taskId,omitempty"`
	TaskName     string                `json:"taskName,omitempty"`
	TaskType     string                `json:"taskType,omitempty"`
	Rollback     bool                  `json:"rollback,omitempty"`
	Stream       AutomationEventStream `json:"stream,omitempty"`
	Message      string                `json:"message,omitempty"`
	Status       AutomationRunStatus   `json:"status,omitempty"`
	FinishedAt   string                `json:"finishedAt,omitempty"`
}

type AutomationRunSnapshot struct {
	Summary        AutomationRunSummary `json:"summary"`
	ActiveStepID   string               `json:"activeStepId,omitempty"`
	Events         []AutomationRunEvent `json:"events"`
	LatestSequence uint64               `json:"latestSequence"`
}
