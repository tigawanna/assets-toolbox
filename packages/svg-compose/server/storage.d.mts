export type Viewport = { zoom: number; tx: number; ty: number };
export type WorkspaceDocument = {
  id: string;
  name: string;
  svg: string;
  viewport: Viewport;
  updatedAt: string;
};

export function workspaceRoot(): string;
export function workspaceDatabasePath(): string;
export function loadWorkspace(path?: string): WorkspaceDocument | null;
export function saveWorkspace(
  input: { name?: string; svg: string; viewport?: Viewport },
  path?: string,
): WorkspaceDocument;
export function closeWorkspace(path?: string): void;
