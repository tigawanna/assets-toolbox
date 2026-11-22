import { Ellipse, Group, Rect, Text } from "react-konva";

import { DeviceFrame } from "@/devices/device-frame";
import type { AssetRow, StudioNode } from "@/lib/studio";

interface NodeViewProps {
  node: StudioNode;
  assets: AssetRow[];
  panning: boolean;
  onSelect: (id: string) => void;
}

function handlers(node: StudioNode, panning: boolean, onSelect: (id: string) => void) {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    rotation: node.rotation,
    opacity: node.opacity,
    draggable: !node.locked && !panning,
    onClick: () => onSelect(node.id),
    onTap: () => onSelect(node.id),
    onDragEnd: () => {},
  };
}

export function NodeView({ node, assets, panning, onSelect }: NodeViewProps) {
  if (node.hidden) return null;
  if (node.type === "device") {
    return (
      <Group {...handlers(node, panning, onSelect)} width={node.width} height={node.height}>
        <DeviceFrame node={node} assets={assets} />
      </Group>
    );
  }
  if (node.type === "text") {
    return (
      <Text
        {...handlers(node, panning, onSelect)}
        width={node.width}
        height={node.height}
        text={node.text}
        fontSize={node.fontSize}
        fontStyle={node.fontWeight >= 600 ? "bold" : "normal"}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        align={node.align}
        fill={node.color}
      />
    );
  }
  if (node.shape === "ellipse") {
    return (
      <Ellipse
        {...handlers(node, panning, onSelect)}
        radiusX={node.width / 2}
        radiusY={node.height / 2}
        x={node.x + node.width / 2}
        y={node.y + node.height / 2}
        fill={node.fill}
      />
    );
  }
  return (
    <Rect
      {...handlers(node, panning, onSelect)}
      width={node.width}
      height={node.height}
      fill={node.fill}
      cornerRadius={node.radius}
    />
  );
}
