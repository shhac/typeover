import { glob, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export type ContentCollection = "modules" | "themes" | "exercises";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..");
export const contentRoot = join(repoRoot, "src", "content");

export interface ContentEntry<T> {
  id: string;
  data: T;
  path: string;
}

export async function readYaml<T>(path: string): Promise<T> {
  return parse(await readFile(path, "utf8")) as T;
}

export function collectionId(collection: ContentCollection, path: string): string {
  const rel = relative(join(contentRoot, collection), path);
  return rel.slice(0, -".yaml".length).split(sep).join("/");
}

export function exerciseThemeId(exerciseId: string): string {
  return exerciseId.split("/").slice(0, 3).join("/");
}

export async function loadCollection<T>(collection: ContentCollection): Promise<ContentEntry<T>[]> {
  const out: ContentEntry<T>[] = [];
  for await (const path of glob(join(contentRoot, collection, "**/*.yaml"))) {
    out.push({
      id: collectionId(collection, path),
      data: await readYaml<T>(path),
      path,
    });
  }
  return out;
}

export function relativeToRepo(path: string): string {
  return relative(repoRoot, path);
}
