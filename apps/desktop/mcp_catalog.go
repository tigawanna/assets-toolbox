package main

import (
	"fmt"
	"net/http"
)

func objectSchema(properties map[string]any, required ...string) map[string]any {
	return map[string]any{
		"type": "object", "properties": properties, "required": required,
	}
}

func strProp() map[string]any  { return map[string]any{"type": "string"} }
func boolProp() map[string]any { return map[string]any{"type": "boolean"} }
func intProp() map[string]any  { return map[string]any{"type": "integer"} }
func anyProp() map[string]any  { return map[string]any{} }
func arrayProp() map[string]any {
	return map[string]any{"type": "array", "items": map[string]any{"type": "string"}}
}

func optString(args map[string]any, key string) string {
	value, _ := args[key].(string)
	return value
}

func optInt(args map[string]any, key string) int {
	value, ok := args[key].(float64)
	if !ok {
		return 0
	}
	return int(value)
}

func optBool(args map[string]any, key string) bool {
	value, _ := args[key].(bool)
	return value
}

func (a *App) mcpCatalog() map[string]mcpToolEntry {
	entries := []mcpToolEntry{
		{
			ID: "projects.list", Summary: "List all projects with asset and document counts.",
			InputSchema: objectSchema(map[string]any{}),
			Run: func(args map[string]any) (any, error) {
				return a.projectsCall(http.MethodGet, "/api/projects", nil)
			},
		},
		{
			ID: "projects.create", Summary: "Create a project by name.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"name": strProp()}, "name"),
			Run: func(args map[string]any) (any, error) {
				name, err := mcpString(args, "name")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodPost, "/api/projects", map[string]any{"name": name})
			},
		},
		{
			ID: "projects.get", Summary: "Get a project manifest.",
			InputSchema: objectSchema(map[string]any{"projectId": strProp()}, "projectId"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodGet, "/api/projects/"+id, nil)
			},
		},
		{
			ID: "projects.rename", Summary: "Rename a project.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "name": strProp()}, "projectId", "name"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				name, err := mcpString(args, "name")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodPatch, "/api/projects/"+id, map[string]any{"name": name})
			},
		},
		{
			ID: "projects.delete", Summary: "Delete a project and all of its documents and assets.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"projectId": strProp()}, "projectId"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodDelete, "/api/projects/"+id, nil)
			},
		},
		{
			ID: "documents.get", Summary: "Read a tool document from a project (compose, brand, expo, studio, sound, inspect).",
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "tool": strProp()}, "projectId", "tool"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				tool, err := mcpString(args, "tool")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodGet, "/api/projects/"+id+"/documents/"+tool, nil)
			},
		},
		{
			ID: "documents.put", Summary: "Write a tool document. Data must use the tool's own shape.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "tool": strProp(), "data": anyProp()}, "projectId", "tool", "data"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				tool, err := mcpString(args, "tool")
				if err != nil {
					return nil, err
				}
				data, ok := args["data"]
				if !ok {
					return nil, fmt.Errorf("data is required")
				}
				return a.projectsCall(http.MethodPut, "/api/projects/"+id+"/documents/"+tool, map[string]any{"data": data})
			},
		},
		{
			ID: "assets.list", Summary: "List assets stored in a project.",
			InputSchema: objectSchema(map[string]any{"projectId": strProp()}, "projectId"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodGet, "/api/projects/"+id+"/assets", nil)
			},
		},
		{
			ID: "assets.add", Summary: "Add a base64 image or file to a project's shared library.", Mutating: true,
			InputSchema: objectSchema(map[string]any{
				"projectId": strProp(), "name": strProp(), "mime": strProp(), "base64": strProp(),
			}, "projectId", "name", "mime", "base64"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				name, err := mcpString(args, "name")
				if err != nil {
					return nil, err
				}
				mime, err := mcpString(args, "mime")
				if err != nil {
					return nil, err
				}
				if _, err := mcpBase64(args, "base64"); err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodPost, "/api/projects/"+id+"/assets", map[string]any{
					"name": name, "mime": mime, "base64": args["base64"],
				})
			},
		},
		{
			ID: "assets.blob", Summary: "Get an asset's bytes as base64.",
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "assetId": strProp()}, "projectId", "assetId"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				assetID, err := mcpString(args, "assetId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodGet, "/api/projects/"+id+"/assets/"+assetID+"/blob", nil)
			},
		},
		{
			ID: "assets.move", Summary: "Copy or move assets to another project, including derived outputs.", Mutating: true,
			InputSchema: objectSchema(map[string]any{
				"projectId": strProp(), "assetIds": arrayProp(), "targetProjectId": strProp(),
				"mode": strProp(), "includeDerived": boolProp(),
			}, "projectId", "assetIds", "targetProjectId", "mode"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				target, err := mcpString(args, "targetProjectId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodPost, "/api/projects/"+id+"/assets/move", map[string]any{
					"assetIds": args["assetIds"], "targetProjectId": target,
					"mode": args["mode"], "includeDerived": optBool(args, "includeDerived"),
				})
			},
		},
		{
			ID: "assets.delete", Summary: "Delete an asset from a project.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "assetId": strProp()}, "projectId", "assetId"),
			Run: func(args map[string]any) (any, error) {
				id, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				assetID, err := mcpString(args, "assetId")
				if err != nil {
					return nil, err
				}
				return a.projectsCall(http.MethodDelete, "/api/projects/"+id+"/assets/"+assetID, nil)
			},
		},
		{
			ID: "expo.generate", Summary: "Generate an Expo asset set from project assets. No native dialogs.", Mutating: true,
			InputSchema: objectSchema(map[string]any{
				"projectId": strProp(), "iconAssetId": strProp(), "darkIconAssetId": strProp(),
				"tintedIconAssetId": strProp(), "brandColor": strProp(), "splashBackground": strProp(),
				"imageWidth": intProp(), "foregroundSize": intProp(), "splashLogoSize": intProp(),
				"noMonochrome": boolProp(), "writeConfig": boolProp(), "outDir": strProp(),
			}, "projectId", "iconAssetId"),
			Run: func(args map[string]any) (any, error) {
				projectID, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				iconID, err := mcpString(args, "iconAssetId")
				if err != nil {
					return nil, err
				}
				icon, err := a.stageMCPAsset(projectID, iconID, "icon")
				if err != nil {
					return nil, err
				}
				request := ExpoGenerateRequest{
					Icon: icon.Handle, BrandColor: optString(args, "brandColor"),
					SplashBackground: optString(args, "splashBackground"),
					ImageWidth:       optInt(args, "imageWidth"), ForegroundSize: optInt(args, "foregroundSize"),
					SplashLogoSize: optInt(args, "splashLogoSize"), NoMonochrome: optBool(args, "noMonochrome"),
					WriteConfig: optBool(args, "writeConfig"), OutDir: optString(args, "outDir"),
				}
				if darkID := optString(args, "darkIconAssetId"); darkID != "" {
					input, err := a.stageMCPAsset(projectID, darkID, "darkIcon")
					if err != nil {
						return nil, err
					}
					request.DarkIcon = input.Handle
				}
				if tintedID := optString(args, "tintedIconAssetId"); tintedID != "" {
					input, err := a.stageMCPAsset(projectID, tintedID, "tintedIcon")
					if err != nil {
						return nil, err
					}
					request.TintedIcon = input.Handle
				}
				return a.GenerateExpoAssets(request)
			},
		},
		{
			ID: "brand.generate", Summary: "Generate a brand asset set from a project asset.", Mutating: true,
			InputSchema: objectSchema(map[string]any{
				"projectId": strProp(), "assetId": strProp(), "plate": strProp(),
				"ogTitle": strProp(), "ogDescription": strProp(), "ogSiteLabel": strProp(),
				"name": strProp(), "shortName": strProp(), "themeColor": strProp(),
				"backgroundColor": strProp(), "startUrl": strProp(), "display": strProp(), "outDir": strProp(),
			}, "projectId", "assetId"),
			Run: func(args map[string]any) (any, error) {
				projectID, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				assetID, err := mcpString(args, "assetId")
				if err != nil {
					return nil, err
				}
				icon, err := a.stageMCPAsset(projectID, assetID, "icon")
				if err != nil {
					return nil, err
				}
				request := BrandGenerateRequest{
					Icon: icon.Handle, Plate: optString(args, "plate"),
					OgTitle: optString(args, "ogTitle"), OgDescription: optString(args, "ogDescription"),
					OgSiteLabel: optString(args, "ogSiteLabel"), Name: optString(args, "name"),
					ShortName: optString(args, "shortName"), ThemeColor: optString(args, "themeColor"),
					BackgroundColor: optString(args, "backgroundColor"), StartUrl: optString(args, "startUrl"),
					Display: optString(args, "display"), OutDir: optString(args, "outDir"),
				}
				return a.GenerateBrandAssets(request)
			},
		},
		{
			ID: "jobs.artifact", Summary: "Read a generated artifact as base64.",
			InputSchema: objectSchema(map[string]any{"jobId": strProp(), "name": strProp()}, "jobId", "name"),
			Run: func(args map[string]any) (any, error) {
				jobID, err := mcpString(args, "jobId")
				if err != nil {
					return nil, err
				}
				name, err := mcpString(args, "name")
				if err != nil {
					return nil, err
				}
				encoded, err := a.GetAssetArtifact(jobID, name)
				if err != nil {
					return nil, err
				}
				return map[string]any{"name": name, "base64": encoded}, nil
			},
		},
		{
			ID: "jobs.cancel", Summary: "Cancel a running generation job.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"jobId": strProp()}, "jobId"),
			Run: func(args map[string]any) (any, error) {
				jobID, err := mcpString(args, "jobId")
				if err != nil {
					return nil, err
				}
				return map[string]any{"cancelled": a.CancelAssetGeneration(jobID)}, nil
			},
		},
		{
			ID: "jobs.discard", Summary: "Discard a job and delete its staging directory.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"jobId": strProp()}, "jobId"),
			Run: func(args map[string]any) (any, error) {
				jobID, err := mcpString(args, "jobId")
				if err != nil {
					return nil, err
				}
				a.DiscardAssetJob(jobID)
				return map[string]any{"ok": true}, nil
			},
		},
		{
			ID: "sound.favorites.set", Summary: "Write the favorites list into a project's sound document.", Mutating: true,
			InputSchema: objectSchema(map[string]any{"projectId": strProp(), "favorites": arrayProp()}, "projectId", "favorites"),
			Run: func(args map[string]any) (any, error) {
				projectID, err := mcpString(args, "projectId")
				if err != nil {
					return nil, err
				}
				favorites, ok := args["favorites"].([]any)
				if !ok {
					return nil, fmt.Errorf("favorites must be an array of sound names")
				}
				return a.projectsCall(http.MethodPut, "/api/projects/"+projectID+"/documents/sound",
					map[string]any{"data": map[string]any{"favorites": favorites}})
			},
		},
	}

	catalog := make(map[string]mcpToolEntry, len(entries))
	for _, entry := range entries {
		catalog[entry.ID] = entry
	}
	return catalog
}
