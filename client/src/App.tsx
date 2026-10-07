import { FormEvent, useEffect, useState } from "react";

type CatalogModule = { id: string; category: string; description: string; author?: string; license?: string };
type RecipeNode = { id: string; moduleId: string; config?: Record<string, string> };
type SavedRecipe = { id: string; name: string; description: string; nodes: RecipeNode[]; updatedAt?: string };
type RunStep = { moduleId: string; durationMs: number; input?: Record<string, unknown>; output?: Record<string, unknown> };
type RunResult = { output?: { markdown?: string }; mode?: "demo" | "llm"; steps?: RunStep[]; runId?: string; createdAt?: string; error?: string };
type RunSummary = { id: string; recipeId: string; message: string; createdAt: string; result: RunResult };
type JobView = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; progress?: { percent: number; stage: string; message: string }; result?: RunResult; error?: { code: string; message: string } };

const fallbackCatalog: CatalogModule[] = [
  { id: "input.message", category: "入力", description: "ユーザーの指示を受け取る" },
  { id: "text.context", category: "知識", description: "背景コンテキストを追加する" },
  { id: "ai.respond", category: "推論", description: "LLMまたはデモエンジンで回答する" },
  { id: "output.markdown", category: "出力", description: "結果を表示用テキストにする" },
];
const defaultNodes: RecipeNode[] = [
  { id: "input-1", moduleId: "input.message" },
  { id: "respond-1", moduleId: "ai.respond" },
  { id: "output-1", moduleId: "output.markdown" },
];

export default function App() {
  const [catalog, setCatalog] = useState<CatalogModule[]>(fallbackCatalog);
  const [marketplace, setMarketplace] = useState<CatalogModule[]>(fallbackCatalog);
  const [marketQuery, setMarketQuery] = useState("");
  const [message, setMessage] = useState("mojuleagentの考え方を一文で説明してください。");
  const [nodes, setNodes] = useState<RecipeNode[]>(defaultNodes);
  const [context, setContext] = useState("このAIはモジュールを組み合わせて動作します。");
  const [recipeName, setRecipeName] = useState("My first recipe");
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [job, setJob] = useState<JobView | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = marketQuery ? `?q=${encodeURIComponent(marketQuery)}` : "";
    fetch(`/api/marketplace${query}`).then(response => response.json()).then(data => { setMarketplace(data.modules || []); setCatalog(data.modules?.length ? data.modules : fallbackCatalog); }).catch(() => setMarketplace(fallbackCatalog));
  }, [marketQuery]);

  useEffect(() => { fetch("/api/recipes").then(response => response.json()).then(data => setSavedRecipes(data.recipes || [])).catch(() => setSavedRecipes([])); }, []);
  useEffect(() => { refreshHistory(); }, []);

  function addModule(moduleId: string) {
    const count = nodes.filter(node => node.moduleId === moduleId).length + 1;
    setNodes(current => [...current, { id: `${moduleId}-${count}`, moduleId, ...(moduleId === "text.context" ? { config: { context } } : {}) }]);
  }
  function removeNode(nodeId: string) { setNodes(current => current.filter(node => node.id !== nodeId)); }
  function moveNode(index: number, direction: -1 | 1) { setNodes(current => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function resetRecipe() { setNodes(defaultNodes); setResult(null); }
  function recipePayload(): SavedRecipe { return { id: recipeName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipe", name: recipeName.trim() || "Untitled recipe", description: "ブラウザで作成したレシピ", nodes: nodes.map(node => node.moduleId === "text.context" ? { ...node, config: { context } } : node) }; }
  async function saveRecipe() { setError(""); try { const response = await fetch("/api/recipes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(recipePayload()) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "レシピを保存できませんでした"); setSavedRecipes(current => [data.recipe, ...current.filter(item => item.id !== data.recipe.id)]); } catch (cause) { setError(cause instanceof Error ? cause.message : "レシピ保存に失敗しました"); } }
  async function loadRecipe(id: string) { try { const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "レシピを読み込めませんでした"); setRecipeName(data.recipe.name); setNodes(data.recipe.nodes); setResult(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "レシピ読込に失敗しました"); } }
  async function refreshHistory() { try { const response = await fetch("/api/runs"); const data = await response.json(); setRunHistory(data.runs || []); } catch { setRunHistory([]); } }
  async function loadRun(id: string) { try { const response = await fetch(`/api/runs/${encodeURIComponent(id)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "履歴を読み込めませんでした"); setResult({ ...data.run.result, runId: data.run.id, createdAt: data.run.createdAt }); } catch (cause) { setError(cause instanceof Error ? cause.message : "履歴読込に失敗しました"); } }
  async function pollJob(id: string) { try { const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "ジョブ状態を取得できませんでした"); const current = data.job as JobView; setJob(current); if (current.status === "completed" && current.result) { setResult(current.result); await refreshHistory(); } else if (current.status === "queued" || current.status === "running") window.setTimeout(() => void pollJob(id), 700); } catch (cause) { setError(cause instanceof Error ? cause.message : "ジョブ状態取得に失敗しました"); } }
  function watchJob(id: string) { const source = new EventSource(`/api/jobs/${encodeURIComponent(id)}/events`); source.onmessage = event => { const current = JSON.parse(event.data) as JobView; setJob(current); if (current.status === "completed" && current.result) { setResult(current.result); source.close(); void refreshHistory(); } else if (current.status === "failed" || current.status === "cancelled") source.close(); }; source.onerror = () => { source.close(); void pollJob(id); }; }
  async function startAsyncJob() { if (!message.trim() || nodes.length === 0) return; setError(""); try { const response = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, recipe: recipePayload() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "ジョブを開始できませんでした"); setJob(data.job); watchJob(data.job.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "非同期実行に失敗しました"); } }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!message.trim() || loading || nodes.length === 0) return;
    setLoading(true); setError("");
    const recipe = recipePayload();
    try {
      const response = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, recipe }) });
      const data = await response.json() as RunResult;
      if (!response.ok) throw new Error(data.error || "レシピ実行に失敗しました");
      setResult(data); await refreshHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "不明なエラーです"); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">m</span><div><strong>mojuleagent</strong><small>compose intelligence from modules</small></div></div><span className="status">standalone MVP</span></header>
    <section className="hero"><div><p className="eyebrow">MODULE AGENT</p><h1>AIを、<em>組み合わせる</em><br />システムへ。</h1><p className="lead">知識・機能・推論を小さなモジュールとして扱い、目的に合わせてレシピを組み替える独立型エージェントです。</p></div><div className="recipe"><span>LIVE RECIPE</span><div className="flow">{nodes.length === 0 ? <p>モジュールを追加してください</p> : nodes.map((node, index) => <div className="node" key={node.id}><b>{node.moduleId}</b>{index < nodes.length - 1 && <i>→</i>}</div>)}</div><p>レジストリの「追加」ボタンから、実行順にモジュールを組み合わせられます。</p></div></section>
    <section className="workspace"><aside><div className="section-title"><span>MODULE REGISTRY</span><b>{catalog.length} modules</b></div>{catalog.map(module => <div className="module" key={module.id}><div><b>{module.id}</b><p>{module.description}</p></div><div className="module-actions"><span>{module.category}</span><button type="button" onClick={() => addModule(module.id)}>追加</button></div></div>)}</aside><form className="runner" onSubmit={submit}><div className="section-title"><span>RECIPE BUILDER</span><b>{nodes.length} steps</b></div><div className="recipe-tools"><input aria-label="レシピ名" value={recipeName} onChange={event => setRecipeName(event.target.value)} /><button type="button" className="secondary" onClick={saveRecipe}>保存</button></div><div className="recipe-editor">{nodes.map((node, index) => <div className="editor-node" key={node.id}><small>{String(index + 1).padStart(2, "0")}</small><b>{node.moduleId}</b><button type="button" onClick={() => moveNode(index, -1)} disabled={index === 0} aria-label="上へ">↑</button><button type="button" onClick={() => moveNode(index, 1)} disabled={index === nodes.length - 1} aria-label="下へ">↓</button><button type="button" onClick={() => removeNode(node.id)} aria-label={`${node.moduleId}を削除`}>×</button></div>)}</div>{nodes.some(node => node.moduleId === "text.context") && <><label htmlFor="context">知識モジュールのコンテキスト</label><input id="context" value={context} onChange={event => setContext(event.target.value)} /></>}<label htmlFor="message">メッセージ</label><textarea id="message" value={message} onChange={event => setMessage(event.target.value)} /><div className="runner-actions"><button type="button" className="secondary" onClick={resetRecipe}>初期化</button><button type="button" className="secondary" onClick={startAsyncJob} disabled={loading || job?.status === "running" || job?.status === "queued" || nodes.length === 0}>バックグラウンド実行</button><button type="submit" disabled={loading || nodes.length === 0}>{loading ? "実行中…" : "レシピを実行"}</button></div>{job && <><p className={`job-status ${job.status}`}>JOB {job.status}{job.status === "failed" && job.error ? ` · ${job.error.message}` : ""}</p>{job.progress && <progress className="job-progress" max="100" value={job.progress.percent}>{job.progress.percent}%</progress>}</>}{error && <p className="error">{error}</p>}{result && <div className="answer"><div className="answer-head"><span>実行結果</span><small>{result.mode === "demo" ? "LOCAL DEMO" : "OPENAI-COMPATIBLE LLM"}</small></div><p>{result.output?.markdown}</p>{result.runId && <small className="run-id">RUN {result.runId}</small>}{result.steps && <div className="step-list">{result.steps.map((step, index) => <span key={`${step.moduleId}-${index}`}><b>{step.moduleId} · {step.durationMs}ms</b><small>{JSON.stringify(step.output || {})}</small></span>)}</div>}</div>}</form></section>
    <section className="history-panel"><div className="section-title"><span>RUN HISTORY</span><b>{runHistory.length} recent runs</b></div>{runHistory.length === 0 ? <p className="empty-state">実行履歴はここに表示されます。</p> : <div className="history-grid">{runHistory.slice(0, 8).map(run => <button type="button" key={run.id} onClick={() => loadRun(run.id)}><b>{run.recipeId}</b><small>{new Date(run.createdAt).toLocaleString("ja-JP")} · {run.result.steps?.length || 0} steps</small><span>{run.message}</span></button>)}</div>}</section>
    <section className="saved-panel"><div className="section-title"><span>SAVED RECIPES</span><b>{savedRecipes.length} recipes</b></div>{savedRecipes.length === 0 ? <p className="empty-state">保存したレシピはここに表示されます。</p> : <div className="saved-grid">{savedRecipes.map(recipe => <button type="button" key={recipe.id} onClick={() => loadRecipe(recipe.id)}><b>{recipe.name}</b><small>{recipe.nodes.length} steps · {recipe.id}</small></button>)}</div>}</section>
    <section className="marketplace-panel"><div className="section-title"><span>MARKETPLACE</span><b>{marketplace.length} available modules</b></div><input aria-label="マーケットプレイス検索" placeholder="モジュールを検索…" value={marketQuery} onChange={event => setMarketQuery(event.target.value)} /><div className="marketplace-grid">{marketplace.map(module => <article key={module.id}><div><b>{module.id}</b><small>{module.author || "mojuleagent"} · {module.license || "MIT"}</small></div><p>{module.description}</p><button type="button" onClick={() => addModule(module.id)}>レシピに追加</button></article>)}</div></section>
    <footer>独立動作：Node.js + Express + Vite React ／ モジュールを追加してレシピを組み替えられます</footer>
  </main>;
}
