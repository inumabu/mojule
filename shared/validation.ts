import { z } from "zod";

const moduleId = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
export const recipeSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  description: z.string().max(500),
  nodes: z.array(z.object({ id: z.string().min(1).max(120), moduleId, config: z.record(z.string(), z.unknown()).optional() })).min(1).max(24),
}).superRefine((recipe, context) => {
  const ids = new Set<string>();
  for (const [index, node] of recipe.nodes.entries()) {
    if (ids.has(node.id)) context.addIssue({ code: "custom", path: ["nodes", index, "id"], message: "node id must be unique" });
    ids.add(node.id);
  }
});

export const runRequestSchema = z.object({
  message: z.string().trim().min(1, "message is required").max(12000),
  recipe: recipeSchema.optional(),
});

export const recipeIdSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
export const recipeSaveSchema = recipeSchema;
export const registerSchema = z.object({ email: z.string().email().max(240), password: z.string().min(8).max(200), name: z.string().min(1).max(80) });
export const loginSchema = z.object({ email: z.string().email().max(240), password: z.string().min(1).max(200) });
export const invitationSchema = z.object({ email: z.string().email().max(240), name: z.string().min(1).max(80), role: z.enum(["editor", "viewer"]) });
export const acceptInvitationSchema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(200) });
export const roleUpdateSchema = z.object({ role: z.enum(["editor", "viewer"]) });
export const apiKeySchema = z.object({ name: z.string().min(1).max(80) });
