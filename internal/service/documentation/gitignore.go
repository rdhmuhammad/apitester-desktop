package doc

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type gitIgnoreRule struct {
	regex     *regexp.Regexp
	negate    bool
	isDirOnly bool
}

type GitIgnoreMatcher struct {
	rules []gitIgnoreRule
}

func NewGitIgnoreMatcher() *GitIgnoreMatcher {
	return &GitIgnoreMatcher{
		rules: make([]gitIgnoreRule, 0),
	}
}

// LoadGitIgnore reads a .gitignore file at filePath, with rules scoped to baseRelDir (relative to workspace root).
func (m *GitIgnoreMatcher) LoadGitIgnore(filePath, baseRelDir string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r\n")
		m.addRule(line, baseRelDir)
	}
	return scanner.Err()
}

func (m *GitIgnoreMatcher) addRule(line, baseRelDir string) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return
	}

	negate := false
	if strings.HasPrefix(line, "!") {
		negate = true
		line = strings.TrimPrefix(line, "!")
	}

	isDirOnly := false
	if strings.HasSuffix(line, "/") {
		isDirOnly = true
		line = strings.TrimSuffix(line, "/")
	}

	line = filepath.ToSlash(line)
	baseRelDir = filepath.ToSlash(strings.Trim(baseRelDir, "/\\"))

	// Check if rule is anchored or relative to baseRelDir
	hasSlash := strings.Contains(line, "/")
	line = strings.TrimPrefix(line, "/")

	var pattern string
	if hasSlash || baseRelDir != "" {
		// Scoped to directory
		prefix := ""
		if baseRelDir != "" {
			prefix = regexp.QuoteMeta(baseRelDir) + "/"
		}
		pattern = "^" + prefix + globToRegex(line) + "(?:/.*)?$"
	} else {
		// Basename match across all depths
		pattern = "(?:^|/)" + globToRegex(line) + "(?:/.*)?$"
	}

	re, err := regexp.Compile(pattern)
	if err != nil {
		return
	}

	m.rules = append(m.rules, gitIgnoreRule{
		regex:     re,
		negate:    negate,
		isDirOnly: isDirOnly,
	})
}

func globToRegex(glob string) string {
	var sb strings.Builder
	runes := []rune(glob)
	i := 0
	n := len(runes)

	for i < n {
		ch := runes[i]
		if ch == '*' {
			if i+1 < n && runes[i+1] == '*' {
				// **
				i += 2
				if i < n && runes[i] == '/' {
					i++
					sb.WriteString("(?:.*/)?")
				} else {
					sb.WriteString(".*")
				}
				continue
			}
			sb.WriteString("[^/]*")
			i++
			continue
		}
		if ch == '?' {
			sb.WriteString("[^/]")
			i++
			continue
		}
		// Escape regex special chars
		if strings.ContainsRune(`.+()[]{}^$|\`, ch) {
			sb.WriteRune('\\')
		}
		sb.WriteRune(ch)
		i++
	}
	return sb.String()
}

// IsIgnored tests if a path (relative to workspace root) should be ignored.
func (m *GitIgnoreMatcher) IsIgnored(relPath string, isDir bool) bool {
	clean := filepath.ToSlash(strings.Trim(relPath, "/\\"))
	if clean == "" || clean == "." {
		return false
	}

	// Always ignore .git directory
	parts := strings.Split(clean, "/")
	for _, p := range parts {
		if p == ".git" {
			return true
		}
	}

	// Check if any ancestor directory is ignored
	for i := 1; i < len(parts); i++ {
		ancestor := strings.Join(parts[:i], "/")
		if m.matchSinglePath(ancestor, true) {
			return true
		}
	}

	return m.matchSinglePath(clean, isDir)
}

func (m *GitIgnoreMatcher) matchSinglePath(path string, isDir bool) bool {
	ignored := false
	for _, rule := range m.rules {
		if rule.isDirOnly && !isDir {
			continue
		}
		if rule.regex.MatchString(path) {
			ignored = !rule.negate
		}
	}
	return ignored
}
