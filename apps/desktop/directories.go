package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

const assetDialogKeyOpen = "open"
const assetDialogKeySave = "save"

// directoryStore remembers the last folder used by native file dialogs.
// It is intentionally small and separate from SVG Compose workspace storage.
type directoryStore struct {
	mu     sync.Mutex
	path   string
	dirs   map[string]string
	loaded bool
}

func defaultDirectoryStorePath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(configDir, "assets-toolbox", "dialogs.json")
}

func newDirectoryStore(path string) *directoryStore {
	return &directoryStore{path: path, dirs: make(map[string]string)}
}

func (s *directoryStore) loadLocked() {
	if s.loaded || s.path == "" {
		return
	}
	s.loaded = true
	contents, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	var stored map[string]string
	if err := json.Unmarshal(contents, &stored); err == nil && stored != nil {
		s.dirs = stored
	}
}

func (s *directoryStore) get(key string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.loadLocked()
	return s.dirs[key]
}

func (s *directoryStore) set(key, directory string) error {
	if s.path == "" || directory == "" {
		return errors.New("dialog directory storage is unavailable")
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.loadLocked()
	s.dirs[key] = directory

	contents, err := json.MarshalIndent(s.dirs, "", "  ")
	if err != nil {
		return err
	}
	contents = append(contents, '\n')

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(s.path), ".dialogs-*.json")
	if err != nil {
		return err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)

	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(contents); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryName, s.path)
}

func existingDirectory(path string) string {
	if path == "" {
		return ""
	}
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return ""
	}
	return path
}
