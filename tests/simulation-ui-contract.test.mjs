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
