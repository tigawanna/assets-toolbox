import { Circle, Group, Image as KonvaImage, Line, Rect } from "react-konva";

import { useImage } from "@/canvas/use-image";
import { assetUrl, deviceRadii, type AssetRow, type DeviceNode } from "@/lib/studio";

import { deviceModel, type DeviceModel } from "./catalog";

export function roundedClip(
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
          default:
            return null;
        }
      })}
    </Group>
  );
}

export function DeviceFrame({ node, assets }: { node: DeviceNode; assets: AssetRow[] }) {
  const model = deviceModel(node.model);
  const scheme = model.colours[node.color];
  const screenImage = useImage(assetUrl(assets, node.screenAssetId));
  const { w, h } = model.frame;
  const radii = deviceRadii(node);
  const screen = {
    x: (model.screen.x / w) * node.width,
    y: (model.screen.y / h) * node.height,
    width: (model.screen.w / w) * node.width,
    height: (model.screen.h / h) * node.height,
    radius: radii.screen,
  };
  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={node.width}
        height={node.height}
        cornerRadius={radii.frame}
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
          fill={node.screenColor ?? scheme.screenBg}
        />
        {screenImage === undefined ? null : (
          <KonvaImage
            image={screenImage}
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
          />
        )}
      </Group>
      <Group scaleX={node.width / w} scaleY={node.height / h}>
        <Overlays model={model} />
      </Group>
    </Group>
  );
}
