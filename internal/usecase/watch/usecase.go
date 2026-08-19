package watch

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/ansible"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/watcher"
)

var baseURLRegex = regexp.MustCompile(`(?i)(base.*url|url.*base)`)

type Usecase struct {
	watcher        *watcher.FileWatcher
	errHandler     localerror.HandleError
	collectionRepo bbolt.RepositoryInterface[domain.Collection]
	ansibleRunner  *ansible.Runner
}

func NewUsecase(lg logger.Logger, collectionRepo bbolt.RepositoryInterface[domain.Collection]) *Usecase {
	fw := watcher.New(lg)
	ansibleRunner := ansible.NewRunnerFromEnvironment()

	if selected := findSelectedCollection(collectionRepo); selected != nil {
		fw.Watch(selected.Path)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		watcher:        fw,
		collectionRepo: collectionRepo,
		ansibleRunner:  ansibleRunner,
	}
}

func findSelectedCollection(repo bbolt.RepositoryInterface[domain.Collection]) *domain.Collection {
	all, err := repo.List(context.Background())
	if err != nil {
		return nil
	}
	for i := range all {
		if all[i].IsSelected {
			return &all[i]
		}
	}
	return nil
}

func (u *Usecase) ListCollections() ([]domain.Collection, error) {
	return u.collectionRepo.List(context.Background())
}

func (u *Usecase) Read(id string) (ReadResponse, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return ReadResponse{}, localerror.InvalidData("Collection not found")
	}

	fileBytes, err := os.ReadFile(collection.Path)
	if err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}

	for i := range docsContent.Variable {
		if isBaseURLVar(docsContent.Variable[i].Key) && docsContent.Variable[i].ID == "" {
			docsContent.Variable[i].Category = "BASE_URL"
		}
	}

	docsContent.Item = setId(docsContent.Item)
	return ReadResponse{
		Content:   docsContent,
		Changed:   false,
		UpdatedAt: collection.UpdatedAt,
	}, nil
}

func (u *Usecase) CreateCollection(req CreateCollectionRequest) (domain.Collection, error) {
	now := time.Now()
	collection := domain.Collection{
		ID:         uuid.NewString(),
		Name:       req.Name,
		Path:       req.Path,
		IsSelected: false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := u.collectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	return collection, nil
}

func (u *Usecase) UpdateCollectionByID(id string, req UpdateCollectionRequest) (domain.Collection, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return domain.Collection{}, localerror.InvalidData("Collection not found")
	}
	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Path != "" {
		collection.Path = req.Path
	}
	collection.UpdatedAt = time.Now()
	if err := u.collectionRepo.Update(context.Background(), id, collection); err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	return *collection, nil
}

func (u *Usecase) DeleteCollection(id string) error {
	return u.collectionRepo.Delete(context.Background(), id)
}

func (u *Usecase) SelectCollection(id string) (domain.Collection, error) {
	all, err := u.collectionRepo.List(context.Background())
	if err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}

	var selected *domain.Collection
	for _, c := range all {
		c.IsSelected = false
		if c.ID == id {
			c.IsSelected = true
			selected = &c
		}
		if err := u.collectionRepo.Update(context.Background(), c.ID, &c); err != nil {
			return domain.Collection{}, u.errHandler.ErrorReturn(err)
		}
	}

	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("Collection not found")
	}

	u.watcher.Watch(selected.Path)

	return *selected, nil
}

func (u *Usecase) GetActiveCollection() (domain.Collection, error) {
	selected := findSelectedCollection(u.collectionRepo)
	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("No active collection")
	}
	return *selected, nil
}

func (u *Usecase) WriteCollection(id string, content string) error {
	if content == "" {
		return localerror.InvalidData("Collection content is required")
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	if err := os.WriteFile(collection.Path, []byte(content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	info, err := os.Stat(collection.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	if u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(content, info.ModTime())
	}

	if info.ModTime().IsZero() && u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(content, time.Now())
	}

	return nil
}

func testsDir(collectionPath string) string {
	return filepath.Join(filepath.Dir(collectionPath), "tests")
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

func validateTestName(name string) error {
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return localerror.InvalidData("Invalid test name")
	}
	return nil
}

func (u *Usecase) ListTests(id string) ([]TestFileInfo, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}

	testsDir := testsDir(collection.Path)
	entries, err := os.ReadDir(testsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []TestFileInfo{}, nil
		}
		return nil, u.errHandler.ErrorReturn(err)
	}

	var result []TestFileInfo
	parser := newHttpParser()
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".http") {
			continue
		}
		base := strings.TrimSuffix(name, ".http")

		totalSteps := 0
		filePath := filepath.Join(testsDir, name)
		if content, err := os.ReadFile(filePath); err == nil {
			steps := parser.parse(string(content))
			totalSteps = len(steps)
		}

		result = append(result, TestFileInfo{
			Name:       base,
			Filename:   name,
			TotalSteps: totalSteps,
		})
	}
	if result == nil {
		result = []TestFileInfo{}
	}
	return result, nil
}

func (u *Usecase) ReadTest(id, name string) (TestFileContent, error) {
	if err := validateTestName(name); err != nil {
		return TestFileContent{}, err
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return TestFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return TestFileContent{}, localerror.InvalidData("Collection not found")
	}

	path := filepath.Join(testsDir(collection.Path), name+".http")
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return TestFileContent{}, localerror.InvalidData("Test file not found")
		}
		return TestFileContent{}, u.errHandler.ErrorReturn(err)
	}

	parser := newHttpParser()
	steps := parser.parse(string(content))

	return TestFileContent{
		Name:  name,
		Steps: steps,
	}, nil
}

func (u *Usecase) WriteTest(id, name string, payload TestFileContent) error {
	if err := validateTestName(name); err != nil {
		return err
	}
	if len(payload.Steps) == 0 {
		return localerror.InvalidData("Test steps are required")
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	testsDir := testsDir(collection.Path)
	if err := os.MkdirAll(testsDir, 0755); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	content := newHttpParser().serialize(payload.Steps)

	path := filepath.Join(testsDir, name+".http")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}

func (u *Usecase) DeleteTest(id, name string) error {
	if err := validateTestName(name); err != nil {
		return err
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	path := filepath.Join(testsDir(collection.Path), name+".http")
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return u.errHandler.ErrorReturn(err)
	}

	return nil
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

	runRequest := ansible.RunRequest{
		Playbook:   playbookPath,
		WorkingDir: automationDir(collection.Path),
		Inventory:  inventoryPath,
		Limit:      req.Limit,
		Tags:       req.Tags,
		ExtraVars:  extraVars,
		Check:      req.CheckMode,
		Diff:       req.DiffMode,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	result, err := u.ansibleRunner.Run(ctx, runRequest)
	if err != nil {
		return AutomationRunResult{}, u.errHandler.ErrorReturn(err)
	}

	return AutomationRunResult{
		Stdout:     result.Stdout,
		Stderr:     result.Stderr,
		DurationMs: result.Duration.Milliseconds(),
	}, nil
}

func (u *Usecase) AutomationRuntime() AutomationRuntimeInfo {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	runtime := u.ansibleRunner.Runtime(ctx)
	return AutomationRuntimeInfo{
		Available:     runtime.Available,
		Name:          runtime.Name,
		Version:       runtime.Version,
		PythonVersion: runtime.PythonVersion,
		Binary:        runtime.Binary,
		RuntimePath:   runtime.RuntimePath,
		Message:       runtime.Message,
	}
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

func automationFilePath(collectionPath, name string) string {
	return filepath.Join(automationDir(collectionPath), name)
}

func (u *Usecase) UploadCollection(fileBytes []byte) error {
	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")

	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return localerror.InvalidData("Invalid collection.json file")
	}

	if docsContent.Info.Name == "" {
		return localerror.InvalidData("Collection info name is required")
	}

	if len(docsContent.Item) == 0 {
		return localerror.InvalidData("Collection item is required")
	}

	return u.saveToFile([]byte(content))
}

func (u *Usecase) saveToFile(content []byte) error {
	selected := findSelectedCollection(u.collectionRepo)
	if selected == nil {
		return localerror.InvalidData("No active collection selected")
	}

	if err := os.WriteFile(selected.Path, content, 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	info, err := os.Stat(selected.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	if u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(string(content), info.ModTime())
	}

	if info.ModTime().IsZero() && u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(string(content), time.Now())
	}

	return nil
}

func setId(item []CollectionItem) []CollectionItem {
	for i, _ := range item {
		item[i].ID = uuid.NewString()

		if item[i].Request != nil {
			for j := range item[i].Request.Header {
				item[i].Request.Header[j].Id = uuid.NewString()
			}
			for j := range item[i].Request.URL.Query {
				item[i].Request.URL.Query[j].Id = uuid.NewString()
			}
			if item[i].Request.Body != nil {
				for j := range item[i].Request.Body.FormData {
					item[i].Request.Body.FormData[j].Id = uuid.NewString()
				}
			}
		}

		if item[i].Item != nil {
			item[i].Item = setId(item[i].Item)
		}
	}

	return item
}

func isBaseURLVar(s string) bool {
	return baseURLRegex.MatchString(s)
}
