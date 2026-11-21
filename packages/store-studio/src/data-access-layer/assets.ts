import { getHost } from "./host";
import type { AssetRecordDTO } from "./host";
import { getCurrentProject, updateProject } from "./project";

export async function importAsset(file: File): Promise<AssetRecordDTO> {
  const record = await getHost().importAsset(file);
  updateProject((draft) => {
    draft.assets[record.id] = {
      file: record.file,
      width: record.width,
      height: record.height,
      kind: record.kind,
      ...(record.intrinsic === undefined ? {} : { intrinsic: record.intrinsic }),
    };
  });
  return record;
}

export function assetUrl(file: string): string {
  return getHost().assetUrl(file);
}

export function assetUrlForId(id: string): string {
  const record = getCurrentProject().assets[id];
  return record === undefined ? "" : assetUrl(record.file);
}

export function assetForId(id: string) {
  return getCurrentProject().assets[id];
}
