/**
 * Tool state machine seam. Exactly one tool is active at a time; the Stage
 * routes pointer/key events to it. Concrete tools live in ./shapes.
 */
import type { Stage } from "../canvas/stage";

export type ToolContext = {
  stage: Stage;
  event: PointerEvent;
};

export interface Tool {
  readonly id: string;
  readonly label: string;
  /** Handle-based tools only react to their own handles; clicks elsewhere select. */
  readonly manipulatorOnly?: boolean;
  onActivate?(stage: Stage): void;
  onPointerDown?(context: ToolContext): void;
  onPointerMove?(context: ToolContext): void;
  onPointerUp?(context: ToolContext): void;
  onKey?(event: KeyboardEvent): void;
  onDeactivate?(): void;
}
