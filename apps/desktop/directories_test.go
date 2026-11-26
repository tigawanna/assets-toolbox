package main

import (
	"path/filepath"
	"testing"
)

func TestDirectoryStoreRemembersLastFolders(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "dialogs.json")
	store := newDirectoryStore(path)

	if err := store.set(assetDialogKeyOpen, "/tmp/projects/assets"); err != nil {
		t.Fatal(err)
	}
	if err := store.set(assetDialogKeySave, "/tmp/exports"); err != nil {
		t.Fatal(err)
	}

	reloaded := newDirectoryStore(path)
	if got := reloaded.get(assetDialogKeyOpen); got != "/tmp/projects/assets" {
		t.Fatalf("open directory = %q", got)
	}
	if got := reloaded.get(assetDialogKeySave); got != "/tmp/exports" {
		t.Fatalf("save directory = %q", got)
	}
}

func TestExistingDirectoryRejectsMissingFolders(t *testing.T) {
	if got := existingDirectory(filepath.Join(t.TempDir(), "missing")); got != "" {
		t.Fatalf("missing directory returned %q", got)
	}
	directory := t.TempDir()
	if got := existingDirectory(directory); got != directory {
		t.Fatalf("directory = %q, want %q", got, directory)
	}
}
