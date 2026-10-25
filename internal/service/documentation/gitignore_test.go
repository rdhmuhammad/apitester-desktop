package doc

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGitIgnoreMatcher(t *testing.T) {
	matcher := NewGitIgnoreMatcher()

	tmpDir := t.TempDir()
	rootGitIgnore := filepath.Join(tmpDir, ".gitignore")
	content := `
# Comment
node_modules
dist/
*.log
resource/db
/.idea/
*secret*.json
!important.log
`
	if err := os.WriteFile(rootGitIgnore, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write gitignore: %v", err)
	}

	if err := matcher.LoadGitIgnore(rootGitIgnore, ""); err != nil {
		t.Fatalf("LoadGitIgnore failed: %v", err)
	}

	tests := []struct {
		path     string
		isDir    bool
		expected bool
	}{
		{".git", true, true},
		{".git/config", false, true},
		{"node_modules", true, true},
		{"frontend/node_modules", true, true},
		{"frontend/node_modules/package.json", false, true},
		{"dist", true, true},
		{"dist/app.js", false, true},
		{"dist", false, false}, // dist/ is dir-only
		{"app.log", false, true},
		{"important.log", false, false}, // negated rule
		{"resource/db", true, true},
		{"resource/db/data.db", false, true},
		{".idea", true, true},
		{".idea/workspace.xml", false, true},
		{"my-secret-key.json", false, true},
		{"main.go", false, false},
		{"cmd/api/main.go", false, false},
		{"README.md", false, false},
		{"resource/document/wiki/index.md", false, false},
	}

	for _, tc := range tests {
		got := matcher.IsIgnored(tc.path, tc.isDir)
		if got != tc.expected {
			t.Errorf("IsIgnored(%q, isDir=%v) = %v, expected %v", tc.path, tc.isDir, got, tc.expected)
		}
	}
}

func TestGitIgnoreNested(t *testing.T) {
	matcher := NewGitIgnoreMatcher()
	tmpDir := t.TempDir()

	subDir := filepath.Join(tmpDir, "frontend")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("failed to mkdir: %v", err)
	}

	nestedGitIgnore := filepath.Join(subDir, ".gitignore")
	content := `
build
dist-ssr
`
	if err := os.WriteFile(nestedGitIgnore, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write nested gitignore: %v", err)
	}

	if err := matcher.LoadGitIgnore(nestedGitIgnore, "frontend"); err != nil {
		t.Fatalf("LoadGitIgnore failed: %v", err)
	}

	if !matcher.IsIgnored("frontend/build", true) {
		t.Errorf("expected frontend/build to be ignored")
	}
	if !matcher.IsIgnored("frontend/dist-ssr/index.js", false) {
		t.Errorf("expected frontend/dist-ssr/index.js to be ignored")
	}
	if matcher.IsIgnored("backend/build", true) {
		t.Errorf("backend/build should not be ignored by frontend/.gitignore")
	}
}
