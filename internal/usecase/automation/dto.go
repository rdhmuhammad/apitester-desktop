package automation

type AutomationFileInfo struct {
	Name     string `json:"name"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

type AutomationFileContent struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type AutomationInventoryFileInfo struct {
	Name     string `json:"name"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

type AutomationInventoryFileContent struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type AutomationInventoryCreateRequest struct {
	Filename           string `json:"filename"`
	AutomationFilename string `json:"automationFilename"`
}

type AutomationConfig struct {
	InventoryFiles []string `json:"inventoryFiles"`
	InventoryFile  string   `json:"inventoryFile"`
	Limit          string   `json:"limit"`
	Tags           string   `json:"tags"`
	ExtraVars      string   `json:"extraVars"`
	CheckMode      bool     `json:"checkMode"`
	DiffMode       bool     `json:"diffMode"`
}

type AutomationRuntimeInfo struct {
	Available     bool   `json:"available"`
	Name          string `json:"name"`
	Version       string `json:"version,omitempty"`
	PythonVersion string `json:"pythonVersion,omitempty"`
	Binary        string `json:"binary,omitempty"`
	RuntimePath   string `json:"runtimePath,omitempty"`
	Message       string `json:"message"`
}

type AutomationRunRequest struct {
	InventoryFile string `json:"inventoryFile"`
	Limit         string `json:"limit"`
	Tags          string `json:"tags"`
	ExtraVars     string `json:"extraVars"`
	CheckMode     bool   `json:"checkMode"`
	DiffMode      bool   `json:"diffMode"`
}

type AutomationRunResult struct {
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	DurationMs int64  `json:"durationMs"`
	Canceled   bool   `json:"canceled"`
}
