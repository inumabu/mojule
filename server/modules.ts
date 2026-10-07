import type { ModuleManifest, ModuleStep, Recipe, RecipeResult, ModuleValue } from "../shared/module";
import { answer } from "./llm";

type Handler = (input: Record<string, ModuleValue>, config: Record<string, unknown>) => Promise<{ output: Record<string, ModuleValue>; mode?: "demo" | "llm" }>;
type RegisteredModule = { manifest: ModuleManifest; run: Handler };
const text = (value: ModuleValue | undefined) => typeof value === "string" ? value : "";

const registry: RegisteredModule[] = [
  { manifest: { id: "input.message", name: "ユーザー入力", version: "1.0.0", category: "input", description: "メッセージをレシピへ渡します。", inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "text", type: "text", description: "入力テキスト" }] }, run: async input => ({ output: { text: text(input.text) } }) },
  { manifest: { id: "text.context", name: "コンテキスト付与", version: "1.0.0", category: "knowledge", description: "固定コンテキストを追加します。", inputs: [{ name: "text", type: "text", required: true, description: "元のテキスト" }], outputs: [{ name: "text", type: "text", description: "追加後のテキスト" }] }, run: async (input, config) => ({ output: { text: [typeof config.context === "string" ? config.context : "", text(input.text)].filter(Boolean).join("\n\n") } }) },
  { manifest: { id: "ai.respond", name: "AI応答", version: "1.0.0", category: "reasoning", description: "接続済みLLMまたはデモエンジンで回答します。", inputs: [{ name: "text", type: "text", required: true, description: "質問" }], outputs: [{ name: "answer", type: "text", description: "回答" }] }, run: async input => { const result = await answer(text(input.text)); return { output: { answer: result.answer }, mode: result.mode }; } },
  { manifest: { id: "output.markdown", name: "Markdown出力", version: "1.0.0", category: "output", description: "回答を表示用テキストにします。", inputs: [{ name: "answer", type: "text", required: true, description: "回答" }], outputs: [{ name: "markdown", type: "text", description: "表示結果" }] }, run: async input => ({ output: { markdown: text(input.answer) || text(input.text) } }) },
  { manifest: { id: "text.summarize", name: "要約", version: "1.0.0", category: "transform", description: "入力文の先頭文を使う決定的な要約です。", inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "summary", type: "text", description: "要約" }] }, run: async input => { const summary = text(input.text).split(/[。.!?]/).filter(Boolean).slice(0, 2).join("。"); return { output: { summary, text: summary } }; } },
  { manifest: { id: "text.keyword-extract", name: "キーワード抽出", version: "1.0.0", category: "transform", description: "入力から簡易キーワードを抽出します。", inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "keywords", type: "text", description: "キーワード" }] }, run: async input => { const keywords = text(input.text).split(/\s+/).filter(word => word.length > 2).slice(0, 8).join(", "); return { output: { keywords, text: keywords } }; } },
  { manifest: { id: "knowledge.glossary", name: "用語集コンテキスト", version: "1.0.0", category: "knowledge", description: "設定した用語集を入力へ付加します。", inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "text", type: "text", description: "拡張入力" }] }, run: async (input, config) => ({ output: { text: `${typeof config.glossary === "string" ? config.glossary : ""}\n\n${text(input.text)}`.trim() } }) },
];

export const defaultRecipe: Recipe = { id: "default-answer", name: "標準回答", description: "入力をAI応答へ渡しMarkdownで出力します。", nodes: [{ id: "input", moduleId: "input.message" }, { id: "respond", moduleId: "ai.respond" }, { id: "output", moduleId: "output.markdown" }] };
export const listModules = (): ModuleManifest[] => registry.map(item => item.manifest);
export function validateRecipe(recipe: Recipe): string[] {
  const issues: string[] = [];
  if (!recipe?.nodes?.length) return ["recipe must contain at least one node"];
  if (new Set(recipe.nodes.map(node => node.id)).size !== recipe.nodes.length) issues.push("node ids must be unique");
  let available = new Set(["text"]);
  for (const node of recipe.nodes) {
    const module = registry.find(item => item.manifest.id === node.moduleId);
    if (!module) issues.push(`unknown module: ${node.moduleId}`);
    if (node.config && JSON.stringify(node.config).length > 32_000) issues.push(`config too large: ${node.id}`);
    if (!module) continue;
    for (const port of module.manifest.inputs.filter(input => input.required)) {
      const outputAlias = module.manifest.id === "output.markdown" && ["answer", "summary", "keywords", "text"].some(alias => available.has(alias));
      if (!available.has(port.name) && !outputAlias) issues.push(`${node.id}: missing input port ${port.name}`);
    }
    available = new Set(module.manifest.outputs.map(output => output.name));
    if (module.manifest.category === "knowledge" || module.manifest.category === "transform") available.add("text");
  }
  return issues;
}

export async function executeRecipe(recipe: Recipe, initial: Record<string, ModuleValue>): Promise<RecipeResult> {
  if (!recipe || !Array.isArray(recipe.nodes) || recipe.nodes.length === 0 || recipe.nodes.length > 24) throw new Error("Recipe must contain between 1 and 24 nodes");
  const validationIssues = validateRecipe(recipe);
  if (validationIssues.length) throw new Error(`Invalid recipe: ${validationIssues.join("; ")}`);
  let value = initial;
  let mode: "demo" | "llm" = "demo";
  const steps: ModuleStep[] = [];
  for (const node of recipe.nodes) {
    const module = registry.find(item => item.manifest.id === node.moduleId);
    if (!module) throw new Error(`Unknown module: ${node.moduleId}`);
    const started = Date.now();
    const input = value;
    const result = await module.run(input, node.config || {});
    value = result.output;
    if (result.mode) mode = result.mode;
    steps.push({ nodeId: node.id, moduleId: node.moduleId, input, output: result.output, durationMs: Date.now() - started });
  }
  return { output: value, steps, mode };
}
