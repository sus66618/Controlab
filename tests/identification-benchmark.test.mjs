import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseIdentificationCsvDataset } from "../lib/identificationData.ts";
import { fitIdentification } from "../lib/identification/fit.ts";

const samplePath = new URL("../test/system_identification_siso_experiment.csv", import.meta.url);
const base = { na: 4, nb: 2, nk: 2, nc: 1, nf: 4, lambda: 0.05, includeBias: true, maxIterations: 20, tolerance: 1e-5, trainRatio: 0.7, preprocess: "detrend" };

test("项目实验 CSV 可由五种方法完成真实辨识", async (context) => {
  const dataset = parseIdentificationCsvDataset(await readFile(samplePath, "utf8"));
  for (const method of ["arx", "fir", "ridge-arx", "armax", "oe"]) {
    const result = fitIdentification(dataset, { ...base, method, na: method === "fir" ? 0 : base.na });
    const metrics = result.channels[0].validation.simulation;
    assert.equal(result.method, method);
    assert.equal(Number.isFinite(metrics.rmse), true);
    assert.equal(Number.isFinite(metrics.fitPercent), true);
    context.diagnostic(`${method}: 验证自由仿真 ${metrics.fitPercent.toFixed(1)}%, RMSE ${metrics.rmse.toFixed(4)}`);
  }
});
