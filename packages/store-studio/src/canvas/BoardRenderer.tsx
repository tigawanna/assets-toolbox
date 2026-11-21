import { Group, Rect } from "react-konva";
import { getPreset } from "@tigawanna/play-screenshots/sizes";

import type { Board } from "../model/schema";
import { resolveColor } from "../model/colors";
import { NodeView } from "./nodes/NodeView";

export interface BoardRendererProps {
  board: Board;
  tokens: Record<string, string>;
  /** Export shifts the whole board by -i·sliceWidth. */
  offsetX?: number | undefined;
  selectedIds?: string[] | undefined;
  showCropGhost?: boolean | undefined;
  onSelect?: ((id: string, additive: boolean) => void) | undefined;
  onEditText?: ((id: string) => void) | undefined;
}

function backgroundProps(board: Board, tokens: Record<string, string>) {
  const fill = board.background;
  if (fill.type === "solid") return { fill: resolveColor(fill.color, tokens) };
  if (fill.type === "image") return { fill: "#333333" };
  const stops: Array<number | string> = [];
  for (const stop of fill.stops) {
    stops.push(stop.offset);
    stops.push(resolveColor(stop.color, tokens));
  }
  if (fill.type === "linear") {
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: Math.cos(rad) * 2000, y: Math.sin(rad) * 2000 },
      fillLinearGradientColorStops: stops,
    };
  }
  return {
    fillRadialGradientStartPoint: { x: 1000, y: 800 },
    fillRadialGradientEndPoint: { x: 1000, y: 800 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 2400,
    fillRadialGradientColorStops: stops,
  };
}

/** Pure (board, tokens) → Konva tree. Shared by the viewport and the export stage. */
export function BoardRenderer({
  board,
  tokens,
  offsetX = 0,
  selectedIds = [],
  showCropGhost = false,
  onSelect,
  onEditText,
}: BoardRendererProps) {
  const preset = getPreset(board.preset);
  return (
    <Group x={-offsetX}>
      <Rect
        x={0}
        y={0}
        width={preset.width}
        height={preset.height}
        listening={false}
        {...backgroundProps(board, tokens)}
      />
      {board.nodes.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          tokens={tokens}
          selected={selectedIds.includes(node.id)}
          showCropGhost={showCropGhost}
          onSelect={onSelect}
          onEditText={onEditText}
        />
      ))}
    </Group>
  );
}
