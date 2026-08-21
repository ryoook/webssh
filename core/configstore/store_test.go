package configstore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMissingFilesReturnsEmptySlice(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	conns, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if conns == nil || len(conns) != 0 {
		t.Fatalf("want empty non-nil slice, got %#v", conns)
	}
	cmds, err := store.LoadCommands()
	if err != nil {
		t.Fatal(err)
	}
	if cmds == nil || len(cmds) != 0 {
		t.Fatalf("want empty non-nil slice, got %#v", cmds)
	}
}

func TestSaveAndLoadConnectionsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{
			"id":        "one",
			"host":      "h.example",
			"username":  "root",
			"port":      float64(22),
			"password":  "secret",
			"logintype": float64(0),
		},
	}
	if err := store.SaveConnections(input); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "connections.json"))
	if err != nil {
		t.Fatal(err)
	}
	var decoded []map[string]interface{}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded[0]["password"] != "secret" {
		t.Fatalf("password not persisted: %#v", decoded[0])
	}
	loaded, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["host"] != "h.example" {
		t.Fatalf("unexpected load: %#v", loaded)
	}
}

func TestSaveConnectionsStripsPasswordWhenSavePassFalse(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{"id": "one", "host": "h", "password": "secret"},
	}
	if err := store.SaveConnections(input); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["password"] != "" {
		t.Fatalf("expected empty password, got %#v", loaded[0]["password"])
	}
}

func TestSaveCommandsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{"id": "c1", "name": "ls", "content": "ls -la"},
	}
	if err := store.SaveCommands(input); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.LoadCommands()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["content"] != "ls -la" {
		t.Fatalf("unexpected: %#v", loaded)
	}
}
