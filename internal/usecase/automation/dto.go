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
