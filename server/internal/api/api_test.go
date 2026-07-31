package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pawly/internal/photos"
	"pawly/internal/store"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	st, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	srv := New(st, photos.New(t.TempDir()))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts
}

func getJSON(t *testing.T, url string) (int, map[string]any) {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("bad JSON %q: %v", body, err)
	}
	return res.StatusCode, out
}

func postJSON(t *testing.T, url string, payload string) (int, map[string]any) {
	t.Helper()
	res, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if len(body) > 0 {
		if err := json.Unmarshal(body, &out); err != nil {
			t.Fatalf("bad JSON %q: %v", body, err)
		}
	}
	return res.StatusCode, out
}

func TestHealthz(t *testing.T) {
	ts := newTestServer(t)
	code, _ := getJSON(t, ts.URL+"/healthz")
	if code != http.StatusOK {
		t.Fatalf("got %d, want 200", code)
	}
}

func TestPullEmpty(t *testing.T) {
	ts := newTestServer(t)
	code, out := getJSON(t, ts.URL+"/sync/pull")
	if code != http.StatusOK {
		t.Fatalf("got %d, want 200", code)
	}
	changes, ok := out["changes"].(map[string]any)
	if !ok {
		t.Fatalf("missing changes: %v", out)
	}
	for _, tbl := range []string{"cats", "moments", "photos", "reminders", "reminder_completions", "purchases"} {
		rows, ok := changes[tbl].([]any)
		if !ok || len(rows) != 0 {
			t.Fatalf("table %s: want empty array, got %v", tbl, changes[tbl])
		}
	}
	if _, ok := out["server_time"].(string); !ok {
		t.Fatalf("missing server_time: %v", out)
	}
}

func TestPushThenPullRoundtrip(t *testing.T) {
	ts := newTestServer(t)

	push := `{
		"changes": {
			"cats": [{"id":"cat-1","name":"Miko","sex":"male","status":"alive",
				"created_at":"2026-07-01T00:00:00Z","updated_at":"2026-07-01T00:00:00Z"}],
			"purchases": [{"id":"p-1","item":"Whiskas 1.2kg","price":65000,"category":"food",
				"date":"2026-07-28","note":"","created_at":"2026-07-28T00:00:00Z","updated_at":"2026-07-28T00:00:00Z"}]
		}
	}`
	code, out := postJSON(t, ts.URL+"/sync/push", push)
	if code != http.StatusOK {
		t.Fatalf("push got %d: %v", code, out)
	}
	if out["status"] != "ok" || out["applied"] != float64(2) {
		t.Fatalf("unexpected push response: %v", out)
	}

	code, out = getJSON(t, ts.URL+"/sync/pull?since=2026-01-01T00:00:00Z")
	if code != http.StatusOK {
		t.Fatalf("pull got %d", code)
	}
	changes := out["changes"].(map[string]any)
	cats := changes["cats"].([]any)
	if len(cats) != 1 {
		t.Fatalf("want 1 cat, got %v", cats)
	}
	cat := cats[0].(map[string]any)
	if cat["name"] != "Miko" || cat["id"] != "cat-1" {
		t.Fatalf("unexpected cat row: %v", cat)
	}
	purchases := changes["purchases"].([]any)
	if len(purchases) != 1 {
		t.Fatalf("want 1 purchase, got %v", purchases)
	}
	pur := purchases[0].(map[string]any)
	if pur["price"] != float64(65000) || pur["category"] != "food" {
		t.Fatalf("unexpected purchase row: %v", pur)
	}
}

func TestPushRejectsUnknownTable(t *testing.T) {
	ts := newTestServer(t)
	code, _ := postJSON(t, ts.URL+"/sync/push", `{"changes":{"nope":[{"id":"x","updated_at":"2026-01-01T00:00:00Z"}]}}`)
	if code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", code)
	}
}

func TestPullRejectsBadSince(t *testing.T) {
	ts := newTestServer(t)
	code, _ := getJSON(t, ts.URL+"/sync/pull?since=not-a-time")
	if code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", code)
	}
}

func TestPhotoPutGetRoundtrip(t *testing.T) {
	ts := newTestServer(t)

	// Register the photo row first (as the phone would after pushing it).
	push := `{
		"changes": {
			"moments": [{"id":"m-1","kind":"milestone","title":"First mouse",
				"occurred_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}],
			"photos": [{"id":"ph-1","moment_id":"m-1","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}

	// Upload the binary.
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ph-1", strings.NewReader("JPEGBYTES"))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "image/jpeg")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("put got %d, want 204", res.StatusCode)
	}

	// Download it back.
	res, err = http.Get(ts.URL + "/photos/ph-1")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get got %d, want 200", res.StatusCode)
	}
	if string(body) != "JPEGBYTES" {
		t.Fatalf("got %q, want JPEGBYTES", body)
	}
	if ct := res.Header.Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content type %q, want image/jpeg", ct)
	}
}

func TestPhotoPutUnknownID(t *testing.T) {
	ts := newTestServer(t)
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ghost", strings.NewReader("x"))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d, want 404", res.StatusCode)
	}
}

func TestPhotoGetMissingFile(t *testing.T) {
	ts := newTestServer(t)
	push := `{
		"changes": {
			"photos": [{"id":"ph-2","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}
	res, err := http.Get(ts.URL + "/photos/ph-2")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("got %d, want 404", res.StatusCode)
	}
}

func TestPhotoPutOversizeRejected(t *testing.T) {
	ts := newTestServer(t)
	push := `{
		"changes": {
			"photos": [{"id":"ph-3","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}

	big := strings.Repeat("A", maxPhotoBytes+1)
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ph-3", strings.NewReader(big))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d, want 413", res.StatusCode)
	}

	// The photo must NOT have been saved.
	res, err = http.Get(ts.URL + "/photos/ph-3")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("after rejection, get got %d, want 404", res.StatusCode)
	}
}

func TestPhotoPutEmptyBodyRejected(t *testing.T) {
	ts := newTestServer(t)
	push := `{
		"changes": {
			"photos": [{"id":"ph-4","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ph-4", nil)
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", res.StatusCode)
	}
}

func TestPhotoDefaultContentType(t *testing.T) {
	ts := newTestServer(t)
	push := `{
		"changes": {
			"photos": [{"id":"ph-5","taken_at":"2026-07-20T00:00:00Z",
				"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-20T00:00:00Z"}]
		}
	}`
	if code, _ := postJSON(t, ts.URL+"/sync/push", push); code != http.StatusOK {
		t.Fatalf("push got %d", code)
	}

	// No Content-Type header on PUT → stored default must be served back.
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/photos/ph-5", strings.NewReader("DATA"))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		t.Fatalf("put got %d, want 204", res.StatusCode)
	}

	res, err = http.Get(ts.URL + "/photos/ph-5")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if ct := res.Header.Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content type %q, want default image/jpeg", ct)
	}
}
