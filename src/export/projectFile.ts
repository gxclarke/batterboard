/**
 * The shareable project file: the project document plus its images, inlined
 * as data URLs only here, at the boundary. Import validates through migrate().
 */
import { migrate, type Project } from "@/schema/project";
import { referencedBlobKeys } from "@/store/autosave";

export const PROJECT_FILE_FORMAT = "batterboard-project";
export const PROJECT_FILE_EXT = ".batterboard.json";

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  fileVersion: 1;
  exportedAt: string;
  project: Project;
  /** blobKey -> data URL */
  blobs: Record<string, string>;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Bad image data in file");
  const type = m[1] || "application/octet-stream";
  const payload = m[3] ?? "";
  if (!m[2]) return new Blob([decodeURIComponent(payload)], { type });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function serializeProject(
  project: Project,
  getBlob: (key: string) => Promise<Blob | undefined>,
): Promise<string> {
  const blobs: Record<string, string> = {};
  for (const key of referencedBlobKeys(project)) {
    const b = await getBlob(key);
    if (b) blobs[key] = await blobToDataUrl(b);
  }
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    fileVersion: 1,
    exportedAt: new Date().toISOString(),
    project,
    blobs,
  };
  return JSON.stringify(file);
}

export interface ParsedProjectFile {
  project: Project;
  blobs: Record<string, Blob>;
}

/** Parse and validate a project file. Throws with a readable message on anything off. */
export async function parseProjectFile(text: string): Promise<ParsedProjectFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const f = raw as Partial<ProjectFile>;
  if (f?.format !== PROJECT_FILE_FORMAT) throw new Error("That is not a Batterboard project file.");
  const project = migrate(f.project);
  const blobs: Record<string, Blob> = {};
  for (const key of referencedBlobKeys(project)) {
    const url = f.blobs?.[key];
    if (!url) throw new Error(`The file is missing an image (${key}).`);
    blobs[key] = dataUrlToBlob(url);
  }
  return { project, blobs };
}
