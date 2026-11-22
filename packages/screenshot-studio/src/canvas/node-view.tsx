import { Circle, Ellipse, Group, Image as KonvaImage, Line, Rect, Star, Text } from "react-konva";

import { useImage } from "@/canvas/use-image";
import { DeviceFrame, roundedClip } from "@/devices/device-frame";
import type { AssetRow, LineNode, LinePointEdit, ShapeNode, StudioNode } from "@/lib/studio";
import { assetUrl } from "@/lib/studio";

interface NodeViewProps {
  node: StudioNode;
  assets: AssetRow[];
  panning: boolean;
  onSelect: (id: string) => void;
  selected?: boolean;
  onLineEdit?: (id: string, edit: LinePointEdit) => void;
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

function cornerRadius(node: ShapeNode): number {
  if (node.shape === "pill") return Math.min(node.width, node.height) / 2;
  return Math.max(0, node.radius);
}

function clipToShape(ctx: CanvasRenderingContext2D, node: ShapeNode): void {
  const w = node.width;
  const h = node.height;
  if (node.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  if (node.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    return;
  }
  if (node.shape === "star") {
    const cx = w / 2;
    const cy = h / 2;
    const outer = Math.min(w, h) / 2;
    const inner = outer * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? outer : inner;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  roundedClip(ctx, 0, 0, w, h, cornerRadius(node));
}

function ImageShapeNode({ node, assets, panning, onSelect }: NodeViewProps & { node: ShapeNode }) {
  const image = useImage(assetUrl(assets, node.imageId));
  return (
    <Group
      {...handlers(node, panning, onSelect)}
      width={node.width}
      height={node.height}
      clipFunc={(ctx) => clipToShape(ctx as unknown as CanvasRenderingContext2D, node)}
    >
      {image === undefined ? (
        <SolidShape node={node} />
      ) : (
        <KonvaImage image={image} width={node.width} height={node.height} />
      )}
    </Group>
  );
}

function SolidShape({ node }: { node: ShapeNode }) {
  const w = node.width;
  const h = node.height;
  if (node.shape === "ellipse") {
    return <Ellipse radiusX={w / 2} radiusY={h / 2} x={w / 2} y={h / 2} fill={node.fill} />;
  }
  if (node.shape === "triangle") {
    return <Line points={[w / 2, 0, w, h, 0, h]} closed fill={node.fill} />;
  }
  if (node.shape === "star") {
    const outer = Math.min(w, h) / 2;
    return (
      <Star
        numPoints={5}
        innerRadius={outer * 0.45}
        outerRadius={outer}
        x={w / 2}
        y={h / 2}
        fill={node.fill}
      />
    );
  }
  return <Rect width={w} height={h} fill={node.fill} cornerRadius={cornerRadius(node)} />;
}

function LineNodeView({
  node,
  panning,
  onSelect,
  selected = false,
  onLineEdit,
}: NodeViewProps & { node: LineNode }) {
  const flat = node.points.flatMap((point) => [point.x, point.y]);
  const editing = selected && !panning && onLineEdit !== undefined && !node.locked;
  return (
    <Group {...handlers(node, panning, onSelect)} width={node.width} height={node.height}>
      <Line
        points={flat}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
        tension={node.smooth ? (node.tension ?? 0.4) * 2 : 0}
        bezier={node.smooth}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={Math.max(18, node.strokeWidth * 2)}
      />
      {editing
        ? node.points.map((point, index) => (
            <Circle
              key={`point-${index}`}
              x={point.x}
              y={point.y}
              radius={7}
              fill="#121a14"
              stroke="#bef264"
              strokeWidth={2.5}
              draggable
              onDragEnd={(event) =>
                onLineEdit(node.id, {
                  type: "move",
                  index,
                  point: { x: Math.round(event.target.x()), y: Math.round(event.target.y()) },
                })
              }
              onDblClick={() =>
                node.points.length > 2 && onLineEdit(node.id, { type: "remove", index })
              }
              onDblTap={() =>
                node.points.length > 2 && onLineEdit(node.id, { type: "remove", index })
              }
            />
          ))
        : null}
      {editing
        ? node.points.slice(0, -1).map((point, index) => {
            const next = node.points[index + 1]!;
            return (
              <Circle
                key={`segment-${index}`}
                x={(point.x + next.x) / 2}
                y={(point.y + next.y) / 2}
                radius={5}
                fill="#bef264"
                fillOpacity={0.5}
                stroke="#121a14"
                strokeWidth={1.5}
                draggable
                onDragEnd={(event) =>
                  onLineEdit(node.id, {
                    type: "insert",
                    index,
                    point: { x: Math.round(event.target.x()), y: Math.round(event.target.y()) },
                  })
                }
              />
            );
          })
        : null}
    </Group>
  );
}

export function NodeView({ node, assets, panning, onSelect, selected, onLineEdit }: NodeViewProps) {
  if (node.hidden) return null;
  if (node.type === "device") {
    return (
      <Group {...handlers(node, panning, onSelect)} width={node.width} height={node.height}>
        <DeviceFrame node={node} assets={assets} />
      </Group>
    );
  }
  if (node.type === "line") {
    return (
      <LineNodeView
        node={node}
        assets={assets}
        panning={panning}
        onSelect={onSelect}
        selected={selected}
        onLineEdit={onLineEdit}
      />
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
  if (node.imageId !== undefined && node.imageId !== "") {
    return <ImageShapeNode node={node} assets={assets} panning={panning} onSelect={onSelect} />;
  }
  return (
    <Group {...handlers(node, panning, onSelect)} width={node.width} height={node.height}>
      <SolidShape node={node} />
    </Group>
  );
}
