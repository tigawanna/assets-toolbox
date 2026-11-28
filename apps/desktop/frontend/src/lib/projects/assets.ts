import { useCallback, useEffect, useState } from "react";

import { getProjectClient } from "./client";
import { useProject } from "./context";
import type { AssetId, AssetRecord, ProjectId } from "./types";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function useProjectAssets() {
  const { projectId, refresh } = useProject();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await getProjectClient().listAssets(projectId));
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [projectId, refresh]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (file: File) => {
      const dataUrl = await readAsDataUrl(file);
      const base64 = dataUrl.split(",").at(-1) ?? "";
      await getProjectClient().addAsset(projectId, {
        name: file.name,
        mime: file.type || "application/octet-stream",
        base64,
      });
      await reload();
    },
    [projectId, reload],
  );

  const removeMany = useCallback(
    async (assetIds: AssetId[]) => {
      await Promise.all(
        assetIds.map((assetId) => getProjectClient().deleteAsset(projectId, assetId)),
      );
      await reload();
    },
    [projectId, reload],
  );

  const remove = useCallback(
    async (assetId: AssetId) => {
      await removeMany([assetId]);
    },
    [removeMany],
  );

  const move = useCallback(
    async (assetIds: AssetId[], targetProjectId: ProjectId, mode: "copy" | "move") => {
      const moved = await getProjectClient().moveAssets(projectId, {
        assetIds,
        targetProjectId,
        mode,
        includeDerived: true,
      });
      await reload();
      return moved;
    },
    [projectId, reload],
  );

  const preview = useCallback(
    async (asset: AssetRecord) => {
      const base64 = await getProjectClient().getAssetBlob(projectId, asset.id);
      return `data:${asset.mime};base64,${base64}`;
    },
    [projectId],
  );

  return { assets, loading, add, remove, removeMany, move, preview, reload };
}
