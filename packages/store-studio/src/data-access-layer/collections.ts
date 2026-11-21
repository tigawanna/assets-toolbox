import { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  PLAY_STORE_PRESETS,
  PLAY_STORE_PRESET_IDS,
  type PlayStorePreset,
} from "@tigawanna/play-screenshots/sizes";

import type { Board, Node } from "../model/schema";
import { getCurrentProject, subscribeCollections } from "./project";

export const queryClient = new QueryClient();

/** Rows the collections expose. Writes still go through `updateProject` in the DAL. */
export interface AssetRow {
  id: string;
  file: string;
  width: number;
  height: number;
  kind: "screenshot" | "image" | "icon";
}

export const boardsCollection = createCollection(
  queryCollectionOptions<Board>({
    id: "boards",
    queryKey: ["boards"],
    queryClient,
    queryFn: async () => getCurrentProject().boards,
    getKey: (board) => board.id,
  }),
);

export const nodesCollection = createCollection(
  queryCollectionOptions<Node>({
    id: "nodes",
    queryKey: ["nodes"],
    queryClient,
    queryFn: async () => getCurrentProject().boards.flatMap((board) => board.nodes) as Node[],
    getKey: (node) => node.id,
  }),
);

export const assetsCollection = createCollection(
  queryCollectionOptions<AssetRow>({
    id: "assets",
    queryKey: ["assets"],
    queryClient,
    queryFn: async () => {
      const assets = getCurrentProject().assets;
      return Object.entries(assets).map(([id, record]) => ({
        id,
        file: record.file,
        width: record.width,
        height: record.height,
        kind: record.kind,
      }));
    },
    getKey: (asset) => asset.id,
  }),
);

export const presetsCollection = createCollection(
  queryCollectionOptions<PlayStorePreset & { id: string }>({
    id: "presets",
    queryKey: ["presets"],
    queryClient,
    queryFn: async () =>
      PLAY_STORE_PRESET_IDS.map((presetId) => ({
        ...PLAY_STORE_PRESETS[presetId],
        id: presetId,
      })),
    getKey: (preset) => preset.id,
  }),
);

export const fontsCollection = createCollection(
  queryCollectionOptions<{ id: string; family: string }>({
    id: "fonts",
    queryKey: ["fonts"],
    queryClient,
    queryFn: async () => [{ id: "inter", family: "Inter" }],
    getKey: (font) => font.id,
  }),
);

// The DAL commits a new document after every gesture; refresh the live queries.
subscribeCollections(() => {
  void queryClient.invalidateQueries();
});

export type PresetRow = PlayStorePreset & { id: string };
