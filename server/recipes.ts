import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Recipe } from "../shared/module";

const filePath = process.env.RECIPES_FILE || path.resolve(process.cwd(), "data/recipes.json");
let queue = Promise.resolve();

type StoredRecipe = Recipe & { createdAt: string; updatedAt: string };
async function readAll(): Promise<StoredRecipe[]> {
  try { return JSON.parse(await readFile(filePath, "utf8")) as StoredRecipe[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
async function writeAll(recipes: StoredRecipe[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(recipes, null, 2), "utf8");
  await rename(temporary, filePath);
}
function serialized<T>(operation: () => Promise<T>): Promise<T> { const next = queue.then(operation, operation); queue = next.then(() => undefined, () => undefined); return next; }

export const recipes = {
  list: () => serialized(async () => (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
  get: (id: string) => serialized(async () => (await readAll()).find(recipe => recipe.id === id) || null),
  save: (recipe: Recipe) => serialized(async () => { const all = await readAll(); const now = new Date().toISOString(); const existing = all.find(item => item.id === recipe.id); const stored = { ...recipe, createdAt: existing?.createdAt || now, updatedAt: now }; const next = existing ? all.map(item => item.id === recipe.id ? stored : item) : [...all, stored]; await writeAll(next); return stored; }),
  delete: (id: string) => serialized(async () => { const all = await readAll(); const next = all.filter(recipe => recipe.id !== id); if (next.length === all.length) return false; await writeAll(next); return true; }),
};
