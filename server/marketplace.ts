import type { MarketplaceModule } from "../shared/marketplace";

const catalog: MarketplaceModule[] = [
  { id: "input.message", name: "ユーザー入力", version: "1.0.0", category: "input", description: "ユーザーの指示をレシピへ渡します。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["core", "input"], inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "text", type: "text", description: "入力テキスト" }] },
  { id: "text.context", name: "コンテキスト付与", version: "1.0.0", category: "knowledge", description: "背景コンテキストを追加します。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["knowledge", "context"], inputs: [{ name: "text", type: "text", required: true, description: "元のテキスト" }], outputs: [{ name: "text", type: "text", description: "追加後のテキスト" }] },
  { id: "ai.respond", name: "AI応答", version: "1.0.0", category: "reasoning", description: "接続済みLLMまたはデモエンジンで回答します。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule", tags: ["core", "llm", "reasoning"], inputs: [{ name: "text", type: "text", required: true, description: "質問" }], outputs: [{ name: "answer", type: "text", description: "回答" }] },
  { id: "output.markdown", name: "Markdown出力", version: "1.0.0", category: "output", description: "回答を表示用テキストにします。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["core", "output", "markdown"], inputs: [{ name: "answer", type: "text", required: true, description: "回答" }], outputs: [{ name: "markdown", type: "text", description: "表示結果" }] },
  { id: "text.summarize", name: "要約", version: "1.0.0", category: "transform", description: "入力文の先頭文を使う決定的な要約です。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["text", "summary", "transform"], inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "summary", type: "text", description: "要約" }] },
  { id: "text.keyword-extract", name: "キーワード抽出", version: "1.0.0", category: "transform", description: "入力から簡易キーワードを抽出します。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["text", "keywords", "transform"], inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "keywords", type: "text", description: "キーワード" }] },
  { id: "knowledge.glossary", name: "用語集コンテキスト", version: "1.0.0", category: "knowledge", description: "設定した用語集を入力へ付加します。", author: "mojuleagent", license: "MIT", repository: "https://github.com/mojuleagent/mojule-sample-modules", tags: ["knowledge", "glossary", "context"], inputs: [{ name: "text", type: "text", required: true, description: "入力" }], outputs: [{ name: "text", type: "text", description: "拡張入力" }] },
];

export function searchMarketplace(query = "", category = "") {
  const normalized = query.trim().toLowerCase();
  return catalog.filter(item => {
    const matchesCategory = !category || item.category === category;
    const haystack = [item.id, item.name, item.description, item.author, ...item.tags].join(" ").toLowerCase();
    return matchesCategory && (!normalized || haystack.includes(normalized));
  });
}
