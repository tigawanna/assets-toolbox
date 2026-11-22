import { describe, expect, it } from "vite-plus/test";

import {
  applyStoreRules,
  cloneSceneCollection,
  deviceForStore,
  duplicateBoardName,
  presetForStore,
  variantBoardName,
} from "../src/lib/store-rules";
import {
  applyCollectionHandleDrag,
  boardBounds,
  boardCollections,
  COLLECTION_HANDLE,
  collectionOrigin,
  fitCamera,
  patchCollection,
  removeSceneCollection,
} from "../src/lib/scenes";
import {
  createDeviceNode,
  defaultBoard,
  deviceAspectLocked,
  deviceLooksStretched,
  layerOrder,
  moveLayer,
  nextStackZ,
  resizeDevice,
  restoreDeviceAspect,
  retargetDevice,
  stackNodes,
} from "../src/lib/studio";

describe("retargetDevice", () => {
  it("swaps the model, keeps height, and recentres", () => {
    const node = createDeviceNode("foldable-open", defaultBoard());
    const next = retargetDevice(node, "phone-punch");
    expect(next.model).toBe("phone-punch");
    expect(next.name).toBe("Phone · punch hole");
    expect(next.height).toBeUndefined();
    expect(next.width).toBeLessThan(node.width);
    expect(next.x).toBeGreaterThan(node.x);
  });

  it("keeps a custom name", () => {
    const node = { ...createDeviceNode("phone-flat", defaultBoard()), name: "Hero shot" };
    expect(retargetDevice(node, "ipad").name).toBe("Hero shot");
  });

  it("no-ops when the model is unchanged", () => {
    const node = createDeviceNode("tablet", defaultBoard());
    expect(retargetDevice(node, "tablet")).toEqual({});
  });
});

describe("device aspect", () => {
  it("locks new devices and treats missing flags as locked", () => {
    const node = createDeviceNode("phone-punch", defaultBoard());
    expect(node.aspectLocked).toBe(true);
    expect(deviceAspectLocked(node)).toBe(true);
    expect(deviceAspectLocked({ ...node, aspectLocked: undefined })).toBe(true);
    expect(deviceAspectLocked({ ...node, aspectLocked: false })).toBe(false);
  });

  it("keeps ratio when resizing a locked device", () => {
    const node = createDeviceNode("iphone-island", defaultBoard());
    const next = resizeDevice(node, "height", node.height * 2);
    expect(next.height).toBe(node.height * 2);
    expect((next.width ?? 0) / (next.height ?? 1)).toBeCloseTo(node.width / node.height, 2);
  });

  it("restores a stretched frame and re-locks it", () => {
    const node = {
      ...createDeviceNode("phone-punch", defaultBoard()),
      width: 900,
      aspectLocked: false,
    };
    expect(deviceLooksStretched(node)).toBe(true);
    const next = restoreDeviceAspect(node);
    expect(deviceLooksStretched({ ...node, ...next })).toBe(false);
    expect(next.aspectLocked).toBe(true);
  });
});

describe("store rules", () => {
  it("names a clone for Apple or Android", () => {
    expect(variantBoardName("Hero phones", "app-store")).toBe("Hero phones · Apple");
    expect(variantBoardName("Hero phones · Apple", "play")).toBe("Hero phones · Android");
    expect(duplicateBoardName("Hero phones")).toBe("Hero phones copy");
  });

  it("maps Play phone portrait to App Store 6.9", () => {
    const board = defaultBoard("Hero");
    expect(presetForStore(board, "app-store")).toBe("iphone-6-9");
    expect(presetForStore({ ...board, store: "app-store", presetId: "iphone-6-9" }, "play")).toBe(
      "phone-portrait",
    );
  });

  it("swaps Android frames to iPhone when targeting Apple", () => {
    expect(deviceForStore("phone-punch", "app-store")).toBe("iphone-island");
    expect(deviceForStore("tablet", "app-store")).toBe("ipad");
    expect(deviceForStore("iphone-island", "play")).toBe("phone-punch");
    expect(deviceForStore("laptop", "app-store")).toBe("laptop");
  });

  it("resizes the board and retargets Android frames to iPhone", () => {
    const board = { ...defaultBoard("Launch"), sliceCount: 5 };
    const phone = createDeviceNode("phone-punch", board, 0);
    const next = applyStoreRules({ board, nodes: [phone] }, "app-store");
    expect(next.board.store).toBe("app-store");
    expect(next.board.presetId).toBe("iphone-6-9");
    expect(next.board.sliceCount).toBe(5);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0]?.type).toBe("device");
    if (next.nodes[0]?.type === "device") {
      expect(next.nodes[0].model).toBe("iphone-island");
      expect(next.nodes[0].height).toBeGreaterThan(phone.height);
    }
  });

  it("clones a scene strip onto the same board instead of a new project", () => {
    const board = defaultBoard("Launch");
    const phone = createDeviceNode("phone-punch", board, 0);
    const next = cloneSceneCollection(board, [phone], "col-main", "app-store");
    const collections = boardCollections(next.board);
    expect(collections).toHaveLength(2);
    expect(collections[0]?.store).toBe("play");
    expect(collections[1]?.store).toBe("app-store");
    expect(collections[1]?.name).toBe("Scenes · Apple");
    expect(next.board.name).toBe("Launch");
    expect(next.nodes).toHaveLength(2);
    expect(next.nodes[0]?.collectionId).toBe("col-main");
    expect(next.nodes[1]?.collectionId).toBe(collections[1]?.id);
    expect(next.nodes[1]?.collectionId).not.toBe("col-main");
    const source = collectionOrigin(next.board, "col-main");
    expect(collections[1]?.x).toBe(source.x);
    expect(collections[1]?.y).toBeGreaterThan(source.y);
  });

  it("removes a cloned strip and its nodes", () => {
    const board = defaultBoard("Launch");
    const phone = createDeviceNode("phone-punch", board, 0);
    const cloned = cloneSceneCollection(board, [phone], "col-main");
    const extra = boardCollections(cloned.board)[1];
    expect(extra).toBeDefined();
    const next = removeSceneCollection(cloned.board, cloned.nodes, extra!.id);
    expect(boardCollections(next.board)).toHaveLength(1);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0]?.collectionId).toBe("col-main");
  });

  it("keeps a filmstrip where you dragged it", () => {
    const board = patchCollection(defaultBoard("Launch"), "col-main", { x: 80, y: 400 });
    expect(collectionOrigin(board, "col-main")).toEqual({ x: 80, y: 400 });
  });

  it("frames dragged strips when fitting the camera", () => {
    const board = patchCollection(defaultBoard("Launch"), "col-main", { x: 800, y: 400 });
    const bounds = boardBounds(board);
    expect(bounds.minX).toBe(800);
    expect(bounds.minY).toBe(400 - COLLECTION_HANDLE);
    const camera = fitCamera(bounds, { width: 1000, height: 800 }, 0);
    expect(camera.pan.x + bounds.minX * camera.zoom).toBeCloseTo((1000 - bounds.width * camera.zoom) / 2);
    expect(camera.pan.y + bounds.minY * camera.zoom).toBeCloseTo((800 - bounds.height * camera.zoom) / 2);
  });

  it("folds title-bar drag into the filmstrip origin", () => {
    const next = applyCollectionHandleDrag({ x: 10, y: 40 }, { x: 30, y: -COLLECTION_HANDLE + 12 });
    expect(next.group).toEqual({ x: 40, y: 52 });
    expect(next.handle).toEqual({ x: 0, y: -COLLECTION_HANDLE });
  });

  it("caps Play collections at 8 slices", () => {
    const board = {
      ...defaultBoard("Wide"),
      store: "app-store" as const,
      presetId: "iphone-6-9",
      sliceCount: 10,
    };
    const last = createDeviceNode("iphone-island", board, 9);
    const next = applyStoreRules({ board, nodes: [last] }, "play");
    expect(next.board.sliceCount).toBe(8);
    expect(next.nodes).toEqual([]);
  });
});

describe("stack order", () => {
  it("paints low z first and lists high z first", () => {
    const board = defaultBoard();
    const back = { ...createDeviceNode("phone-punch", board), id: "back", z: 0 };
    const front = { ...createDeviceNode("iphone-island", board), id: "front", z: 2 };
    const mid = { ...createDeviceNode("tablet", board), id: "mid", z: 1 };
    expect(stackNodes([front, back, mid]).map((node) => node.id)).toEqual(["back", "mid", "front"]);
    expect(layerOrder([front, back, mid])).toEqual(["front", "mid", "back"]);
    expect(nextStackZ([back, mid, front])).toBe(3);
    expect(moveLayer(["front", "mid", "back"], "back", 0)).toEqual(["back", "front", "mid"]);
  });
});
