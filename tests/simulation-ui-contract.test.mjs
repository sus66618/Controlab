import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("公共实验外壳不包含对象专属分支和控制器入口", async () => {
  const shell = await readFile(new URL("../components/simulations/PlantLabShell.tsx", import.meta.url), "utf8");
  for (const forbidden of ["spring-mass", "dc-motor", "passive-rlc", "active-sallen-key", "PID", "LQR", "控制器"]) {
    assert.doesNotMatch(shell, new RegExp(forbidden, "i"));
  }
  assert.match(shell, /selectedOutput/);
  assert.match(shell, /onReset/);
});

test("实验大厅与参数输入使用统一视觉契约", async () => {
  const gallery = await readFile(new URL("../components/simulations/SimulationGallery.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(gallery, /simulation-gallery/);
  assert.match(gallery, /groupExperiments/);
  assert.match(css, /\.simulation-gallery/);
  assert.match(css, /\.plant-lab-grid/);
  assert.match(css, /\.plant-number input/);
  assert.match(css, /appearance:\s*textfield/);
  assert.match(css, /::-webkit-inner-spin-button/);
});

test("切换输出量时从历史状态重新计算曲线", async () => {
  const types = await readFile(new URL("../lib/simulation/core/types.ts", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/simulations/PlantLabShell.tsx", import.meta.url), "utf8");
  assert.match(types, /PlantHistoryPoint\s*=\s*\{[^}]+state:\s*number\[\]/);
  assert.match(shell, /output\.read\(point\.state/);
});

test("五个实验使用与对象对应的专属静态封面", async () => {
  const cover = await readFile(new URL("../components/simulations/ExperimentCoverVisual.tsx", import.meta.url), "utf8");
  for (const marker of ["cover-spring-mass", "cover-dc-motor", "cover-passive-rlc", "cover-active-sallen-key", "cover-cart-pole"]) {
    assert.match(cover, new RegExp(marker));
  }
  assert.doesNotMatch(cover, /<svg|animation|@keyframes/i);
});
