export type ModuleCategory = "input" | "knowledge" | "reasoning" | "transform" | "output";
export type ModuleValue = string | number | boolean | null | Record<string, unknown>;

export type ModulePort = { name: string; type: "text" | "json"; required?: boolean; description: string };
export type ModuleManifest = { id: string; name: string; version: string; category: ModuleCategory; description: string; inputs: ModulePort[]; outputs: ModulePort[] };
export type RecipeNode = { id: string; moduleId: string; config?: Record<string, unknown> };
export type Recipe = { id: string; name: string; description: string; nodes: RecipeNode[] };
export type ModuleStep = { nodeId: string; moduleId: string; input: Record<string, ModuleValue>; output: Record<string, ModuleValue>; durationMs: number };
export type RecipeResult = { output: Record<string, ModuleValue>; steps: ModuleStep[]; mode: "demo" | "llm" };
