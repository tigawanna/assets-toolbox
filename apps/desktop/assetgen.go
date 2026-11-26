package main

import (
	"archive/zip"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/tigawanna/assets-toolbox/apps/desktop/internal/assetgen"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxAssetInputBytes = 8 << 20

// AssetInput describes a user-selected source image without exposing a writable path.
type AssetInput struct {
	Handle   string `json:"handle"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
}

// ExpoGenerateRequest holds browser-safe generation options. Inputs are handles
// returned by SelectAssetImage, not filesystem paths.
type ExpoGenerateRequest struct {
	Icon             string `json:"icon"`
	DarkIcon         string `json:"darkIcon,omitempty"`
	TintedIcon       string `json:"tintedIcon,omitempty"`
	BrandColor       string `json:"brandColor,omitempty"`
	SplashBackground string `json:"splashBackground,omitempty"`
	ImageWidth       int    `json:"imageWidth,omitempty"`
	ForegroundSize   int    `json:"foregroundSize,omitempty"`
	SplashLogoSize   int    `json:"splashLogoSize,omitempty"`
	NoMonochrome     bool   `json:"noMonochrome,omitempty"`
	WriteConfig      bool   `json:"writeConfig,omitempty"`
	OutDir           string `json:"outDir,omitempty"`
}

// BrandGenerateRequest holds browser-safe options for the Brand Assets generator.
type BrandGenerateRequest struct {
	Icon            string `json:"icon"`
	Plate           string `json:"plate,omitempty"`
	CopySvg         bool   `json:"copySvg,omitempty"`
	OgEnabled       bool   `json:"ogEnabled,omitempty"`
	OgTitle         string `json:"ogTitle,omitempty"`
	OgDescription   string `json:"ogDescription,omitempty"`
	OgSiteLabel     string `json:"ogSiteLabel,omitempty"`
	OgWidth         int    `json:"ogWidth,omitempty"`
	OgHeight        int    `json:"ogHeight,omitempty"`
	ManifestEnabled bool   `json:"manifestEnabled,omitempty"`
	Name            string `json:"name,omitempty"`
	ShortName       string `json:"shortName,omitempty"`
	ThemeColor      string `json:"themeColor,omitempty"`
	BackgroundColor string `json:"backgroundColor,omitempty"`
	StartUrl        string `json:"startUrl,omitempty"`
	Display         string `json:"display,omitempty"`
	OutDir          string `json:"outDir,omitempty"`
}

func newAssetManager() *assetgen.Manager {
	return assetgen.NewManager(resolveAssetWorkerPath())
}

func resolveAssetWorkerPath() string {
	if cwd, err := os.Getwd(); err == nil {
		candidate := filepath.Join(cwd, "sidecar", "src", "worker.mjs")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	if executable, err := os.Executable(); err == nil {
		directory := filepath.Dir(executable)
		for range 4 {
			candidate := filepath.Join(directory, "sidecar", "src", "worker.mjs")
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
			parent := filepath.Dir(directory)
			if parent == directory {
				break
			}
			directory = parent
		}
	}
	return filepath.Join("sidecar", "src", "worker.mjs")
}

func (a *App) rememberAssetDialogDirectory(key, selectedPath string) {
	if a.directories == nil {
		return
	}
	_ = a.directories.set(key, filepath.Dir(selectedPath))
}

func newAssetHandle() (string, error) {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// SelectAssetImage opens a native file dialog and registers a handle for the
// selected source image. The WebView never chooses an arbitrary filesystem path.
func (a *App) SelectAssetImage(role string) (AssetInput, error) {
	switch role {
	case "icon", "darkIcon", "tintedIcon":
	default:
		return AssetInput{}, fmt.Errorf("unknown image role %q", role)
	}

	selected, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Choose a source image",
		DefaultDirectory: existingDirectory(a.directories.get(assetDialogKeyOpen)),
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "SVG or PNG", Pattern: "*.svg;*.png"},
		},
	})
	if err != nil {
		return AssetInput{}, err
	}
	if selected == "" {
		return AssetInput{}, errors.New("no image selected")
	}

	info, err := os.Lstat(selected)
	if err != nil {
		return AssetInput{}, err
	}
	if !info.Mode().IsRegular() || info.Size() == 0 || info.Size() > maxAssetInputBytes {
		return AssetInput{}, errors.New("the selected image must be a regular file under 8 MiB")
	}
	extension := strings.ToLower(filepath.Ext(selected))
	if extension != ".svg" && extension != ".png" {
		return AssetInput{}, errors.New("choose an SVG or PNG image")
	}

	handle, err := newAssetHandle()
	if err != nil {
		return AssetInput{}, err
	}
	a.assetInputsMu.Lock()
	a.assetInputs[handle] = selected
	a.assetInputsMu.Unlock()
	a.rememberAssetDialogDirectory(assetDialogKeyOpen, selected)

	return AssetInput{
		Handle:   handle,
		Name:     filepath.Base(selected),
		Size:     info.Size(),
		MimeType: mime.TypeByExtension(extension),
	}, nil
}

func (a *App) resolveAssetInput(handle string) (string, error) {
	a.assetInputsMu.Lock()
	defer a.assetInputsMu.Unlock()
	selected, ok := a.assetInputs[handle]
	if !ok {
		return "", errors.New("the selected image is no longer available")
	}
	return selected, nil
}

// GetAssetInputPreview returns a base64 preview for a previously selected source image.
func (a *App) GetAssetInputPreview(handle string) (string, error) {
	selected, err := a.resolveAssetInput(handle)
	if err != nil {
		return "", err
	}
	contents, err := os.ReadFile(selected)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(contents), nil
}

// GenerateExpoAssets runs the canonical Expo generator in an isolated job.
func (a *App) GenerateExpoAssets(request ExpoGenerateRequest) (assetgen.Result, error) {
	if request.Icon == "" {
		return assetgen.Result{}, errors.New("choose a primary icon")
	}
	inputs := map[string]string{}
	for role, handle := range map[string]string{
		"icon":       request.Icon,
		"darkIcon":   request.DarkIcon,
		"tintedIcon": request.TintedIcon,
	} {
		if handle == "" {
			continue
		}
		selected, err := a.resolveAssetInput(handle)
		if err != nil {
			return assetgen.Result{}, err
		}
		inputs[role] = selected
	}

	options := map[string]any{"writeConfig": request.WriteConfig}
	if request.BrandColor != "" {
		options["brandColor"] = request.BrandColor
	}
	if request.SplashBackground != "" {
		options["splashBackground"] = request.SplashBackground
	}
	if request.ImageWidth > 0 {
		options["imageWidth"] = request.ImageWidth
	}
	if request.ForegroundSize > 0 {
		options["foregroundSize"] = request.ForegroundSize
	}
	if request.SplashLogoSize > 0 {
		options["splashLogoSize"] = request.SplashLogoSize
	}
	if request.NoMonochrome {
		options["noMonochrome"] = true
	}

	outDir := request.OutDir
	if outDir == "" {
		outDir = "out"
	}
	return a.assetManager.Start(a.ctx, assetgen.Request{
		Tool:       "expo",
		InputPaths: inputs,
		Options:    options,
		OutDir:     outDir,
	})
}

// GenerateBrandAssets runs the canonical icon/OG/manifest generators in an isolated job.
func (a *App) GenerateBrandAssets(request BrandGenerateRequest) (assetgen.Result, error) {
	if request.Icon == "" {
		return assetgen.Result{}, errors.New("choose a brand icon")
	}
	selected, err := a.resolveAssetInput(request.Icon)
	if err != nil {
		return assetgen.Result{}, err
	}

	options := map[string]any{
		"copySvg":  request.CopySvg,
		"og":       map[string]any{"enabled": request.OgEnabled},
		"manifest": map[string]any{"enabled": request.ManifestEnabled},
	}
	if request.Plate != "" {
		options["plate"] = request.Plate
	}
	if request.OgEnabled {
		if request.OgTitle == "" {
			return assetgen.Result{}, errors.New("add a title for the social card")
		}
		og := options["og"].(map[string]any)
		og["title"] = request.OgTitle
		if request.OgDescription != "" {
			og["description"] = request.OgDescription
		}
		if request.OgSiteLabel != "" {
			og["siteLabel"] = request.OgSiteLabel
		}
		if request.OgWidth > 0 {
			og["width"] = request.OgWidth
		}
		if request.OgHeight > 0 {
			og["height"] = request.OgHeight
		}
	}
	if request.ManifestEnabled {
		manifest := options["manifest"].(map[string]any)
		if request.Name != "" {
			manifest["name"] = request.Name
		}
		if request.ShortName != "" {
			manifest["shortName"] = request.ShortName
		}
		if request.ThemeColor != "" {
			manifest["themeColor"] = request.ThemeColor
		}
		if request.BackgroundColor != "" {
			manifest["backgroundColor"] = request.BackgroundColor
		}
		if request.StartUrl != "" {
			manifest["startUrl"] = request.StartUrl
		}
		if request.Display != "" {
			manifest["display"] = request.Display
		}
	}

	outDir := request.OutDir
	if outDir == "" {
		outDir = "out"
	}
	return a.assetManager.Start(a.ctx, assetgen.Request{
		Tool:       "brand",
		InputPaths: map[string]string{"icon": selected},
		Options:    options,
		OutDir:     outDir,
	})
}

// GetAssetArtifact returns a base64 preview for one generated file.
func (a *App) GetAssetArtifact(jobID, name string) (string, error) {
	filePath, err := a.assetManager.ArtifactPath(jobID, name)
	if err != nil {
		return "", err
	}
	contents, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(contents), nil
}

// SaveAssetArtifact writes one artifact to a user-chosen destination.
func (a *App) SaveAssetArtifact(jobID, name string) (string, error) {
	filePath, err := a.assetManager.ArtifactPath(jobID, name)
	if err != nil {
		return "", err
	}
	destination, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:            "Save asset",
		DefaultDirectory: existingDirectory(a.directories.get(assetDialogKeySave)),
		DefaultFilename:  name,
	})
	if err != nil {
		return "", err
	}
	if destination == "" {
		return "", nil
	}
	contents, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(destination, contents, 0o644); err != nil {
		return "", err
	}
	a.rememberAssetDialogDirectory(assetDialogKeySave, destination)
	return destination, nil
}

// SaveAssetSet writes every generated artifact into one ZIP archive.
func (a *App) SaveAssetSet(jobID, suggestedName string) (string, error) {
	root, err := a.assetManager.JobRoot(jobID)
	if err != nil {
		return "", err
	}
	if suggestedName == "" {
		suggestedName = "expo-assets.zip"
	}
	destination, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:            "Save asset set",
		DefaultDirectory: existingDirectory(a.directories.get(assetDialogKeySave)),
		DefaultFilename:  suggestedName,
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "ZIP archive", Pattern: "*.zip"},
		},
	})
	if err != nil {
		return "", err
	}
	if destination == "" {
		return "", nil
	}

	file, err := os.Create(destination)
	if err != nil {
		return "", err
	}
	archive := zip.NewWriter(file)
	err = filepath.WalkDir(root, func(itemPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		relative, err := filepath.Rel(root, itemPath)
		if err != nil {
			return err
		}
		if strings.HasPrefix(relative, "inputs"+string(filepath.Separator)) {
			return nil
		}
		writer, err := archive.Create(filepath.ToSlash(relative))
		if err != nil {
			return err
		}
		contents, err := os.ReadFile(itemPath)
		if err != nil {
			return err
		}
		_, err = writer.Write(contents)
		return err
	})
	if err == nil {
		err = archive.Close()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return "", err
	}
	a.rememberAssetDialogDirectory(assetDialogKeySave, destination)
	return destination, nil
}

// CopyAssetText copies a generated config or prompt to the native clipboard.
func (a *App) CopyAssetText(jobID, name string) error {
	if name == "__agentPrompt__" {
		return errors.New("agent prompt is returned with the generation result")
	}
	filePath, err := a.assetManager.ArtifactPath(jobID, name)
	if err != nil {
		return err
	}
	contents, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	return wailsruntime.ClipboardSetText(a.ctx, string(contents))
}

func (a *App) CancelAssetGeneration(jobID string) bool {
	return a.assetManager.Cancel(jobID)
}

func (a *App) DiscardAssetJob(jobID string) {
	a.assetManager.Discard(jobID)
}
