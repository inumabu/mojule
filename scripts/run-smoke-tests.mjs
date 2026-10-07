import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

const port = process.env.PORT ?? "3000";
const host = `http://127.0.0.1:${port}`;
const tsxEntry = "node_modules/tsx/dist/cli.mjs";
const server = spawn(process.execPath, [tsxEntry, "server/index.ts"], {
  stdio: "ignore",
  env: { ...process.env, PORT: port, NODE_ENV: "test", MOJULE_LLM_ENABLED: "false" },
  windowsHide: true,
});
server.unref();

try {
  if (!existsSync(tsxEntry)) {
    throw new Error("tsx が見つかりません。先に pnpm install を実行してください。");
  }
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${host}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // サーバー起動待ち
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) {
    throw new Error("Mojule サーバーが起動せず、スモークテストを開始できませんでした。");
  }
  execFileSync(process.execPath, ["--test", "test/smoke.mjs"], {
    stdio: "inherit",
    env: { ...process.env, PORT: port },
    windowsHide: true,
  });
} finally {
  server.kill();
}
