import { Circle, Group, Image as KonvaImage, Line, Rect } from "react-konva";

import { fitScreen, type ScreenFit } from "../../model/geometry";
import type { DeviceNode } from "../../model/schema";
import { deviceModel, type DeviceModel } from "../catalog";

export interface DeviceFrameProps {
  node: DeviceNode;
  image?: HTMLImageElement | undefined;
  screenFit?: ScreenFit | undefined;
  /** Draw the ghosted overflow and dashed bounds (editor only). */
  showCropGhost?: boolean | undefined;
}

function roundedClip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function Overlays({ model }: { model: DeviceModel }) {
  const { w, h } = model.frame;
  return (
    <Group listening={false}>
      {model.overlays.map((overlay, index) => {
        switch (overlay.kind) {
          case "punch-hole":
            return (
              <Circle
                key={index}
                x={overlay.x}
                y={overlay.y}
                radius={overlay.size / 2}
                fill="#050506"
              />
            );
          case "camera":
            return (
              <Circle
                key={index}
                x={overlay.x}
                y={overlay.y}
                radius={overlay.size / 2}
                fill="#1a1c20"
              />
            );
          case "island":
            return (
              <Rect
                key={index}
                x={overlay.x - overlay.size / 2}
                y={overlay.y - overlay.size / 4}
                width={overlay.size}
                height={overlay.size / 2}
                cornerRadius={overlay.size / 4}
                fill="#050506"
              />
            );
          case "notch":
            return (
              <Rect
                key={index}
                x={overlay.x - overlay.size / 2}
                y={0}
                width={overlay.size}
                height={overlay.size / 2}
                cornerRadius={[0, 0, overlay.size / 3, overlay.size / 3]}
                fill="#050506"
              />
            );
          case "hinge":
            return (
              <Line
                key={index}
                points={[overlay.x, 0, overlay.x, h]}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={overlay.size}
              />
            );
          case "browser-chrome":
            return (
              <Group key={index}>
                <Rect x={0} y={0} width={w} height={overlay.size} fill="#2b2d30" />
                <Circle x={28} y={overlay.size / 2} radius={7} fill="#ff5f57" />
                <Circle x={52} y={overlay.size / 2} radius={7} fill="#febc2e" />
                <Circle x={76} y={overlay.size / 2} radius={7} fill="#28c840" />
              </Group>
            );
          case "laptop-deck":
            return (
              <Line
                key={index}
                points={[
                  -w * 0.08,
                  h,
                  w * 1.08,
                  h,
                  w * 1.14,
                  h + h * 0.12,
                  -w * 0.14,
                  h + h * 0.12,
                ]}
                closed
                fill="#b9bbb7"
                stroke="#9b9d99"
                strokeWidth={2}
              />
            );
          case "stand":
            return (
              <Group key={index}>
                <Rect x={w / 2 - 18} y={h} width={36} height={h * 0.09} fill="#a9aba7" />
                <Rect
                  x={w / 2 - 90}
                  y={h + h * 0.09}
                  width={180}
                  height={10}
                  cornerRadius={5}
                  fill="#a9aba7"
                />
              </Group>
            );
          default:
            return null;
        }
      })}
    </Group>
  );
}

/** Pure vector device: frame → clipped, pinned capture → overlays → frame edge. */
export function DeviceFrame({ node, image, screenFit, showCropGhost = false }: DeviceFrameProps) {
  const model = deviceModel(node.model);
  const scheme = model.colours[node.color];
  const { w, h } = model.frame;
  const screen = {
    x: (model.screen.x / w) * node.width,
    y: (model.screen.y / w) * node.width,
    width: (model.screen.w / w) * node.width,
    height: (model.screen.h / h) * node.height,
    radius: (model.screen.radius / w) * node.width,
  };
  const fit =
    screenFit ??
    (image === undefined
      ? undefined
      : fitScreen(
          image.naturalWidth,
          image.naturalHeight,
          node.content.trim,
          screen,
          node.content.fit,
          node.content.zoom,
          node.content.offset,
        ));

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        cornerRadius={model.frame.radius * (node.width / w)}
        fill={scheme.frame}
        stroke={scheme.edge}
        strokeWidth={2}
      />
      <Group
        clipFunc={(ctx) =>
          roundedClip(
            ctx as unknown as CanvasRenderingContext2D,
            screen.x,
            screen.y,
            screen.width,
            screen.height,
            screen.radius,
          )
        }
      >
        <Rect
          x={screen.x}
          y={screen.y}
          width={screen.width}
          height={screen.height}
          fill={scheme.screenBg}
        />
        {image !== undefined && fit !== undefined ? (
          <KonvaImage
            image={image}
            x={fit.target.x}
            y={fit.target.y}
            width={fit.target.width}
            height={fit.target.height}
            crop={{
              x: fit.source.x,
              y: fit.source.y,
              width: fit.source.width,
              height: fit.source.height,
            }}
          />
        ) : null}
      </Group>
      {showCropGhost && image !== undefined && fit !== undefined ? (
        <Group listening={false}>
          <Rect
            x={fit.target.x}
            y={fit.target.y}
            width={fit.target.width}
            height={fit.target.height}
            stroke="#ffb86b"
            strokeWidth={2}
            dash={[8, 6]}
            opacity={0.6}
          />
          <Rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            stroke="#4ade80"
            strokeWidth={3}
          />
        </Group>
      ) : null}
      <Group scaleX={node.width / w} scaleY={node.height / h}>
        <Overlays model={model} />
      </Group>
      {node.statusBar === "clean" && model.formFactor === "phone" ? (
        <Group listening={false} scaleX={node.width / w} scaleY={node.height / h}>
          <Rect
            x={w / 2 - 60}
            y={18}
            width={120}
            height={12}
            cornerRadius={6}
            fill="#050506"
            opacity={0.9}
          />
        </Group>
      ) : null}
    </Group>
  );
}
