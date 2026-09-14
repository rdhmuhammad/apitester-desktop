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
