package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/assetgen"
)

func TestBrandGenerationWithCustomOGComponent(t *testing.T) {
	worker := resolveAssetWorkerPath()
	if _, err := os.Stat(worker); err != nil {
		t.Skipf("sidecar is unavailable: %v", err)
	}
	if _, err := os.Stat("../../packages/brand-assets/dist/index.mjs"); err != nil {
		t.Skipf("build @tigawanna/brand-assets before running the sidecar integration test: %v", err)
	}

	const component = `export default function TestCard(props) {
  return <div style={{ width: '100%', height: '100%', backgroundColor: '#16304a', color: '#ffffff', fontSize: 48 }}>{props.title}</div>;
}`

	app := NewApp()
	defer app.assetManager.Close()
	app.assetInputs["custom-og-icon"] = "../../packages/brand-assets/test/fixtures/icon.svg"

	result, err := app.GenerateBrandAssets(BrandGenerateRequest{
		Icon:              "custom-og-icon",
		OgEnabled:         true,
		OgTitle:           "Custom Card",
		OgComponentSource: component,
	})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, artifact := range result.Artifacts {
		if artifact.Name == "og.png" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected og.png from the custom template")
	}
}

func TestGetAssetInputPreview(t *testing.T) {
	app := NewApp()
	defer app.assetManager.Close()
	app.assetInputs["preview-handle"] = "../../packages/expo-assets/test/fixtures/logo.svg"

	encoded, err := app.GetAssetInputPreview("preview-handle")
	if err != nil {
		t.Fatal(err)
	}
	contents, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if len(contents) == 0 {
		t.Fatal("expected a non-empty preview")
	}
}

func TestBrandGenerationWithCanonicalSidecar(t *testing.T) {
	worker := resolveAssetWorkerPath()
	if _, err := os.Stat(worker); err != nil {
		t.Skipf("sidecar is unavailable: %v", err)
	}
	if _, err := os.Stat("../../packages/brand-assets/dist/index.mjs"); err != nil {
		t.Skipf("build @tigawanna/brand-assets before running the sidecar integration test: %v", err)
	}

	manager := assetgen.NewManager(worker)
	defer manager.Close()

	result, err := manager.Start(context.Background(), assetgen.Request{
		Tool:       "brand",
		InputPaths: map[string]string{"icon": "../../packages/brand-assets/test/fixtures/icon.svg"},
		Options: map[string]any{
			"plate":    "#0f100f",
			"copySvg":  true,
			"og":       map[string]any{"enabled": true, "title": "Fixture Brand"},
			"manifest": map[string]any{"enabled": true, "name": "Fixture Brand"},
		},
		OutDir: "out",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Artifacts) < 6 {
		t.Fatalf("artifacts = %d, want at least 6", len(result.Artifacts))
	}
	if result.ConfigPath == "" || result.AgentPrompt == "" {
		t.Fatal("expected a manifest path and agent prompt")
	}
}

func TestExpoGenerationWithCanonicalSidecar(t *testing.T) {
	worker := resolveAssetWorkerPath()
	if _, err := os.Stat(worker); err != nil {
		t.Skipf("sidecar is unavailable: %v", err)
	}
	if _, err := os.Stat("../../packages/expo-assets/dist/index.mjs"); err != nil {
		t.Skipf("build @tigawanna/expo-assets before running the sidecar integration test: %v", err)
	}

	manager := assetgen.NewManager(worker)
	defer manager.Close()

	result, err := manager.Start(context.Background(), assetgen.Request{
		Tool:       "expo",
		InputPaths: map[string]string{"icon": "../../packages/expo-assets/test/fixtures/logo.svg"},
		Options:    map[string]any{"writeConfig": true},
		OutDir:     "assets/images",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Artifacts) != 7 {
		t.Fatalf("artifacts = %d, want 7", len(result.Artifacts))
	}
	if result.ConfigPath == "" || result.AgentPrompt == "" {
		t.Fatal("expected a config path and agent prompt")
	}
	for _, artifact := range result.Artifacts {
		path, err := manager.ArtifactPath(result.JobID, artifact.Name)
		if err != nil {
			t.Fatalf("artifact %s: %v", artifact.Name, err)
		}
		if filepath.Base(path) != artifact.Name {
			t.Fatalf("artifact name mismatch: %s", path)
		}
	}
}
