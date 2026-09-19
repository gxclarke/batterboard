/**
 * IndexedDB persistence. Two stores: `projects` (the JSON document) and
 * `blobs` (images, keyed by blobKey). Images never live inside the project
 * document; see the schema notes.
 */
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Project } from "@/schema/project";

interface BatterboardDB extends DBSchema {
  projects: {
    key: string;
    value: { id: string; updatedAt: string; data: unknown };
    indexes: { updatedAt: string };
  };
  blobs: { key: string; value: Blob };
}

const DB_NAME = "batterboard";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BatterboardDB>> | null = null;

function db(): Promise<IDBPDatabase<BatterboardDB>> {
  dbPromise ??= openDB<BatterboardDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const projects = database.createObjectStore("projects", { keyPath: "id" });
      projects.createIndex("updatedAt", "updatedAt");
      database.createObjectStore("blobs");
    },
  });
  return dbPromise;
}

export async function saveProject(project: Project): Promise<void> {
  await (await db()).put("projects", { id: project.id, updatedAt: project.updatedAt, data: project });
}

/** The most recently updated project document, unvalidated. */
export async function loadLatestProject(): Promise<unknown | null> {
  const all = await (await db()).getAllFromIndex("projects", "updatedAt");
  return all.at(-1)?.data ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  await (await db()).delete("projects", id);
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await (await db()).put("blobs", blob, key);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  return (await db()).get("blobs", key);
}

export async function deleteBlob(key: string): Promise<void> {
  await (await db()).delete("blobs", key);
}

export async function listBlobKeys(): Promise<string[]> {
  return (await db()).getAllKeys("blobs");
}

/** Remove blobs no project references. Call after deleting tiles or projects. */
export async function deleteOrphanBlobs(referenced: Set<string>): Promise<number> {
  const keys = await listBlobKeys();
  let removed = 0;
  for (const key of keys) {
    if (!referenced.has(key)) {
      await deleteBlob(key);
      removed++;
    }
  }
  return removed;
}

/** Test hook: forget the cached connection so a fresh database can be opened. */
export function resetPersistenceForTests(): void {
  dbPromise = null;
}
