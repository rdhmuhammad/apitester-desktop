package automation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	defaultPythonServiceURL = "http://localhost:5000"
	runPollInterval         = time.Second
)

type pythonRuntimeInfo struct {
	Available     bool   `json:"available"`
	Name          string `json:"name"`
	Version       string `json:"version"`
	PythonVersion string `json:"python_version"`
	Binary        string `json:"binary"`
	Message       string `json:"message"`
}

type pythonRunRequest struct {
	Playbook  string                 `json:"playbook"`
	Inventory string                 `json:"inventory,omitempty"`
	ExtraVars map[string]interface{} `json:"extra_vars,omitempty"`
	Limit     string                 `json:"limit,omitempty"`
	Tags      string                 `json:"tags,omitempty"`
	CheckMode bool                   `json:"check_mode"`
	DiffMode  bool                   `json:"diff_mode"`
}

type pythonRunResult struct {
	Stdout     string
	Stderr     string
	DurationMs int64
	Canceled   bool
}

type pythonJobResponse struct {
	JobID  string `json:"job_id"`
	Status string `json:"status"`
}

type pythonJobStatus struct {
	JobID      string `json:"job_id"`
	Status     string `json:"status"`
	RC         *int   `json:"rc"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	DurationMs int64  `json:"duration_ms"`
}

type pythonErrorResponse struct {
	Error  string `json:"error"`
	Detail string `json:"detail"`
}

type pythonClient struct {
	baseURL    string
	httpClient *http.Client
	mu         sync.Mutex
	activeRuns map[string]*pythonActiveRun
}

type pythonActiveRun struct {
	jobID           string
	cancelRequested bool
}

func newPythonClient() *pythonClient {
	baseURL := strings.TrimRight(os.Getenv("PYTHON_SERVICE_URL"), "/")
	if baseURL == "" {
		baseURL = defaultPythonServiceURL
	}
	return &pythonClient{
		baseURL:    baseURL,
		httpClient: &http.Client{},
		activeRuns: make(map[string]*pythonActiveRun),
	}
}

func (c *pythonClient) Runtime(ctx context.Context) (pythonRuntimeInfo, error) {
	var info pythonRuntimeInfo
	body, statusCode, err := c.do(ctx, http.MethodGet, "/api/v1/runtime", nil)
	if err != nil {
		return info, err
	}
	if statusCode != http.StatusOK {
		return info, c.errorFrom(statusCode, body)
	}
	if err := json.Unmarshal(body, &info); err != nil {
		return info, fmt.Errorf("decode runtime response: %w", err)
	}
	return info, nil
}

func (c *pythonClient) Run(ctx context.Context, runKey string, request pythonRunRequest) (pythonRunResult, error) {
	var result pythonRunResult
	activeRun := &pythonActiveRun{}
	c.mu.Lock()
	if _, exists := c.activeRuns[runKey]; exists {
		c.mu.Unlock()
		return result, fmt.Errorf("playbook is already running")
	}
	c.activeRuns[runKey] = activeRun
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		if c.activeRuns[runKey] == activeRun {
			delete(c.activeRuns, runKey)
		}
		c.mu.Unlock()
	}()

	payload, err := json.Marshal(request)
	if err != nil {
		return result, err
	}
	body, statusCode, err := c.do(ctx, http.MethodPost, "/api/v1/jobs/run", payload)
	if err != nil {
		return result, err
	}
	if statusCode != http.StatusAccepted {
		return result, c.errorFrom(statusCode, body)
	}

	var job pythonJobResponse
	if err := json.Unmarshal(body, &job); err != nil {
		return result, fmt.Errorf("decode job response: %w", err)
	}
	if job.JobID == "" {
		return result, fmt.Errorf("python service returned no job id")
	}

	c.mu.Lock()
	activeRun.jobID = job.JobID
	cancelRequested := activeRun.cancelRequested
	c.mu.Unlock()
	if cancelRequested {
		if err := c.cancelJob(ctx, job.JobID); err != nil {
			return result, err
		}
	}

	return c.pollJob(ctx, job.JobID)
}

func (c *pythonClient) Cancel(ctx context.Context, runKey string) error {
	c.mu.Lock()
	activeRun := c.activeRuns[runKey]
	if activeRun == nil {
		c.mu.Unlock()
		return nil
	}
	if activeRun.jobID == "" {
		activeRun.cancelRequested = true
		c.mu.Unlock()
		return nil
	}
	jobID := activeRun.jobID
	c.mu.Unlock()

	return c.cancelJob(ctx, jobID)
}

func (c *pythonClient) cancelJob(ctx context.Context, jobID string) error {
	body, statusCode, err := c.do(ctx, http.MethodPost, "/api/v1/jobs/"+jobID+"/cancel", nil)
	if err != nil {
		return err
	}
	if statusCode != http.StatusAccepted {
		return c.errorFrom(statusCode, body)
	}
	return nil
}

func (c *pythonClient) pollJob(ctx context.Context, jobID string) (pythonRunResult, error) {
	ticker := time.NewTicker(runPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return pythonRunResult{}, ctx.Err()
		case <-ticker.C:
			status, err := c.jobStatus(ctx, jobID)
			if err != nil {
				return pythonRunResult{}, err
			}
			if status.Status == "running" {
				continue
			}
			result := pythonRunResult{
				Stdout:     status.Stdout,
				Stderr:     status.Stderr,
				DurationMs: status.DurationMs,
			}
			if status.Status == "canceled" {
				result.Canceled = true
				return result, nil
			}
			if status.Status == "failed" {
				return result, fmt.Errorf("%s", failureDetail(status))
			}
			return result, nil
		}
	}
}

func failureDetail(status pythonJobStatus) string {
	if detail := strings.TrimSpace(status.Stderr); detail != "" {
		return detail
	}
	if detail := strings.TrimSpace(status.Stdout); detail != "" {
		return detail
	}
	return "playbook run failed"
}

func (c *pythonClient) jobStatus(ctx context.Context, jobID string) (pythonJobStatus, error) {
	var status pythonJobStatus
	body, statusCode, err := c.do(ctx, http.MethodGet, "/api/v1/jobs/"+jobID, nil)
	if err != nil {
		return status, err
	}
	if statusCode != http.StatusOK {
		return status, c.errorFrom(statusCode, body)
	}
	if err := json.Unmarshal(body, &status); err != nil {
		return status, fmt.Errorf("decode job status response: %w", err)
	}
	return status, nil
}

func (c *pythonClient) do(ctx context.Context, method, path string, payload []byte) ([]byte, int, error) {
	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, 0, err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("python service unavailable: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return body, resp.StatusCode, nil
}

func (c *pythonClient) errorFrom(statusCode int, body []byte) error {
	var pyErr pythonErrorResponse
	if err := json.Unmarshal(body, &pyErr); err == nil && strings.TrimSpace(pyErr.Detail) != "" {
		return fmt.Errorf("%s", pyErr.Detail)
	}
	return fmt.Errorf("python service returned status %d", statusCode)
}
