import { completeDesktopFlush, onDesktopFlush, setDesktopModuleActive } from "../../../desktop";

type WailsEventCallback = (...data: unknown[]) => void;

export const onWorkspaceFlush = (callback: WailsEventCallback) =>
  onDesktopFlush("workspace", callback);

export const completeWorkspaceFlush = (succeeded = true, requestId?: unknown) =>
  completeDesktopFlush("workspace", succeeded, requestId);

export const setDesktopWorkspaceActive = (active: boolean) =>
  setDesktopModuleActive("workspace", active);
