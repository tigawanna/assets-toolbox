import { Image as KonvaImage, Rect } from "react-konva";

import { BandView } from "@/canvas/band-view";
import { NodeView } from "@/canvas/node-view";
import { useImage } from "@/canvas/use-image";
import { bandCovering, sliceSelectionId } from "@/lib/bands";
import { collectionSelectionId } from "@/lib/scenes";
import {
  assetUrl,
  boardFillFor,
  boardSize,
  stackNodes,
  type AssetRow,
  type BoardRow,
  type StudioNode,
} from "@/lib/studio";

export function BoardContent({
  board,
  nodes,
  assets,
  interactive = true,
  panning = false,
  collectionId,
  onSelect,
}: {
  board: BoardRow;
  nodes: StudioNode[];
  assets: AssetRow[];
  interactive?: boolean;
  panning?: boolean;
  collectionId?: string;
  onSelect: (id: string | null) => void;
}) {
  const preset = boardSize(board);
  const boardWidth = preset.width * board.sliceCount;
  const boardHeight = preset.height;
  const fill = boardFillFor(board);
  const boardImage = useImage(assetUrl(assets, fill.imageId));
  const pick = interactive ? onSelect : () => {};
  return (
    <>
      <Rect
        id={collectionId === undefined ? board.id : collectionSelectionId(collectionId)}
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        fill={fill.color}
        listening={interactive}
        onMouseDown={(event) => {
          event.cancelBubble = true;
          pick(collectionId === undefined ? board.id : collectionSelectionId(collectionId));
        }}
      />
      {boardImage === undefined ? null : (
        <KonvaImage
          image={boardImage}
          x={0}
          y={0}
          width={boardWidth}
          height={boardHeight}
          listening={false}
        />
      )}
      {fill.bands.map((band) => (
        <BandView
          key={band.id}
          band={band}
          sliceWidth={preset.width}
          height={boardHeight}
          assets={assets}
          onSelect={pick}
        />
      ))}
      {interactive
        ? Array.from({ length: board.sliceCount }, (_, index) =>
            bandCovering(fill.bands, index) === undefined ? (
              <Rect
                key={`slice-hit-${index}`}
                id={sliceSelectionId(collectionId ?? board.id, index)}
                x={index * preset.width}
                y={0}
                width={preset.width}
                height={boardHeight}
                fill="rgba(0,0,0,0)"
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  pick(sliceSelectionId(collectionId ?? board.id, index));
                }}
              />
            ) : null,
          )
        : null}
      {stackNodes(nodes).map((node) => (
        <NodeView
          key={node.id}
          node={node}
          assets={assets}
          panning={panning || !interactive}
          onSelect={pick}
        />
      ))}
    </>
  );
}
