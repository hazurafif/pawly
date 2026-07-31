package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pawly/internal/photos"
	"pawly/internal/store"
)

// Simulates two phones syncing through the server, converging on the same data.
func TestTwoDevicesConverge(t *testing.T) {
	st, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(New(st, photos.New(t.TempDir())).Handler())
	defer ts.Close()

	// Each phone keeps a local store (its working copy). Like a real phone,
	// it runs its local migrations before first use.
	phoneA, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer phoneA.Close()
	if err := phoneA.Migrate(); err != nil {
		t.Fatal(err)
	}
	phoneB, err := store.OpenMemory()
	if err != nil {
		t.Fatal(err)
	}
	defer phoneB.Close()
	if err := phoneB.Migrate(); err != nil {
		t.Fatal(err)
	}

	// Phone A: offline edits — a cat and a milestone moment.
	phoneAEdits := map[string][]map[string]any{
		"cats": {{
			"id": "cat-1", "name": "Miko", "sex": "male", "status": "alive",
			"created_at": "2030-07-01T00:00:00.000Z", "updated_at": "2030-07-01T00:00:00.000Z",
		}},
		"moments": {{
			"id": "m-1", "cat_id": "cat-1", "kind": "milestone", "title": "First mouse",
			"occurred_at": "2030-07-20T00:00:00.000Z",
			"created_at":  "2030-07-20T00:00:00.000Z", "updated_at": "2030-07-20T00:00:00.000Z",
		}},
	}
	if _, err := phoneA.PushRows(phoneAEdits); err != nil {
		t.Fatal(err)
	}

	// Phone A syncs: push to server, then pull whatever the server has.
	push(t, ts.URL, phoneAEdits)
	changes := pull(t, ts.URL, time.Time{})
	if _, err := phoneA.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Phone B syncs for the first time: pulls everything.
	changes = pull(t, ts.URL, time.Time{})
	if _, err := phoneB.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Phone B edits: renames the cat and adds a purchase.
	phoneBEdits := map[string][]map[string]any{
		"cats": {{
			"id": "cat-1", "name": "Miko (Bella)", "sex": "male", "status": "alive",
			"created_at": "2030-07-01T00:00:00.000Z", "updated_at": "2030-07-02T00:00:00.000Z",
		}},
		"purchases": {{
			"id": "p-1", "item": "Whiskas", "price": 65000, "category": "food",
			"date": "2030-07-28", "created_at": "2030-07-28T00:00:00.000Z", "updated_at": "2030-07-28T00:00:00.000Z",
		}},
	}
	if _, err := phoneB.PushRows(phoneBEdits); err != nil {
		t.Fatal(err)
	}
	push(t, ts.URL, phoneBEdits)

	// Phone A pulls the updates.
	changes = pull(t, ts.URL, time.Time{})
	if _, err := phoneA.PushRows(changes); err != nil {
		t.Fatal(err)
	}

	// Both phones must agree on the final state.
	want := map[string]int{"cats": 1, "moments": 1, "purchases": 1}
	for _, ph := range []*store.Store{phoneA, phoneB} {
		got, err := ph.PullChanges(time.Time{})
		if err != nil {
			t.Fatal(err)
		}
		for tbl, n := range want {
			if len(got[tbl]) != n {
				t.Fatalf("phone missing %d %s rows, got %d", n, tbl, len(got[tbl]))
			}
		}
		cat := got["cats"][0]
		if cat["name"] != "Miko (Bella)" {
			t.Fatalf("cat name %q, want Miko (Bella)", cat["name"])
		}
		if len(got["reminder_completions"]) != 0 {
			t.Fatalf("unexpected completions: %v", got["reminder_completions"])
		}
	}
}

func push(t *testing.T, base string, changes map[string][]map[string]any) {
	t.Helper()
	body, err := json.Marshal(map[string]any{"changes": changes})
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.Post(base+"/sync/push", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("push got %d", res.StatusCode)
	}
}

func pull(t *testing.T, base string, since time.Time) map[string][]map[string]any {
	t.Helper()
	url := base + "/sync/pull"
	if !since.IsZero() {
		url += "?since=" + since.UTC().Format(time.RFC3339)
	}
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out struct {
		Changes map[string][]map[string]any `json:"changes"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out.Changes == nil {
		t.Fatal("missing changes in pull response")
	}
	return out.Changes
}
