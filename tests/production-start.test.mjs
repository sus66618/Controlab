import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("生产服务从 dist/server 启动以正确解析静态资源目录", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.start, /^cd dist\/server && wrangler dev --config wrangler\.json$/);
});
