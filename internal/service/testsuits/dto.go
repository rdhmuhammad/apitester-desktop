package testsuits

type TestFileInfo struct {
	Name       string `json:"name"`
	Filename   string `json:"filename"`
	TotalSteps int    `json:"totalSteps"`
}

type TestFileContent struct {
	Name  string     `json:"name"`
	Steps []TestStep `json:"steps"`
}

type TestStep struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	Method     string          `json:"method"`
	URL        string          `json:"url"`
	Headers    []TestHeader    `json:"headers"`
	Body       string          `json:"body,omitempty"`
	Assertions []AssertionRule `json:"assertions"`
	Captures   []CaptureRule   `json:"captures"`
}

type TestHeader struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type AssertionRule struct {
	ID         string `json:"id"`
	Expression string `json:"expression"`
}

type CaptureRule struct {
	ID         string `json:"id"`
	VarName    string `json:"varName"`
	Expression string `json:"expression"`
}
