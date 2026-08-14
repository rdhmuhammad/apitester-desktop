package ansible

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/apenella/go-ansible/v2/pkg/playbook"
)

const (
	defaultBinary = playbook.DefaultAnsiblePlaybookBinary
	runtimeName   = "Managed Ansible runner"
)

var versionPattern = regexp.MustCompile(`(?i)\[core\s+([^\]\s]+)\]`)

type RuntimeInfo struct {
	Available     bool
	Name          string
	Version       string
	PythonVersion string
	Binary        string
	RuntimePath   string
	Message       string
}

type RunRequest struct {
	Playbook   string
	WorkingDir string
	Inventory  string
	Limit      string
	Tags       string
	ExtraVars  map[string]interface{}
	Check      bool
	Diff       bool
}

type RunResult struct {
	Stdout   string
	Stderr   string
	Duration time.Duration
}

type Runner struct {
	binary     string
	runtimeDir string
}

func NewRunner(binary string) *Runner {
	runner := &Runner{binary: strings.TrimSpace(binary)}
	if runner.binary == "" {
		if bundledBinary, runtimeDir, ok := findBundledRuntime(); ok {
			runner.binary = bundledBinary
			runner.runtimeDir = runtimeDir
		} else {
			runner.binary = defaultBinary
		}
	} else {
		runner.runtimeDir = runtimeDirFromBinary(runner.binary)
	}
	return runner
}

func NewRunnerFromEnvironment() *Runner {
	return NewRunner(os.Getenv("ANSIBLE_PLAYBOOK_BINARY"))
}

func (r *Runner) Runtime(ctx context.Context) RuntimeInfo {
	info := RuntimeInfo{
		Name:        runtimeName,
		Binary:      r.binary,
		RuntimePath: r.runtimeDir,
	}
	if ctx == nil {
		ctx = context.Background()
	}

	binary, err := r.resolveBinary()
	if err != nil {
		info.Message = fmt.Sprintf("%s was not found: %v", r.binary, err)
		return info
	}
	info.Binary = binary

	output, err := runWithPipeStdin(ctx, append(os.Environ(), mapToEnvSlice(r.environment())...), binary, "--version")
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		info.Message = fmt.Sprintf("could not run %s: %s", r.binary, message)
		return info
	}

	info.Available = true
	info.Version = parseVersion(string(output))
	info.PythonVersion = r.pythonVersion(ctx)
	info.Message = fmt.Sprintf("%s is available", r.binary)
	return info
}

func (r *Runner) Run(ctx context.Context, request RunRequest) (RunResult, error) {
	if strings.TrimSpace(request.Playbook) == "" {
		return RunResult{}, fmt.Errorf("playbook path is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	binary, err := r.resolveBinary()
	if err != nil {
		return RunResult{}, err
	}
	extraVarsFile, err := writeExtraVars(request.ExtraVars)
	if err != nil {
		return RunResult{}, err
	}
	if extraVarsFile != "" {
		defer os.Remove(extraVarsFile)
	}

	options := &playbook.AnsiblePlaybookOptions{
		Check:     request.Check,
		Diff:      request.Diff,
		Inventory: request.Inventory,
		Limit:     request.Limit,
		Tags:      request.Tags,
	}
	if extraVarsFile != "" {
		options.ExtraVarsFile = []string{"@" + extraVarsFile}
	}
	command := playbook.NewAnsiblePlaybookCmd(
		playbook.WithBinary(binary),
		playbook.WithPlaybooks(request.Playbook),
		playbook.WithPlaybookOptions(options),
	)
	commandArgs, err := command.Command()
	if err != nil {
		return RunResult{}, err
	}

	var stdout, stderr bytes.Buffer
	startedAt := time.Now()
	envVars := r.environment()
	cmd := osexec.CommandContext(ctx, commandArgs[0], commandArgs[1:]...)
	cmd.Dir = request.WorkingDir
	cmd.Env = append(os.Environ(), mapToEnvSlice(envVars)...)
	cmd.Stdin = strings.NewReader("")
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()
	result := RunResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		Duration: time.Since(startedAt),
	}
	if err != nil {
		if detail := strings.TrimSpace(stderr.String()); detail != "" {
			return result, fmt.Errorf("%s: %w", detail, err)
		}
		return result, err
	}
	return result, nil
}

func (r *Runner) resolveBinary() (string, error) {
	if strings.ContainsAny(r.binary, `/\`) || filepath.IsAbs(r.binary) {
		if _, err := os.Stat(r.binary); err != nil {
			return "", err
		}
		return filepath.Clean(r.binary), nil
	}

	return osexec.LookPath(r.binary)
}

func (r *Runner) environment() map[string]string {
	envVars := make(map[string]string)
	if r.runtimeDir == "" {
		return envVars
	}

	envVars["PYTHONUTF8"] = "1"

	collectionsDir := filepath.Join(r.runtimeDir, "collections")
	if info, err := os.Stat(collectionsDir); err == nil && info.IsDir() {
		envVars["ANSIBLE_COLLECTIONS_PATH"] = collectionsDir
	}

	ansibleHome := filepath.Join(userConfigDir(), "ansible")
	if err := os.MkdirAll(ansibleHome, 0755); err == nil {
		envVars["ANSIBLE_HOME"] = ansibleHome
	}
	return envVars
}

func writeExtraVars(extraVars map[string]interface{}) (string, error) {
	if len(extraVars) == 0 {
		return "", nil
	}

	ansibleHome := filepath.Join(userConfigDir(), "ansible")
	if err := os.MkdirAll(ansibleHome, 0755); err != nil {
		return "", fmt.Errorf("create Ansible runtime data directory: %w", err)
	}

	file, err := os.CreateTemp(ansibleHome, "extra-vars-*.json")
	if err != nil {
		return "", fmt.Errorf("create temporary extra-vars file: %w", err)
	}
	path := file.Name()
	defer func() {
		if err != nil {
			_ = os.Remove(path)
		}
	}()

	encoder := json.NewEncoder(file)
	if err = encoder.Encode(extraVars); err != nil {
		_ = file.Close()
		return "", fmt.Errorf("encode extra vars: %w", err)
	}
	if err = file.Close(); err != nil {
		return "", fmt.Errorf("close temporary extra-vars file: %w", err)
	}
	return path, nil
}

func (r *Runner) pythonVersion(ctx context.Context) string {
	python := filepath.Join(r.runtimeDir, "python", "python.exe")
	if _, err := os.Stat(python); err != nil {
		python = filepath.Join(r.runtimeDir, "python", "bin", "python")
	}
	if _, err := os.Stat(python); err != nil {
		return ""
	}

	output, err := osexec.CommandContext(ctx, python, "--version").CombinedOutput()
	if err != nil {
		return ""
	}
	return firstLine(string(output))
}

func findBundledRuntime() (string, string, bool) {
	executable, err := osexec.LookPath(os.Args[0])
	if err != nil {
		executable, err = os.Executable()
	}
	if err != nil {
		return "", "", false
	}

	appDir := filepath.Dir(executable)
	runtimeDir := filepath.Join(appDir, "runtime", "ansible")
	for _, candidate := range []string{
		filepath.Join(runtimeDir, "python", "Scripts", "ansible-playbook.exe"),
		filepath.Join(runtimeDir, "python", "Scripts", "ansible-playbook"),
		filepath.Join(runtimeDir, "bin", "ansible-playbook"),
	} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, runtimeDir, true
		}
	}
	return "", "", false
}

func runtimeDirFromBinary(binary string) string {
	dir := filepath.Dir(binary)
	for range 5 {
		if _, err := os.Stat(filepath.Join(dir, "manifest.json")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	return ""
}

func mapToEnvSlice(envVars map[string]string) []string {
	env := os.Environ()
	for key, value := range envVars {
		env = append(env, key+"="+value)
	}
	return env
}

func runWithPipeStdin(ctx context.Context, env []string, name string, args ...string) ([]byte, error) {
	cmd := osexec.CommandContext(ctx, name, args...)
	cmd.Stdin = strings.NewReader("")
	cmd.Env = env
	return cmd.CombinedOutput()
}

func userConfigDir() string {
	if dir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(dir, "apitester")
	}
	return filepath.Join(os.TempDir(), "apitester")
}

func parseVersion(output string) string {
	match := versionPattern.FindStringSubmatch(output)
	if len(match) > 1 {
		return match[1]
	}
	return firstLine(output)
}

func firstLine(output string) string {
	for _, line := range strings.Split(output, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}
