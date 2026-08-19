package watch

import (
	"path/filepath"
	"testing"
)

func TestValidateInventoryName(t *testing.T) {
	tests := []struct {
		name    string
		invalid bool
	}{
		{name: "staging.ini"},
		{name: "hosts.yaml"},
		{name: "", invalid: true},
		{name: "../hosts.ini", invalid: true},
		{name: `nested\\hosts.ini`, invalid: true},
		{name: ".", invalid: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateInventoryName(tt.name)
			if (err != nil) != tt.invalid {
				t.Fatalf("validateInventoryName(%q) error = %v, invalid = %v", tt.name, err, tt.invalid)
			}
		})
	}
}

func TestAutomationConfigPersistence(t *testing.T) {
	collectionPath := filepath.Join(t.TempDir(), "collection.json")
	usecase := &Usecase{}
	want := map[string]AutomationConfig{
		"deploy.yml": {
			InventoryFiles: []string{"staging.ini"},
			InventoryFile:  "staging.ini",
			CheckMode:      true,
		},
	}

	if err := usecase.writeAutomationConfigs(collectionPath, want); err != nil {
		t.Fatalf("writeAutomationConfigs() error = %v", err)
	}
	want["deploy.yml"] = AutomationConfig{InventoryFile: "production.ini", InventoryFiles: []string{"production.ini"}}
	if err := usecase.writeAutomationConfigs(collectionPath, want); err != nil {
		t.Fatalf("writeAutomationConfigs() overwrite error = %v", err)
	}
	got, err := usecase.readAutomationConfigs(collectionPath)
	if err != nil {
		t.Fatalf("readAutomationConfigs() error = %v", err)
	}
	if got["deploy.yml"].InventoryFile != want["deploy.yml"].InventoryFile {
		t.Fatalf("InventoryFile = %q, want %q", got["deploy.yml"].InventoryFile, want["deploy.yml"].InventoryFile)
	}
	if got["deploy.yml"].InventoryFiles[0] != want["deploy.yml"].InventoryFiles[0] {
		t.Fatalf("InventoryFiles = %v, want %v", got["deploy.yml"].InventoryFiles, want["deploy.yml"].InventoryFiles)
	}
}

func TestStarterInventoryContent(t *testing.T) {
	if got := starterInventoryContent("hosts.ini"); got != "[all]\n# Add hosts for this inventory\n" {
		t.Fatalf("INI starter content = %q", got)
	}
	if got := starterInventoryContent("hosts.yaml"); got != "all:\n  hosts: {}\n" {
		t.Fatalf("YAML starter content = %q", got)
	}
}
