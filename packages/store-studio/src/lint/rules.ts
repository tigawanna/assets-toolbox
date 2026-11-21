import {
  checkAltText,
  findBannedPhrases,
  FEATURE_GRAPHIC_SAFE_MARGIN,
  isLowContrastFill,
} from "@tigawanna/play-screenshots/policy";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import { fitScreen, cropPercentages, slicesIntersectingRect, type Rect } from "../model/geometry";
import type { Board, ColorRef, Node, StudioProject, TextNode } from "../model/schema";

export type LintSeverity = "error" | "warn";

export interface LintIssue {
  id: string;
  severity: LintSeverity;
  message: string;
  boardId?: string;
  nodeId?: string;
  fix?: "match-capture" | "contain" | "trim-status-bar" | "edit-alt";
}

export const CROP_WARN_THRESHOLD = 0.03;

function resolveColor(project: StudioProject, ref: ColorRef | undefined): string | undefined {
  if (ref === undefined) return undefined;
  if (typeof ref === "string") return ref;
  return project.theme.tokens[ref.token];
}

function luminance(hex: string | undefined): number | null {
  if (hex === undefined) return null;
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (!/^[\da-fA-F]{6}$/i.test(full)) return null;
  const channel = (start: number) => Number.parseInt(full.slice(start, start + 2), 16) / 255;
  const linear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(channel(0)) + 0.7152 * linear(channel(2)) + 0.0722 * linear(channel(4));
}

function contrastRatio(a: number, b: number): number {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function nodeRect(node: Node): Rect {
  if (node.type === "group") {
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

function lintBoard(project: StudioProject, board: Board): LintIssue[] {
  const issues: LintIssue[] = [];
  const preset = getPreset(board.preset);
  const width = preset.width;
  const height = preset.height;
  const sliceArea = width * height;

  for (const node of board.nodes) {
    const rect = nodeRect(node);
    if (node.type === "text") {
      const slices = slicesIntersectingRect(rect, node.rotation, width, board.sliceCount);
      if (slices.length > 1) {
        issues.push({
          id: `${board.id}:${node.id}:slice-cut`,
          severity: "error",
          message: `“${node.text.slice(0, 24)}” crosses slice ${slices[0]! + 1}/${slices[slices.length - 1]! + 1}.`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
      const coverage = (rect.width * rect.height) / sliceArea;
      if (coverage > 0.2) {
        issues.push({
          id: `${board.id}:${node.id}:coverage`,
          severity: "warn",
          message: `Text covers ${(coverage * 100).toFixed(0)}% of a slice (recommended ≤20%).`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
      const banned = findBannedPhrases(node.text);
      if (banned.length > 0) {
        issues.push({
          id: `${board.id}:${node.id}:banned`,
          severity: "error",
          message: `Banned promotional ${banned.length === 1 ? "word" : "words"}: ${banned.join(", ")}.`,
          boardId: board.id,
          nodeId: node.id,
        });
      }
      const textL = luminance(resolveColor(project, node.color));
      const bgL = luminance(
        resolveColor(
          project,
          board.background.type === "solid" ? board.background.color : undefined,
        ),
      );
      if (textL !== null && bgL !== null && contrastRatio(textL, bgL) < 3) {
        issues.push({
          id: `${board.id}:${node.id}:contrast`,
          severity: "warn",
          message: "Low text contrast against the board background.",
          boardId: board.id,
          nodeId: node.id,
        });
      }
    }

    if (node.type === "device") {
      const asset = project.assets[node.content.assetId];
      if (asset !== undefined) {
        const screen = {
          x: node.width * 0.06,
          y: node.height * 0.03,
          width: node.width * 0.88,
          height: node.height * 0.9,
          radius: 0,
        };
        const fit = fitScreen(
          asset.width,
          asset.height,
          node.content.trim,
          screen,
          node.content.fit,
          node.content.zoom,
          node.content.offset,
        );
        const crop = cropPercentages(fit);
        const worst = Math.max(crop.top, crop.bottom, crop.left, crop.right);
        if (worst > CROP_WARN_THRESHOLD) {
          issues.push({
            id: `${board.id}:${node.id}:crop`,
            severity: "warn",
            message: `Cropping ${(worst * 100).toFixed(1)}% of the capture on one edge.`,
            boardId: board.id,
            nodeId: node.id,
            fix: node.content.fit === "cover" ? "contain" : "match-capture",
          });
        }
        if (
          asset.height / asset.width > 1.5 &&
          ["tablet", "foldable", "chromebook"].includes(board.kind)
        ) {
          issues.push({
            id: `${board.id}:${node.id}:phone-capture`,
            severity: "warn",
            message: "A phone capture is used on a large-screen board. Supply a matching capture.",
            boardId: board.id,
            nodeId: node.id,
          });
        }
      }
    }

    if (board.kind === "feature" && node.type !== "shape" && node.type !== "glow") {
      const margin = FEATURE_GRAPHIC_SAFE_MARGIN * width;
      if (rect.x < margin || rect.x + rect.width > width - margin) {
        issues.push({
          id: `${board.id}:${node.id}:safe-zone`,
          severity: "warn",
          message: "Content sits in the feature graphic's left/right cut zones.",
          boardId: board.id,
          nodeId: node.id,
        });
      }
    }
  }

  if (board.background.type === "solid") {
    const hex = resolveColor(project, board.background.color);
    if (hex !== undefined && isLowContrastFill(hex)) {
      issues.push({
        id: `${board.id}:background-contrast`,
        severity: "warn",
        message: "A flat white/black fill can vanish on the store chrome.",
        boardId: board.id,
      });
    }
  }

  for (const [index, meta] of board.sliceMeta.entries()) {
    if (meta.alt === undefined || meta.alt.trim() === "") {
      issues.push({
        id: `${board.id}:slice-${index}:alt-missing`,
        severity: "warn",
        message: `Slice ${index + 1} has no alt text.`,
        boardId: board.id,
        fix: "edit-alt",
      });
    } else if (checkAltText(meta.alt).length > 0) {
      issues.push({
        id: `${board.id}:slice-${index}:alt-invalid`,
        severity: "error",
        message: `Slice ${index + 1} alt text: ${checkAltText(meta.alt)
          .map((issue) => issue.message)
          .join(" ")}`,
        boardId: board.id,
        fix: "edit-alt",
      });
    }
  }

  const count = board.sliceCount;
  if (project.store === "play") {
    if (board.kind === "phone") {
      if (count < 2) {
        issues.push({
          id: `${board.id}:count`,
          severity: "error",
          message: "Play needs at least 2 phone screenshots to publish.",
          boardId: board.id,
        });
      } else if (count < 4) {
        issues.push({
          id: `${board.id}:count`,
          severity: "warn",
          message: "4 phone screenshots are needed for screenshot-based promotion.",
          boardId: board.id,
        });
      }
      if (count > 8) {
        issues.push({
          id: `${board.id}:count`,
          severity: "warn",
          message: "More than 8 phone screenshots is not recommended.",
          boardId: board.id,
        });
      }
    }
    if (board.kind === "chromebook" && (count < 4 || count > 8)) {
      issues.push({
        id: `${board.id}:count`,
        severity: "warn",
        message: "Chromebook sections recommend 4–8 screenshots.",
        boardId: board.id,
      });
    }
  } else if (count < 1 || count > 10) {
    issues.push({
      id: `${board.id}:count`,
      severity: count > 10 ? "error" : "warn",
      message: "App Store allows 1–10 screenshots per display size.",
      boardId: board.id,
    });
  }

  return issues;
}

export function lintProject(project: StudioProject): LintIssue[] {
  return project.boards.flatMap((board) => lintBoard(project, board));
}

export function lintBoardById(project: StudioProject, boardId: string): LintIssue[] {
  const board = project.boards.find((candidate) => candidate.id === boardId);
  return board === undefined ? [] : lintBoard(project, board);
}

export function isTextNode(node: Node): node is TextNode {
  return node.type === "text";
}
