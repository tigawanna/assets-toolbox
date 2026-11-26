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
  GenerateExpoAssets(request: ExpoGenerateRequest): Promise<AssetJobResult>;
  GetAssetArtifact(jobID: string, name: string): Promise<string>;
  SaveAssetArtifact(jobID: string, name: string): Promise<string>;
  SaveAssetSet(jobID: string, suggestedName: string): Promise<string>;
  CopyAssetText(jobID: string, name: string): Promise<void>;
  CancelAssetGeneration(jobID: string): Promise<boolean>;
  DiscardAssetJob(jobID: string): Promise<void>;
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
