import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { type Asset, type Project, isSafeId, migrateProject, newProject, uid } from "../lib/project";
import { projectsRoot } from "./config";
import { HttpError } from "./http";

export function projectDir(id: string): string {
  if (!isSafeId(id)) throw new HttpError(400, "Invalid project id");
  const dir = path.join(projectsRoot(), id);
  if (path.dirname(dir) !== projectsRoot()) throw new HttpError(400, "Invalid project id");
  return dir;
}

/** Resolve a path inside a project directory; refuses anything that escapes it (.., symlinks). */
export async function safeProjectPath(id: string, rel: string): Promise<string> {
  const dir = projectDir(id);
  if (rel.includes("\0") || path.isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) throw new HttpError(400, "Invalid path");
  const full = path.join(dir, rel);
  const real = await fs.realpath(full).catch(() => null);
  const realDir = await fs.realpath(dir).catch(() => dir);
  if (real && real !== realDir && !real.startsWith(realDir + path.sep)) throw new HttpError(400, "Invalid path");
  return full;
}

async function atomicWrite(file: string, data: string) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

export async function readProject(id: string): Promise<Project> {
  const file = path.join(projectDir(id), "project.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    throw new HttpError(404, "Project not found");
  }
  try {
    return migrateProject(JSON.parse(raw));
  } catch (e) {
    throw new HttpError(500, `Project file is corrupt: ${(e as Error).message}`);
  }
}

export async function writeProject(p: Project): Promise<Project> {
  const dir = projectDir(p.id);
  await fs.mkdir(dir, { recursive: true });
  const next = { ...p, updatedAt: new Date().toISOString() };
  await atomicWrite(path.join(dir, "project.json"), JSON.stringify(next, null, 1));
  return next;
}

export async function createProject(name: string, aspect?: Project["aspect"]): Promise<Project> {
  const id = uid("p").toLowerCase();
  await fs.mkdir(path.join(projectDir(id), "assets"), { recursive: true });
  return writeProject(newProject({ id, name, aspect }));
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  aspect: Project["aspect"];
  durationMs: number;
  captionCount: number;
  thumbnail: string | null;
  hasVideo: boolean;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await fs.mkdir(projectsRoot(), { recursive: true });
  const names = await fs.readdir(projectsRoot());
  const out: ProjectSummary[] = [];
  for (const n of names) {
    if (!isSafeId(n)) continue;
    try {
      const p = await readProject(n);
      const src = p.sourceAssetId ? p.assets[p.sourceAssetId] : undefined;
      out.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt, aspect: p.aspect, durationMs: src?.durationMs ?? 0, captionCount: p.captions.length, thumbnail: src?.thumbnailKey ? `/api/media/${p.id}/${src.id}?thumb=1` : null, hasVideo: !!src });
    } catch {
      /* skip unreadable project dirs */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string) {
  const dir = projectDir(id);
  if (!existsSync(dir)) throw new HttpError(404, "Project not found");
  await fs.rm(dir, { recursive: true, force: true });
}

export async function duplicateProject(id: string): Promise<Project> {
  const src = await readProject(id);
  const newId = uid("p").toLowerCase();
  await fs.cp(projectDir(id), projectDir(newId), { recursive: true, filter: (s) => !s.includes(`${path.sep}exports`) });
  const copy: Project = { ...src, id: newId, name: `${src.name} (copy)`, createdAt: new Date().toISOString() };
  return writeProject(copy);
}

export function assetOf(p: Project, assetId: string): Asset {
  const a = p.assets[assetId];
  if (!a) throw new HttpError(404, "Asset not found");
  return a;
}
