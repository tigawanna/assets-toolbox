import { Group, Image as KonvaImage, Rect } from "react-konva";

import { useImage } from "@/canvas/use-image";
import { bandSelectionId, type SliceBand } from "@/lib/bands";
import { assetUrl, type AssetRow } from "@/lib/studio";

function coverFit(
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (sourceWidth < 1 || sourceHeight < 1) return box;
  const scale = Math.max(box.width / sourceWidth, box.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

export function BandView({
  band,
  sliceWidth,
  height,
  assets,
  onSelect,
}: {
  band: SliceBand;
  sliceWidth: number;
  height: number;
  assets: AssetRow[];
  onSelect: (id: string) => void;
}) {
  const image = useImage(assetUrl(assets, band.imageId));
  const box = {
    x: band.start * sliceWidth,
    y: 0,
    width: band.count * sliceWidth,
    height,
  };
  const fitted = image === undefined ? box : coverFit(image, box);
  return (
    <Group>
      <Rect
        id={bandSelectionId(band.id)}
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={band.color}
        onMouseDown={(event) => {
          event.cancelBubble = true;
          onSelect(bandSelectionId(band.id));
        }}
      />
      {image === undefined ? null : (
        <Group
          listening={false}
          clipFunc={(ctx) => {
            ctx.rect(box.x, box.y, box.width, box.height);
          }}
        >
          <KonvaImage
            image={image}
            x={fitted.x}
            y={fitted.y}
            width={fitted.width}
            height={fitted.height}
          />
        </Group>
      )}
    </Group>
  );
}
