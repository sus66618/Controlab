import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentPath = new URL("../components/modern-control/ModernControlDesigner.tsx", import.meta.url);
const cssPath = new URL("../app/globals.css", import.meta.url);
const identificationMethodPath = new URL("../components/identification/MethodSelector.tsx", import.meta.url);
const identificationParametersPath = new URL("../components/identification/IdentificationParameters.tsx", import.meta.url);

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

test("系统辨识提供五种方法并按方法切换参数", async () => {
  const methods = await readFile(identificationMethodPath, "utf8");
  const parameters = await readFile(identificationParametersPath, "utf8");
  for (const label of ["ARX", "FIR", "正则化 ARX", "ARMAX", "OE"]) assert.match(methods, new RegExp(label));
  for (const field of ["na", "nb", "nk", "nc", "nf", "lambda"]) assert.match(parameters, new RegExp(`\\b${field}\\b`));
});

test("系统辨识数值参数不显示浏览器原生步进按钮", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /\.identification-number input\s*\{[^}]*appearance:\s*textfield/s);
  assert.match(css, /\.identification-number input::-webkit-inner-spin-button[^}]*appearance:\s*none/s);
});
