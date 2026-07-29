import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentPath = new URL("../components/modern-control/ModernControlDesigner.tsx", import.meta.url);
const cssPath = new URL("../app/globals.css", import.meta.url);

test("现代控制自定义增益对初学者说明用途", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /\["manual", "自定义增益"\]/);
  assert.match(source, /输入已经计算好的状态反馈矩阵 K/);
});

test("现代控制数值输入不显示浏览器原生步进按钮", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.weight-editor input,.gain-editor input\s*\{[^}]*appearance:\s*textfield/s);
  assert.match(css, /\.weight-editor input::-webkit-inner-spin-button,.gain-editor input::-webkit-inner-spin-button\s*\{[^}]*appearance:\s*none/s);
});
