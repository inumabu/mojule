import assert from "node:assert/strict";
import test from "node:test";

test("demo mode response contract", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "hello" }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.mode, "demo");
  assert.match(data.answer, /hello/);
  assert.equal(typeof data.runId, "string");
});

test("execution history exposes step input and output details", async () => {
  const listed = await fetch("http://127.0.0.1:3000/api/runs");
  assert.equal(listed.status, 200);
  const runs = (await listed.json()).runs;
  assert.ok(runs.length > 0);
  const detailResponse = await fetch(`http://127.0.0.1:3000/api/runs/${runs[0].id}`);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.run.id, runs[0].id);
  assert.ok(detail.run.result.steps[0].input);
  assert.ok(detail.run.result.steps[0].output);
});

test("module registry exposes the default recipe", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/modules");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.modules.map(module => module.id), ["input.message", "text.context", "ai.respond", "output.markdown", "text.summarize", "text.keyword-extract", "knowledge.glossary"]);
  assert.equal(data.recipe.nodes.length, 3);
});

test("invalid run input returns a structured client error", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "" }) });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error.code, "INVALID_REQUEST");
  assert.equal(typeof data.requestId, "string");
});

test("marketplace search returns catalog metadata", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/marketplace?q=context");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.modules[0].id, "text.context");
  assert.equal(data.modules[0].license, "MIT");
});

test("a marketplace sample module can execute in a recipe", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "first sentence. second sentence.", recipe: { id: "summary", name: "Summary", description: "sample", nodes: [{ id: "input", moduleId: "input.message" }, { id: "summary", moduleId: "text.summarize" }, { id: "output", moduleId: "output.markdown" }] } }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.output.markdown, /^first sentence/);
});

test("recipes can be saved, run, and deleted", async () => {
  const recipe = { id: "smoke-recipe", name: "Smoke Recipe", description: "test", nodes: [{ id: "input", moduleId: "input.message" }, { id: "respond", moduleId: "ai.respond" }, { id: "output", moduleId: "output.markdown" }] };
  const saved = await fetch("http://127.0.0.1:3000/api/recipes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(recipe) });
  assert.equal(saved.status, 201);
  const listed = await fetch("http://127.0.0.1:3000/api/recipes");
  assert.ok((await listed.json()).recipes.some(item => item.id === "smoke-recipe"));
  const run = await fetch("http://127.0.0.1:3000/api/recipes/smoke-recipe/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "saved" }) });
  assert.equal(run.status, 200);
  const removed = await fetch("http://127.0.0.1:3000/api/recipes/smoke-recipe", { method: "DELETE" });
  assert.equal(removed.status, 204);
});

test("recipe validation rejects missing input ports", async () => {
  const response = await fetch("http://127.0.0.1:3000/api/recipes/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "invalid", name: "Invalid", description: "test", nodes: [{ id: "input", moduleId: "input.message" }, { id: "output", moduleId: "output.markdown" }, { id: "respond", moduleId: "ai.respond" }] }) });
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.equal(data.valid, false);
  assert.match(data.issues[0], /missing input port/);
});

test("async jobs complete and expose a run result", async () => {
  const created = await fetch("http://127.0.0.1:3000/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "async test" }) });
  assert.equal(created.status, 202);
  const jobId = (await created.json()).job.id;
  let job;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 25));
    job = (await (await fetch(`http://127.0.0.1:3000/api/jobs/${jobId}`)).json()).job;
    if (job.status === "completed" || job.status === "failed") break;
  }
  assert.equal(job.status, "completed");
  assert.equal(typeof job.result.runId, "string");
});

test("local auth creates a session and workspace", async () => {
  const email = `smoke-${Date.now()}@example.com`;
  const registered = await fetch("http://127.0.0.1:3000/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "secure-pass-123", name: "Smoke User" }) });
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  const workspace = await fetch("http://127.0.0.1:3000/api/workspace", { headers: { cookie } });
  assert.equal(workspace.status, 200);
  assert.equal((await workspace.json()).user.role, "owner");
  const loggedOut = await fetch("http://127.0.0.1:3000/api/auth/logout", { method: "POST", headers: { cookie } });
  assert.equal(loggedOut.status, 204);
});

test("workspace owners can invite and change a member role", async () => {
  const ownerResponse = await fetch("http://127.0.0.1:3000/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `owner-${Date.now()}@example.com`, password: "owner-pass-123", name: "Owner" }) });
  const ownerCookie = ownerResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(ownerCookie);
  const inviteResponse = await fetch("http://127.0.0.1:3000/api/workspace/invitations", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ email: `member-${Date.now()}@example.com`, name: "Member", role: "editor" }) });
  assert.equal(inviteResponse.status, 201);
  const invitation = (await inviteResponse.json()).invitation;
  const memberResponse = await fetch("http://127.0.0.1:3000/api/auth/accept-invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: invitation.token, password: "member-pass-123" }) });
  assert.equal(memberResponse.status, 201);
  const member = (await memberResponse.json()).user;
  const roleResponse = await fetch(`http://127.0.0.1:3000/api/workspace/members/${member.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ role: "viewer" }) });
  assert.equal(roleResponse.status, 200);
  assert.equal((await roleResponse.json()).member.role, "viewer");
});

test("workspace API keys authenticate and can be revoked", async () => {
  const ownerResponse = await fetch("http://127.0.0.1:3000/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `api-key-${Date.now()}@example.com`, password: "key-owner-pass", name: "API Key Owner" }) });
  const ownerCookie = ownerResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(ownerCookie);
  const created = await fetch("http://127.0.0.1:3000/api/workspace/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie }, body: JSON.stringify({ name: "Smoke CLI" }) });
  assert.equal(created.status, 201);
  const data = await created.json();
  assert.match(data.token, /^mj_/);
  const workspace = await fetch("http://127.0.0.1:3000/api/workspace", { headers: { authorization: `Bearer ${data.token}` } });
  assert.equal(workspace.status, 200);
  const revoked = await fetch(`http://127.0.0.1:3000/api/workspace/api-keys/${data.key.id}`, { method: "DELETE", headers: { cookie: ownerCookie } });
  assert.equal(revoked.status, 200);
  const rejected = await fetch("http://127.0.0.1:3000/api/workspace", { headers: { authorization: `Bearer ${data.token}` } });
  assert.equal(rejected.status, 401);
});

test("OpenAPI contract and browser docs are available", async () => {
  const specResponse = await fetch("http://127.0.0.1:3000/api/openapi.json");
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/api/jobs/{id}/events"]);
  const docs = await fetch("http://127.0.0.1:3000/api/docs");
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /mojuleagent API/);
});
