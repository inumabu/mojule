import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(...args) {
  console.log(`\n>>> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("check");
run("test");
run("build");

if (!existsSync("dist/index.js") || !existsSync("dist/public/index.html")) {
  throw new Error("dist/ に Mojule の Build 成果物がありません");
}
console.log("\n✅ Mojule の型検査・テスト・Build が完了しました");
