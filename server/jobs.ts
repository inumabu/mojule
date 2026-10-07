import { randomUUID } from "node:crypto";
import type { Recipe, RecipeResult } from "../shared/module";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobError = { code: "CANCELLED" | "INVALID_RECIPE" | "UPSTREAM_ERROR"; message: string };
export type JobProgress = { percent: number; stage: "queued" | "running" | "recording" | "completed" | "failed" | "cancelled"; message: string };
export type JobRecord = { id: string; recipe: Recipe; message: string; status: JobStatus; createdAt: string; startedAt?: string; finishedAt?: string; progress: JobProgress; result?: RecipeResult & { runId?: string; createdAt?: string }; error?: JobError; cancelRequested?: boolean };
type Runner = (recipe: Recipe, message: string, progress?: (value: JobProgress) => void) => Promise<RecipeResult & { runId?: string; createdAt?: string }>;
type Listener = (job: JobRecord) => void;
const store = new Map<string, JobRecord>();
const listeners = new Map<string, Set<Listener>>();
const pending: Array<{ job: JobRecord; runner: Runner }> = [];
const MAX_JOBS = 100;
const MAX_CONCURRENT = 2;
let active = 0;

function emit(job: JobRecord) { listeners.get(job.id)?.forEach(listener => listener(job)); }
function update(job: JobRecord, patch: Partial<JobRecord>) { Object.assign(job, patch); emit(job); }
function trim() { while (store.size > MAX_JOBS) { const oldest = [...store.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]; if (oldest) store.delete(oldest.id); else break; } }
function snapshot(job: JobRecord) { const { recipe: _recipe, ...publicJob } = job; const position = job.status === "queued" ? pending.findIndex(item => item.job.id === job.id) + 1 : 0; return { ...publicJob, queuePosition: position || undefined }; }
function classify(error: unknown): JobError { const message = error instanceof Error ? error.message : "ジョブ実行に失敗しました"; return message.startsWith("Invalid recipe") || message.startsWith("Unknown module") ? { code: "INVALID_RECIPE", message } : { code: "UPSTREAM_ERROR", message }; }
async function start(job: JobRecord, runner: Runner) {
  if (job.status === "cancelled") return;
  update(job, { status: "running", startedAt: new Date().toISOString(), progress: { percent: 10, stage: "running", message: "レシピを実行しています" } });
  try {
    const result = await runner(job.recipe, job.message, progress => update(job, { progress }));
    if (job.cancelRequested) update(job, { status: "cancelled", error: { code: "CANCELLED", message: "キャンセル要求を受け付けました。" }, progress: { percent: 100, stage: "cancelled", message: "キャンセルされました" } });
    else update(job, { result, status: "completed", progress: { percent: 100, stage: "completed", message: "完了しました" } });
  } catch (error) { update(job, { status: job.cancelRequested ? "cancelled" : "failed", error: job.cancelRequested ? { code: "CANCELLED", message: "キャンセルされました。" } : classify(error), progress: { percent: 100, stage: job.cancelRequested ? "cancelled" : "failed", message: job.cancelRequested ? "キャンセルされました" : "失敗しました" } }); }
  update(job, { finishedAt: new Date().toISOString() });
}
function pump() { while (active < MAX_CONCURRENT && pending.length) { const item = pending.shift()!; if (item.job.status === "cancelled") continue; active += 1; void start(item.job, item.runner).finally(() => { active -= 1; pump(); }); } }
export const jobs = {
  enqueue(recipe: Recipe, message: string, runner: Runner) { const job: JobRecord = { id: randomUUID(), recipe, message, status: "queued", createdAt: new Date().toISOString(), progress: { percent: 0, stage: "queued", message: "実行待ちです" } }; store.set(job.id, job); pending.push({ job, runner }); trim(); emit(job); queueMicrotask(pump); return snapshot(job); },
  get(id: string) { const job = store.get(id); return job ? snapshot(job) : null; },
  cancel(id: string) { const job = store.get(id); if (!job) return null; if (job.status === "queued" || job.status === "running") { job.cancelRequested = true; if (job.status === "queued") update(job, { status: "cancelled", error: { code: "CANCELLED", message: "キャンセルされました。" }, progress: { percent: 100, stage: "cancelled", message: "キャンセルされました" }, finishedAt: new Date().toISOString() }); else emit(job); } return snapshot(job); },
  retry(id: string, runner: Runner) { const job = store.get(id); if (!job) return null; return jobs.enqueue(job.recipe, job.message, runner); },
  subscribe(id: string, listener: Listener) { const set = listeners.get(id) || new Set<Listener>(); set.add(listener); listeners.set(id, set); const job = store.get(id); if (job) listener(job); return () => { set.delete(listener); if (!set.size) listeners.delete(id); }; },
  list() { return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(snapshot); },
};
