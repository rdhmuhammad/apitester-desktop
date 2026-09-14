package restrequest

import "testing"

func TestRequestUpdateNameContract(t *testing.T) {
	if got := RequestUpdateName.Name(); got != "request:update:name" {
		t.Fatalf("RequestUpdateName.Name() = %q, want %q", got, "request:update:name")
	}

	payload := RequestUpdateNamePayload{}
	payload.From(map[string]any{
		"collectionId": "collection-id",
		"requestId":    "request-id",
		"baseVersion":  "version",
		"name":         "New name",
	})
	if payload.CollectionID != "collection-id" || payload.RequestID != "request-id" {
		t.Fatalf("decoded identity = %#v", payload.RequestIdentity)
	}
	if payload.Name != "New name" {
		t.Fatalf("decoded update = %#v", payload.UpdateNameRequest)
	}
}

func TestRequestSaveResponseContract(t *testing.T) {
	if got := RequestSaveResponse.Name(); got != "request:save:response" {
		t.Fatalf("RequestSaveResponse.Name() = %q, want %q", got, "request:save:response")
	}

	payload := RequestSaveResponsePayload{}
	payload.From(map[string]any{
		"collectionId": "collection-id",
		"requestId":    "request-id",
		"name":         "200 OK",
		"status":       "OK",
		"code":         200,
		"body":         `{"status":"success"}`,
	})
	if payload.CollectionID != "collection-id" || payload.RequestID != "request-id" {
		t.Fatalf("decoded identity = %#v", payload.RequestIdentity)
	}
	if payload.Name != "200 OK" || payload.Code != 200 {
		t.Fatalf("decoded save response = %#v", payload.SaveResponseRequest)
	}

	// Test nested response format
	payloadNested := RequestSaveResponsePayload{}
	payloadNested.From(map[string]any{
		"collectionId": "collection-id",
		"requestId":    "request-id",
		"response": map[string]any{
			"name":   "201 Created",
			"status": "Created",
			"code":   201,
			"body":   `{"id": 1}`,
		},
	})
	if payloadNested.Response == nil || payloadNested.Response.Code != 201 {
		t.Fatalf("decoded nested save response = %#v", payloadNested.SaveResponseRequest)
	}
}

func TestRequestSaveScriptContract(t *testing.T) {
	if got := RequestSaveScript.Name(); got != "request:save:script" {
		t.Fatalf("RequestSaveScript.Name() = %q, want %q", got, "request:save:script")
	}

	payload := RequestSaveScriptPayload{}
	payload.From(map[string]any{
		"collectionId": "collection-id",
		"requestId":    "request-id",
		"exec":         []string{"console.log('test')"},
		"type":         "text/javascript",
	})
	if payload.CollectionID != "collection-id" || payload.RequestID != "request-id" {
		t.Fatalf("decoded identity = %#v", payload.RequestIdentity)
	}
	if len(payload.Exec) != 1 || payload.Exec[0] != "console.log('test')" {
		t.Fatalf("decoded exec = %#v", payload.Exec)
	}
	if payload.Type != "text/javascript" {
		t.Fatalf("decoded type = %q, want text/javascript", payload.Type)
	}
}
