import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultProject } from "@/schema/defaults";
import {
  deleteOrphanBlobs,
  getBlob,
  loadLatestProject,
  putBlob,
  resetPersistenceForTests,
  saveProject,
} from "./persistence";

describe("persistence", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetPersistenceForTests();
  });

  it("round-trips a project and returns the latest one", async () => {
    const a = defaultProject();
    a.updatedAt = "2026-01-01T00:00:00.000Z";
    const b = defaultProject();
    b.updatedAt = "2026-02-01T00:00:00.000Z";
    await saveProject(b);
    await saveProject(a);
    expect(await loadLatestProject()).toEqual(b);
  });

  it("returns null when empty", async () => {
    expect(await loadLatestProject()).toBeNull();
  });

  it("round-trips blobs and removes orphans", async () => {
    await putBlob("aerial_1", new Blob(["one"], { type: "text/plain" }));
    await putBlob("aerial_2", new Blob(["two"], { type: "text/plain" }));
    expect(await (await getBlob("aerial_1"))?.text()).toBe("one");
    expect(await deleteOrphanBlobs(new Set(["aerial_2"]))).toBe(1);
    expect(await getBlob("aerial_1")).toBeUndefined();
    expect(await getBlob("aerial_2")).toBeDefined();
  });
});
