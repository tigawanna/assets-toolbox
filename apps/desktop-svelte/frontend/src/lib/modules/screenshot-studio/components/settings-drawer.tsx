"use client";

import { HardDrive, Lock } from "lucide-react";

import { StudioSheet } from "@/components/studio-sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SettingsDrawer({
  projectId: _projectId,
  align = "ghost",
}: {
  projectId?: string;
  align?: "ghost" | "header";
}) {
  return (
    <StudioSheet
      side="right"
      title="Settings"
      description="Appearance and storage for the embedded Screenshot Studio."
      trigger={
        <Button
          variant="ghost"
          size={align === "header" ? "xs" : "xs"}
          title="Open settings"
          aria-label="Open settings"
          data-testid="open-settings"
        >
          Settings
        </Button>
      }
    >
      <div className="grid gap-6">
        <section className="grid gap-3">
          <h3 className="text-sm font-medium text-foreground">Appearance</h3>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-foreground">Workspace theme</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Shared with the Assets Toolbox shell.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <HardDrive className="size-4" aria-hidden />
            Local boards
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Boards, layers, and imported images are stored in this desktop app's local web storage.
            Nothing is uploaded.
          </p>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <p className="font-mono text-xs break-all text-foreground">
              Assets Toolbox · Screenshot Studio
            </p>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Lock className="size-4" aria-hidden />
            Embedded mode
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            MCP, server files, and cross-tab live sync are unavailable in this embedded route.
            Editing, history, and PNG/ZIP export run locally.
          </p>
        </section>
      </div>
    </StudioSheet>
  );
}
