import { Circle, Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";

import { assetUrlForId } from "../../data-access-layer/assets";
import { fitScreen } from "../../model/geometry";
import { resolveColor, withAlpha } from "../../model/colors";
import type {
  FadeNode,
  Fill,
  GlowNode,
  ImageNode,
  Node,
  ShapeNode,
  TextNode,
} from "../../model/schema";
import { DeviceFrame } from "../../devices/frames/DeviceFrame";
import type { DeviceNode } from "../../model/schema";
import { useImage } from "./useImage";

export interface NodeViewProps {
  node: Node;
  tokens: Record<string, string>;
  selected: boolean;
  showCropGhost?: boolean | undefined;
  onSelect?: ((id: string, additive: boolean) => void) | undefined;
  onEditText?: ((id: string) => void) | undefined;
}

type HandlerProps = Pick<NodeViewProps, "onSelect" | "onEditText">;

function handlers(props: HandlerProps, id: string) {
  return {
    id,
    onClick: (event: { evt: MouseEvent }) => {
      props.onSelect?.(id, event.evt.shiftKey);
    },
    onTap: () => props.onSelect?.(id, false),
    draggable: true,
    // The Stage handles bubbled dragend events; this keeps react-konva quiet.
    onDragEnd: () => {},
  };
}

function gradientProps(fill: Fill, tokens: Record<string, string>, width: number, height: number) {
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
      fillLinearGradientStartPoint: {
        x: width / 2 - (Math.cos(rad) * width) / 2,
        y: height / 2 - (Math.sin(rad) * height) / 2,
      },
      fillLinearGradientEndPoint: {
        x: width / 2 + (Math.cos(rad) * width) / 2,
        y: height / 2 + (Math.sin(rad) * height) / 2,
      },
      fillLinearGradientColorStops: stops,
    };
  }
  return {
    fillRadialGradientStartPoint: { x: width / 2, y: height / 2 },
    fillRadialGradientEndPoint: { x: width / 2, y: height / 2 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.max(width, height) / 2,
    fillRadialGradientColorStops: stops,
  };
}

function ShapeView({ node, tokens, ...rest }: NodeViewProps & { node: ShapeNode }) {
  const props = {
    ...handlers(rest, node.id),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    opacity: node.opacity,
    ...gradientProps(node.fill, tokens, node.width, node.height),
    ...(node.shadow === undefined
      ? {}
      : {
          shadowColor: resolveColor(node.shadow.color, tokens),
          shadowBlur: node.shadow.blur,
          shadowOffsetX: node.shadow.offsetX,
          shadowOffsetY: node.shadow.offsetY,
        }),
  };
  if (node.shape === "ellipse") {
    return (
      <Ellipse
        {...props}
        radiusX={node.width / 2}
        radiusY={node.height / 2}
        x={node.x + node.width / 2}
        y={node.y + node.height / 2}
      />
    );
  }
  if (node.shape === "line") {
    return (
      <Line
        {...props}
        points={[0, node.height, node.width, 0]}
        stroke={resolveColor(node.fill.type === "solid" ? node.fill.color : "#ffffff", tokens)}
        strokeWidth={Math.max(2, node.height / 12)}
      />
    );
  }
  return <Rect {...props} cornerRadius={node.radius} />;
}

function GlowView({ node, tokens, ...rest }: NodeViewProps & { node: GlowNode }) {
  const color = resolveColor(node.color, tokens);
  return (
    <Circle
      {...handlers(rest, node.id)}
      x={node.x + node.width / 2}
      y={node.y + node.height / 2}
      radius={Math.max(node.width, node.height) / 2}
      rotation={node.rotation}
      opacity={node.opacity}
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={Math.max(node.width, node.height) / 2}
      fillRadialGradientColorStops={[
        0,
        withAlpha(color, 0.85),
        node.core,
        withAlpha(color, 0.5),
        1,
        withAlpha(color, 0),
      ]}
      listening={false}
    />
  );
}

function FadeView({ node, tokens, ...rest }: NodeViewProps & { node: FadeNode }) {
  const color = resolveColor(node.color, tokens);
  const rad = ((node.angle - 90) * Math.PI) / 180;
  return (
    <Rect
      {...handlers(rest, node.id)}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rotation={node.rotation}
      opacity={node.opacity}
      fillLinearGradientStartPoint={{
        x: node.width / 2 - (Math.cos(rad) * node.width) / 2,
        y: node.height / 2 - (Math.sin(rad) * node.height) / 2,
      }}
      fillLinearGradientEndPoint={{
        x: node.width / 2 + (Math.cos(rad) * node.width) / 2,
        y: node.height / 2 + (Math.sin(rad) * node.height) / 2,
      }}
      fillLinearGradientColorStops={[0, withAlpha(color, node.strength), 1, withAlpha(color, 0)]}
      listening={false}
    />
  );
}

function TextView({ node, tokens, ...rest }: NodeViewProps & { node: TextNode }) {
  return (
    <Text
      {...handlers(rest, node.id)}
      x={node.x}
      y={node.y}
      width={node.width}
      rotation={node.rotation}
      opacity={node.opacity}
      text={node.text}
      fontFamily={node.font.family}
      fontSize={node.font.size}
      fontStyle={node.font.weight >= 600 ? "bold" : "normal"}
      lineHeight={node.lineHeight}
      align={node.align}
      fill={resolveColor(node.color, tokens)}
      onDblClick={() => rest.onEditText?.(node.id)}
      onDblTap={() => rest.onEditText?.(node.id)}
    />
  );
}

function ImageView({ node, ...rest }: NodeViewProps & { node: ImageNode }) {
  const url = assetUrlForId(node.assetId);
  const image = useImage(url);
  if (image === undefined) {
    return (
      <Rect
        {...handlers(rest, node.id)}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill="#2a2c2a"
        dash={[10, 8]}
      />
    );
  }
  const fit = fitScreen(
    image.naturalWidth,
    image.naturalHeight,
    { top: 0, bottom: 0, left: 0, right: 0 },
    { x: 0, y: 0, width: node.width, height: node.height },
    node.fit,
    1,
    { x: 0, y: 0 },
  );
  return (
    <Group
      {...handlers(rest, node.id)}
      x={node.x}
      y={node.y}
      rotation={node.rotation}
      opacity={node.opacity}
    >
      <Group
        clipFunc={(ctx) => {
          const c = ctx as unknown as CanvasRenderingContext2D;
          c.beginPath();
          if (node.mask === "ellipse")
            c.ellipse(
              node.width / 2,
              node.height / 2,
              node.width / 2,
              node.height / 2,
              0,
              0,
              Math.PI * 2,
            );
          else if (node.mask === "rounded") c.roundRect(0, 0, node.width, node.height, node.radius);
          else c.rect(0, 0, node.width, node.height);
          c.closePath();
        }}
      >
        <KonvaImage
          image={image}
          x={fit.target.x}
          y={fit.target.y}
          width={fit.target.width}
          height={fit.target.height}
          crop={fit.source}
        />
      </Group>
    </Group>
  );
}

function DeviceView(props: NodeViewProps & { node: DeviceNode }) {
  const { node, ...rest } = props;
  const url = assetUrlForId(node.content.assetId);
  const image = useImage(url);
  return (
    <Group
      {...handlers(rest, node.id)}
      x={node.x}
      y={node.y}
      rotation={node.rotation}
      opacity={node.opacity}
    >
      <DeviceFrame node={node} image={image} showCropGhost={rest.showCropGhost && rest.selected} />
    </Group>
  );
}

export function NodeView(props: NodeViewProps) {
  const { node } = props;
  if (node.hidden === true) return null;
  switch (node.type) {
    case "device":
      return <DeviceView {...props} node={node} />;
    case "image":
      return <ImageView {...props} node={node} />;
    case "text":
      return <TextView {...props} node={node} />;
    case "shape":
      return <ShapeView {...props} node={node} />;
    case "glow":
      return <GlowView {...props} node={node} />;
    case "fade":
      return <FadeView {...props} node={node} />;
    case "group":
      return (
        <Group
          {...handlers(props, node.id)}
          x={node.x}
          y={node.y}
          rotation={node.rotation}
          opacity={node.opacity}
        >
          {node.children.map((child) => (
            <NodeView key={child.id} {...props} node={child} />
          ))}
        </Group>
      );
    default:
      return null;
  }
}
