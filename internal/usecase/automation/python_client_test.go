package automation

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func newTestPythonClient(server *httptest.Server) *pythonClient {
	return &pythonClient{
		baseURL:    server.URL,
		httpClient: server.Client(),
		activeRuns: make(map[string]*pythonActiveRun),
	}
}

func TestPythonClientCancelTargetsActiveJob(t *testing.T) {
	const runKey = "collection\x00deploy.yml"
	statusStarted := make(chan struct{})
	var statusOnce sync.Once
	canceled := make(chan struct{})
	var cancelOnce sync.Once

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/jobs/run":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"job_id":"job-1","status":"starting"}`))
		case "/api/v1/jobs/job-1/cancel":
			cancelOnce.Do(func() { close(canceled) })
			w.WriteHeader(http.StatusAccepted)
		case "/api/v1/jobs/job-1":
			statusOnce.Do(func() { close(statusStarted) })
			status := "running"
			select {
			case <-canceled:
				status = "canceled"
			default:
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"job_id":"job-1","status":"` + status + `","stdout":"","stderr":"","duration_ms":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := newTestPythonClient(server)
	resultCh := make(chan struct {
		result pythonRunResult
		err    error
	})
	go func() {
		result, err := client.Run(context.Background(), runKey, pythonRunRequest{Playbook: "deploy.yml"})
		resultCh <- struct {
			result pythonRunResult
			err    error
		}{result, err}
	}()

	select {
	case <-statusStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the run to become active")
	}

	if err := client.Cancel(context.Background(), runKey); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	select {
	case outcome := <-resultCh:
		if outcome.err != nil {
			t.Fatalf("Run() error = %v", outcome.err)
		}
		if !outcome.result.Canceled {
			t.Fatal("Run() result was not marked canceled")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for canceled run")
	}
}

func TestPythonClientCancelBeforeJobID(t *testing.T) {
	const runKey = "collection\x00deploy.yml"
	allowResponse := make(chan struct{})
	cancelCalled := make(chan struct{})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/jobs/run":
			<-allowResponse
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"job_id":"job-2","status":"starting"}`))
		case "/api/v1/jobs/job-2/cancel":
			close(cancelCalled)
			w.WriteHeader(http.StatusAccepted)
		case "/api/v1/jobs/job-2":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"job_id":"job-2","status":"canceled","stdout":"","stderr":"","duration_ms":1}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := newTestPythonClient(server)
	resultCh := make(chan error)
	go func() {
		_, err := client.Run(context.Background(), runKey, pythonRunRequest{Playbook: "deploy.yml"})
		resultCh <- err
	}()

	// The active run is registered before the Python request, so cancellation can
	// be remembered safely while the Python service is still starting the job.
	deadline := time.Now().Add(2 * time.Second)
	for {
		client.mu.Lock()
		_, active := client.activeRuns[runKey]
		client.mu.Unlock()
		if active {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("timed out waiting for active run registration")
		}
		time.Sleep(time.Millisecond)
	}
	if err := client.Cancel(context.Background(), runKey); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	close(allowResponse)

	select {
	case <-cancelCalled:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for deferred cancellation")
	}
	select {
	case err := <-resultCh:
		if err != nil {
			t.Fatalf("Run() error = %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for run")
	}
}
