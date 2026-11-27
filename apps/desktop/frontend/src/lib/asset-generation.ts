export interface AssetInput {
  handle: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ExpoGenerateRequest {
  icon: string;
  darkIcon?: string;
  tintedIcon?: string;
  brandColor?: string;
  splashBackground?: string;
  imageWidth?: number;
  foregroundSize?: number;
  splashLogoSize?: number;
  noMonochrome?: boolean;
  writeConfig?: boolean;
  outDir?: string;
}

export interface BrandGenerateRequest {
  icon: string;
  plate?: string;
  copySvg?: boolean;
  ogEnabled?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogSiteLabel?: string;
  ogComponentSource?: string;
  ogExportName?: string;
  ogWidth?: number;
  ogHeight?: number;
  manifestEnabled?: boolean;
  name?: string;
  shortName?: string;
  themeColor?: string;
  backgroundColor?: string;
  startUrl?: string;
  display?: string;
  outDir?: string;
}

export interface AssetArtifact {
  name: string;
  path: string;
  bytes: number;
  width: number;
  height: number;
}

export interface AssetJobResult {
  jobId: string;
  artifacts: AssetArtifact[];
  config: Record<string, unknown> | null;
  configPath: string;
  agentPrompt: string;
}

interface AssetApp {
  SelectAssetImage(role: string): Promise<AssetInput>;
  GetAssetInputPreview(handle: string): Promise<string>;
  GenerateExpoAssets(request: ExpoGenerateRequest): Promise<AssetJobResult>;
  GenerateBrandAssets(request: BrandGenerateRequest): Promise<AssetJobResult>;
  GetAssetArtifact(jobID: string, name: string): Promise<string>;
  ReplaceAssetArtifact(jobID: string, name: string, base64Data: string): Promise<void>;
  SaveAssetArtifact(jobID: string, name: string): Promise<string>;
  SaveAssetSet(jobID: string, suggestedName: string): Promise<string>;
  CopyAssetText(jobID: string, name: string): Promise<void>;
  CancelAssetGeneration(jobID: string): Promise<boolean>;
  DiscardAssetJob(jobID: string): Promise<void>;
  StageProjectAsset?(projectID: string, assetID: string, role: string): Promise<AssetInput>;
}

interface AssetWindow extends Window {
  go?: {
    main?: {
      App?: AssetApp;
    };
  };
}

export function getAssetApp(): AssetApp | null {
  if (typeof window === "undefined") return null;
  return (window as AssetWindow).go?.main?.App ?? null;
}

export function hasAssetGeneration(): boolean {
  return getAssetApp() !== null;
}
