import { Group, Line, Rect, Text } from "react-konva";
import { FEATURE_GRAPHIC_SAFE_MARGIN } from "@tigawanna/play-screenshots/policy";

import type { Board } from "../../model/schema";

export interface GuidesProps {
  board: Board;
  width: number;
  height: number;
  showSliceGuides: boolean;
  showSafeZones: boolean;
  showStoreCrop: boolean;
}

/** Non-exported overlay layer: slice lines + numbers, safe zones, approximate store crop. */
export function Overlays({
  board,
  width,
  height,
  showSliceGuides,
  showSafeZones,
  showStoreCrop,
}: GuidesProps) {
  return (
    <Group listening={false}>
      {showSliceGuides
        ? Array.from({ length: board.sliceCount + 1 }, (_, index) => (
            <Group key={index}>
              <Line
                points={[index * width, 0, index * width, height]}
                stroke="#ffb86b"
                strokeWidth={2}
                dash={[10, 8]}
                opacity={index === 0 || index === board.sliceCount ? 0.35 : 0.9}
              />
              {index < board.sliceCount ? (
                <Text
                  x={index * width + 12}
                  y={12}
                  text={`${index + 1}`}
                  fontSize={28}
                  fontFamily="Inter"
                  fontStyle="bold"
                  fill="#ffb86b"
                  opacity={0.85}
                />
              ) : null}
            </Group>
          ))
        : null}

      {showStoreCrop ? (
        <Rect
          x={0}
          y={0}
          width={board.sliceCount * width}
          height={height}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={4}
          cornerRadius={28}
          dash={[14, 10]}
        />
      ) : null}

      {showSafeZones ? (
        <Group>
          <Rect
            x={0}
            y={0}
            width={width * FEATURE_GRAPHIC_SAFE_MARGIN}
            height={height}
            fill="rgba(255,0,90,0.12)"
          />
          <Rect
            x={width * (1 - FEATURE_GRAPHIC_SAFE_MARGIN)}
            y={0}
            width={width * FEATURE_GRAPHIC_SAFE_MARGIN}
            height={height}
            fill="rgba(255,0,90,0.12)"
          />
          <Rect x={0} y={0} width={width} height={height * 0.2} fill="rgba(90,160,255,0.10)" />
          <Text
            x={12}
            y={height * 0.2 + 8}
            text="20% tagline guide (approx.)"
            fontSize={18}
            fill="#7aa7ff"
          />
        </Group>
      ) : null}
    </Group>
  );
}
