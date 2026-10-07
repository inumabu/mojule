import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RecipeResult } from "../shared/module";

const filePath = process.env.RUN_HISTORY_FILE || path.resolve(process.cwd(), "data/runs.json");
const MAX_RUNS = 100;
let queue = Promise.resolve();
export type RunRecord = { id: string; recipeId: string; message: string; createdAt: string; result: RecipeResult };
async function readAll(): Promise<RunRecord[]> { try { return JSON.parse(await readFile(filePath, "utf8")) as RunRecord[]; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }
async function writeAll(records: RunRecord[]) { await mkdir(path.dirname(filePath), { recursive: true }); const temporary = `${filePath}.${process.pid}.tmp`; await writeFile(temporary, JSON.stringify(records, null, 2), "utf8"); await rename(temporary, filePath); }
function serialized<T>(operation: () => Promise<T>): Promise<T> { const next = queue.then(operation, operation); queue = next.then(() => undefined, () => undefined); return next; }
export const runs = {
  list: (recipeId?: string) => serialized(async () => { const records = await readAll(); return records.filter(record => !recipeId || record.recipeId === recipeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_RUNS); }),
  get: (id: string) => serialized(async () => (await readAll()).find(record => record.id === id) || null),
  create: (recipeId: string, message: string, result: RecipeResult) => serialized(async () => { const records = await readAll(); const record: RunRecord = { id: randomUUID(), recipeId, message, createdAt: new Date().toISOString(), result }; await writeAll([record, ...records].slice(0, MAX_RUNS)); return record; }),
};
