import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("服务端正确渲染 Controlab 模块封面", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Controlab · 在线控制实验室<\/title>/i);
  assert.match(html, /控制系统学习与仿真平台/);
  assert.match(html, /系统分析/);
  assert.match(html, /闭环控制/);
  assert.match(html, /动力学仿真/);
  assert.match(html, /小车倒立摆/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
