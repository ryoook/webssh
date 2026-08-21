package configstore

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

type Store struct {
	dir      string
	savePass bool
	mu       sync.Mutex
}

func New(dir string, savePass bool) (*Store, error) {
	if dir == "" {
		return nil, errors.New("config dir is empty")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{dir: dir, savePass: savePass}, nil
}

func (s *Store) connectionsPath() string {
	return filepath.Join(s.dir, "connections.json")
}

func (s *Store) commandsPath() string {
	return filepath.Join(s.dir, "commands.json")
}

func (s *Store) LoadConnections() ([]map[string]interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return loadList(s.connectionsPath())
}

func (s *Store) SaveConnections(list []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := cloneList(list)
	if !s.savePass {
		for _, item := range cloned {
			item["password"] = ""
		}
	}
	return atomicWriteJSON(s.connectionsPath(), cloned)
}

func (s *Store) LoadCommands() ([]map[string]interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return loadList(s.commandsPath())
}

func (s *Store) SaveCommands(list []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return atomicWriteJSON(s.commandsPath(), cloneList(list))
}

func loadList(path string) ([]map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]interface{}{}, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return []map[string]interface{}{}, nil
	}
	var list []map[string]interface{}
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []map[string]interface{}{}
	}
	return list, nil
}

func cloneList(list []map[string]interface{}) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(list))
	for _, item := range list {
		cp := make(map[string]interface{}, len(item))
		for k, v := range item {
			cp[k] = v
		}
		out = append(out, cp)
	}
	return out
}

func atomicWriteJSON(path string, value interface{}) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
