import { describe, expect, it } from "vitest";
import { defaultProject } from "@/schema/defaults";
import { parseProjectFile, serializeProject } from "./projectFile";

describe("project file", () => {
  it("round-trips a project with its images", async () => {
    const p = defaultProject();
    p.site.tiles.push({ id: "t1", name: "aerial", blobKey: "aerial_t1", widthPx: 100, heightPx: 50, offsetPx: [0, 0] });
    const store = new Map([["aerial_t1", new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" })]]);
    const text = await serializeProject(p, async (k) => store.get(k));
    expect(text).toContain('"format":"batterboard-project"');
    const parsed = await parseProjectFile(text);
    expect(parsed.project).toEqual(p);
    expect(await parsed.blobs.aerial_t1?.text()).toBe("fake-jpeg-bytes");
  });

  it("rejects foreign files with a readable message", async () => {
    await expect(parseProjectFile("nope")).rejects.toThrow(/valid JSON/);
    await expect(parseProjectFile(JSON.stringify({ hello: 1 }))).rejects.toThrow(/not a Batterboard/);
    const p = defaultProject();
    p.site.tiles.push({ id: "t1", name: "aerial", blobKey: "aerial_t1", widthPx: 100, heightPx: 50, offsetPx: [0, 0] });
    const missing = JSON.stringify({ format: "batterboard-project", fileVersion: 1, project: p, blobs: {} });
    await expect(parseProjectFile(missing)).rejects.toThrow(/missing the image/);
  });
});
