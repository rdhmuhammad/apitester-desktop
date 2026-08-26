package automation

import (
	"context"
	"encoding/json"
	"github.com/rdhmuhammad/apitester/pkg/socketio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

type Usecase struct {
	errHandler     localerror.HandleError
	collectionRepo bbolt.RepositoryInterface[domain.Collection]
	pythonClient   *pythonClient
	socket         *socketio.NS
}

func NewUsecase(lg logger.Logger, socket *socketio.IO, collectionRepo bbolt.RepositoryInterface[domain.Collection]) *Usecase {
	ns := socket.NewSpace("tracking", nil)
	ns.Build()
	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		collectionRepo: collectionRepo,
		socket:         ns,
		pythonClient:   newPythonClient(),
	}
}

func automationDir(collectionPath string) string {
	return filepath.Join(filepath.Dir(collectionPath), "automation")
}

func automationInventoryDir(collectionPath string) string {
	return filepath.Join(automationDir(collectionPath), "inventory")
}

func automationInventoryFilePath(collectionPath, name string) string {
	return filepath.Join(automationInventoryDir(collectionPath), name)
}

func automationConfigPath(collectionPath string) string {
	return filepath.Join(automationDir(collectionPath), ".config.json")
}

func automationRunKey(collectionID, name string) string {
	return collectionID + "\x00" + name
}

func automationFilePath(collectionPath, name string) string {
	return filepath.Join(automationDir(collectionPath), name)
}

func (u *Usecase) ListAutomation(id string) ([]AutomationFileInfo, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}

	entries, err := os.ReadDir(automationDir(collection.Path))
	if err != nil {
		if os.IsNotExist(err) {
			return []AutomationFileInfo{}, nil
		}
		return nil, u.errHandler.ErrorReturn(err)
	}

	result := make([]AutomationFileInfo, 0)
	for _, entry := range entries {
		if entry.IsDir() || (!strings.HasSuffix(entry.Name(), ".yml") && !strings.HasSuffix(entry.Name(), ".yaml")) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		result = append(result, AutomationFileInfo{
			Name:     strings.TrimSuffix(strings.TrimSuffix(entry.Name(), ".yaml"), ".yml"),
			Filename: entry.Name(),
			Size:     info.Size(),
		})
	}
	return result, nil
}

func (u *Usecase) ReadAutomation(id, name string) (AutomationFileContent, error) {
	if err := validateAutomationName(name); err != nil {
		return AutomationFileContent{}, err
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return AutomationFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return AutomationFileContent{}, localerror.InvalidData("Collection not found")
	}

	path := automationFilePath(collection.Path, name)
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return AutomationFileContent{}, localerror.InvalidData("Automation file not found")
		}
		return AutomationFileContent{}, u.errHandler.ErrorReturn(err)
	}
	return AutomationFileContent{Name: name, Content: string(content)}, nil
}

func (u *Usecase) WriteAutomation(id, name string, payload AutomationFileContent) error {
	if err := validateAutomationName(name); err != nil {
		return err
	}
	if strings.TrimSpace(payload.Content) == "" {
		return localerror.InvalidData("Automation content is required")
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}
	root := automationDir(collection.Path)
	if err := os.MkdirAll(root, 0755); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if err := os.WriteFile(automationFilePath(collection.Path, name), []byte(payload.Content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	return nil
}

func (u *Usecase) DeleteAutomation(id, name string) error {
	if err := validateAutomationName(name); err != nil {
		return err
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}
	if err := os.Remove(automationFilePath(collection.Path, name)); err != nil && !os.IsNotExist(err) {
		return u.errHandler.ErrorReturn(err)
	}
	configs, err := u.readAutomationConfigs(collection.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if _, exists := configs[name]; exists {
		delete(configs, name)
		if err := u.writeAutomationConfigs(collection.Path, configs); err != nil {
			return u.errHandler.ErrorReturn(err)
		}
	}
	return nil
}

func (u *Usecase) ListAutomationInventories(id string) ([]AutomationInventoryFileInfo, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}

	entries, err := os.ReadDir(automationInventoryDir(collection.Path))
	if err != nil {
		if os.IsNotExist(err) {
			return []AutomationInventoryFileInfo{}, nil
		}
		return nil, u.errHandler.ErrorReturn(err)
	}

	result := make([]AutomationInventoryFileInfo, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil || validateInventoryName(entry.Name()) != nil {
			continue
		}
		result = append(result, AutomationInventoryFileInfo{
			Name:     strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())),
			Filename: entry.Name(),
			Size:     info.Size(),
		})
	}
	return result, nil
}

func (u *Usecase) CreateAutomationInventory(id string, req AutomationInventoryCreateRequest) (AutomationInventoryFileContent, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return AutomationInventoryFileContent{}, localerror.InvalidData("Collection not found")
	}

	filename := strings.TrimSpace(req.Filename)
	if filename == "" {
		entries, readErr := os.ReadDir(automationInventoryDir(collection.Path))
		if readErr != nil && !os.IsNotExist(readErr) {
			return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(readErr)
		}
		for index := 1; ; index++ {
			candidate := "inventory-" + strconv.Itoa(index) + ".ini"
			if !containsInventory(entries, candidate) {
				filename = candidate
				break
			}
		}
	}
	if err := validateInventoryName(filename); err != nil {
		return AutomationInventoryFileContent{}, err
	}

	path := automationInventoryFilePath(collection.Path, filename)
	if _, statErr := os.Stat(path); statErr == nil {
		return AutomationInventoryFileContent{}, localerror.InvalidData("Automation inventory file already exists")
	} else if !os.IsNotExist(statErr) {
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(statErr)
	}

	if req.AutomationFilename != "" {
		if err := validateAutomationName(req.AutomationFilename); err != nil {
			return AutomationInventoryFileContent{}, err
		}
		if _, statErr := os.Stat(automationFilePath(collection.Path, req.AutomationFilename)); statErr != nil {
			if os.IsNotExist(statErr) {
				return AutomationInventoryFileContent{}, localerror.InvalidData("Automation file not found")
			}
			return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(statErr)
		}
	}

	content := starterInventoryContent(filename)
	if err := os.MkdirAll(automationInventoryDir(collection.Path), 0755); err != nil {
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(err)
	}

	if req.AutomationFilename != "" {
		configs, readErr := u.readAutomationConfigs(collection.Path)
		if readErr != nil {
			return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(readErr)
		}
		config := configs[req.AutomationFilename]
		if config.ExtraVars == "" {
			config.ExtraVars = "{}"
		}
		if !config.CheckMode && config.InventoryFiles == nil {
			config.CheckMode = true
		}
		if !containsInventoryFilename(config.InventoryFiles, filename) {
			config.InventoryFiles = append(config.InventoryFiles, filename)
		}
		if config.InventoryFile == "" {
			config.InventoryFile = filename
		}
		configs[req.AutomationFilename] = config
		if writeErr := u.writeAutomationConfigs(collection.Path, configs); writeErr != nil {
			_ = os.Remove(path)
			return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(writeErr)
		}
	}

	return AutomationInventoryFileContent{Name: filename, Content: content}, nil
}

func containsInventory(entries []os.DirEntry, filename string) bool {
	for _, entry := range entries {
		if entry.Name() == filename && !entry.IsDir() {
			return true
		}
	}
	return false
}

func containsInventoryFilename(filenames []string, filename string) bool {
	for _, candidate := range filenames {
		if candidate == filename {
			return true
		}
	}
	return false
}

func starterInventoryContent(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".yaml", ".yml":
		return "all:\n  hosts: {}\n"
	default:
		return "[all]\n# Add hosts for this inventory\n"
	}
}

func (u *Usecase) ReadAutomationInventory(id, name string) (AutomationInventoryFileContent, error) {
	if err := validateInventoryName(name); err != nil {
		return AutomationInventoryFileContent{}, err
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return AutomationInventoryFileContent{}, localerror.InvalidData("Collection not found")
	}

	content, err := os.ReadFile(automationInventoryFilePath(collection.Path, name))
	if err != nil {
		if os.IsNotExist(err) {
			return AutomationInventoryFileContent{}, localerror.InvalidData("Automation inventory not found")
		}
		return AutomationInventoryFileContent{}, u.errHandler.ErrorReturn(err)
	}
	return AutomationInventoryFileContent{Name: name, Content: string(content)}, nil
}

func (u *Usecase) WriteAutomationInventory(id, name string, payload AutomationInventoryFileContent) error {
	if err := validateInventoryName(name); err != nil {
		return err
	}
	if strings.TrimSpace(payload.Content) == "" {
		return localerror.InvalidData("Automation inventory content is required")
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}
	root := automationInventoryDir(collection.Path)
	if err := os.MkdirAll(root, 0755); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if err := os.WriteFile(automationInventoryFilePath(collection.Path, name), []byte(payload.Content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	return nil
}

func (u *Usecase) DeleteAutomationInventory(id, name string) error {
	if err := validateInventoryName(name); err != nil {
		return err
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}
	if err := os.Remove(automationInventoryFilePath(collection.Path, name)); err != nil && !os.IsNotExist(err) {
		return u.errHandler.ErrorReturn(err)
	}

	configs, err := u.readAutomationConfigs(collection.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	changed := false
	for key, config := range configs {
		filtered := config.InventoryFiles[:0]
		for _, filename := range config.InventoryFiles {
			if filename == name {
				changed = true
				continue
			}
			filtered = append(filtered, filename)
		}
		config.InventoryFiles = filtered
		if config.InventoryFile == name {
			config.InventoryFile = ""
			changed = true
		}
		configs[key] = config
	}
	if changed {
		if err := u.writeAutomationConfigs(collection.Path, configs); err != nil {
			return u.errHandler.ErrorReturn(err)
		}
	}
	return nil
}

func (u *Usecase) ListAutomationConfigs(id string) (map[string]AutomationConfig, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}
	configs, err := u.readAutomationConfigs(collection.Path)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	inventories, err := u.ListAutomationInventories(id)
	if err != nil {
		return nil, err
	}
	validInventories := make(map[string]struct{}, len(inventories))
	for _, inventory := range inventories {
		validInventories[inventory.Filename] = struct{}{}
	}
	for name, config := range configs {
		filtered := config.InventoryFiles[:0]
		for _, filename := range config.InventoryFiles {
			if _, ok := validInventories[filename]; ok {
				filtered = append(filtered, filename)
			}
		}
		config.InventoryFiles = filtered
		if _, ok := validInventories[config.InventoryFile]; !ok {
			config.InventoryFile = ""
		}
		configs[name] = config
	}
	return configs, nil
}

func (u *Usecase) WriteAutomationConfig(id, name string, config AutomationConfig) error {
	if err := validateAutomationName(name); err != nil {
		return err
	}
	for _, filename := range config.InventoryFiles {
		if err := validateInventoryName(filename); err != nil {
			return err
		}
	}
	if config.InventoryFile != "" {
		if err := validateInventoryName(config.InventoryFile); err != nil {
			return err
		}
		found := false
		for _, filename := range config.InventoryFiles {
			if filename == config.InventoryFile {
				found = true
				break
			}
		}
		if !found {
			return localerror.InvalidData("Selected inventory must be attached to the automation")
		}
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}
	for _, filename := range config.InventoryFiles {
		if _, err := os.Stat(automationInventoryFilePath(collection.Path, filename)); err != nil {
			if os.IsNotExist(err) {
				return localerror.InvalidData("Automation inventory not found")
			}
			return u.errHandler.ErrorReturn(err)
		}
	}
	if _, err := os.Stat(automationFilePath(collection.Path, name)); err != nil {
		if os.IsNotExist(err) {
			return localerror.InvalidData("Automation file not found")
		}
		return u.errHandler.ErrorReturn(err)
	}
	configs, err := u.readAutomationConfigs(collection.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	configs[name] = config
	if err := u.writeAutomationConfigs(collection.Path, configs); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	return nil
}

func (u *Usecase) readAutomationConfigs(collectionPath string) (map[string]AutomationConfig, error) {
	content, err := os.ReadFile(automationConfigPath(collectionPath))
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]AutomationConfig{}, nil
		}
		return nil, err
	}
	configs := map[string]AutomationConfig{}
	if err := json.Unmarshal(content, &configs); err != nil {
		return nil, err
	}
	if configs == nil {
		configs = map[string]AutomationConfig{}
	}
	return configs, nil
}

func (u *Usecase) writeAutomationConfigs(collectionPath string, configs map[string]AutomationConfig) error {
	root := automationDir(collectionPath)
	if err := os.MkdirAll(root, 0755); err != nil {
		return err
	}
	content, err := json.MarshalIndent(configs, "", "  ")
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(root, ".config-*.tmp")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	destination := automationConfigPath(collectionPath)
	if err := os.Remove(destination); err != nil && !os.IsNotExist(err) {
		return err
	}
	return os.Rename(temporaryName, destination)
}

func (u *Usecase) RunAutomation(id, name string, req AutomationRunRequest) (AutomationRunResult, error) {
	if err := validateAutomationName(name); err != nil {
		return AutomationRunResult{}, err
	}
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return AutomationRunResult{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return AutomationRunResult{}, localerror.InvalidData("Collection not found")
	}

	playbookPath := automationFilePath(collection.Path, name)
	if _, err := os.Stat(playbookPath); err != nil {
		if os.IsNotExist(err) {
			return AutomationRunResult{}, localerror.InvalidData("Automation file not found")
		}
		return AutomationRunResult{}, u.errHandler.ErrorReturn(err)
	}

	var extraVars map[string]interface{}
	if extra := strings.TrimSpace(req.ExtraVars); extra != "" {
		if err := json.Unmarshal([]byte(extra), &extraVars); err != nil {
			return AutomationRunResult{}, localerror.InvalidData("extraVars must be a valid JSON object")
		}
	}

	inventoryPath := ""
	if req.InventoryFile != "" {
		if err := validateInventoryName(req.InventoryFile); err != nil {
			return AutomationRunResult{}, err
		}
		inventoryPath = automationInventoryFilePath(collection.Path, req.InventoryFile)
		if _, err := os.Stat(inventoryPath); err != nil {
			if os.IsNotExist(err) {
				return AutomationRunResult{}, localerror.InvalidData("Automation inventory not found")
			}
			return AutomationRunResult{}, u.errHandler.ErrorReturn(err)
		}
	}

	runRequest := pythonRunRequest{
		Playbook:  playbookPath,
		Inventory: inventoryPath,
		ExtraVars: extraVars,
		Limit:     req.Limit,
		Tags:      req.Tags,
		CheckMode: req.CheckMode,
		DiffMode:  req.DiffMode,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	result, err := u.pythonClient.Run(ctx, automationRunKey(id, name), runRequest)
	if err != nil {
		return AutomationRunResult{}, u.errHandler.ErrorReturn(err)
	}

	return AutomationRunResult{
		Stdout:     result.Stdout,
		Stderr:     result.Stderr,
		DurationMs: result.DurationMs,
		Canceled:   result.Canceled,
	}, nil
}

func (u *Usecase) CancelAutomation(id, name string) error {
	if err := validateAutomationName(name); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := u.pythonClient.Cancel(ctx, automationRunKey(id, name)); err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	return nil
}

func (u *Usecase) AutomationRuntime() AutomationRuntimeInfo {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	runtime, err := u.pythonClient.Runtime(ctx)
	if err != nil {
		return AutomationRuntimeInfo{
			Available: false,
			Name:      "Managed Ansible runner",
			Message:   err.Error(),
		}
	}

	info := AutomationRuntimeInfo{
		Available:     runtime.Available,
		Name:          runtime.Name,
		Version:       runtime.Version,
		PythonVersion: runtime.PythonVersion,
		Binary:        runtime.Binary,
		Message:       runtime.Message,
	}
	if info.Name == "" {
		info.Name = "Managed Ansible runner"
	}
	return info
}

func validateAutomationName(name string) error {
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return localerror.InvalidData("Invalid automation file name")
	}
	if !strings.HasSuffix(name, ".yml") && !strings.HasSuffix(name, ".yaml") {
		return localerror.InvalidData("Automation files must use .yml or .yaml")
	}
	return nil
}

func validateInventoryName(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return localerror.InvalidData("Invalid automation inventory file name")
	}
	return nil
}
