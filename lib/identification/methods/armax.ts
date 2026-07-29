import type { IdentificationDataset } from "../../identificationData.ts";
import { evaluateChannels, predictPolynomial } from "../predict.ts";
import { splitAndPreprocess } from "../preprocess.ts";
import { solveLeastSquares } from "../regression.ts";
import type { IdentificationConfig, IdentificationResult, PolynomialModel } from "../types.ts";
import { fitLinearMethod, regressionRow } from "./linear.ts";

export function fitArmax(source: IdentificationDataset, config: IdentificationConfig): IdentificationResult {
  const prepared = splitAndPreprocess(source, config);
  const dataset = prepared.dataset;
  const start = Math.max(config.na, config.nk + config.nb - 1, config.nc);
  const outputCount = dataset.outputNames.length;
  const inputCount = dataset.inputNames.length;
  const parameterCount = (config.includeBias ? 1 : 0) + config.na * outputCount + config.nb * inputCount + config.nc;
  if (prepared.splitIndex - start < parameterCount + 1) throw new Error("训练样本不足以辨识当前 ARMAX 模型");

  const initial = fitLinearMethod(source, { ...config, method: "ridge-arx", lambda: 1e-5 });
  let model: PolynomialModel = { ...initial.model, method: "armax", c: Array.from({ length: outputCount }, () => Array(config.nc).fill(0)) };
  let residuals = armaxOneStep(dataset, model).residuals;
  let previous = flattenModel(model);
  let converged = false;
  let iterations = 0;

  iterationsLoop: for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
    const a: number[][][] = [], b: number[][][] = [], bias: number[] = [], c: number[][] = [];
    for (let output = 0; output < outputCount; output += 1) {
      const rows = Array.from({ length: prepared.splitIndex - start }, (_, offset) => {
        const index = start + offset;
        return [...regressionRow(dataset, index, config, config.includeBias), ...Array.from({ length: config.nc }, (_, lag) => residuals[index - lag - 1][output])];
      });
      const target = dataset.outputs.slice(start, prepared.splitIndex).map((row) => row[output]);
      // ELS 后期残差列可能近似共线，极小岭项只用于数值消歧，不改变模型结构。
      let theta: number[];
      try { theta = solveLeastSquares(rows, target, 1e-5); }
      catch { iterations = iteration; break iterationsLoop; }
      let cursor = 0;
      bias.push(config.includeBias ? theta[cursor++] : 0);
      a.push(Array.from({ length: config.na }, () => theta.slice(cursor, cursor += outputCount)));
      b.push(Array.from({ length: config.nb }, () => theta.slice(cursor, cursor += inputCount)));
      c.push(theta.slice(cursor, cursor + config.nc));
    }
    model = { method: "armax", na: config.na, nb: config.nb, nk: config.nk, inputNames: [...dataset.inputNames], outputNames: [...dataset.outputNames], a, b, bias, c };
    const next = flattenModel(model);
    const change = Math.hypot(...next.map((value, index) => value - previous[index])) / Math.max(1, Math.hypot(...previous));
    residuals = armaxOneStep(dataset, model).residuals;
    previous = next;
    iterations = iteration;
    if (change < config.tolerance) { converged = true; break; }
  }

  const oneStepPrepared = armaxOneStep(dataset, model).predictions;
  const simulationPrepared = predictPolynomial(dataset, model, "simulation", prepared.splitIndex);
  const oneStep = prepared.restoreOutputs(oneStepPrepared);
  const simulation = prepared.restoreOutputs(simulationPrepared);
  const restoredResiduals = source.outputs.map((row, index) => row.map((value, output) => value - oneStep[index][output]));
  return {
    method: "armax", config, model, splitIndex: prepared.splitIndex, parameterCount,
    predictions: { oneStep, simulation, residuals: restoredResiduals },
    channels: evaluateChannels(source, oneStep, simulation, prepared.splitIndex, start, parameterCount),
    iterations, converged,
    methodNote: outputCount > 1 ? "VARMAX（各输出采用独立的对角噪声模型）" : "ARMAX 迭代扩展最小二乘",
    dataset: source,
  };
}

function armaxOneStep(dataset: IdentificationDataset, model: PolynomialModel) {
  const start = Math.max(model.na, model.nk + model.nb - 1, model.c?.[0]?.length ?? 0);
  const predictions = dataset.outputs.map((row) => [...row]);
  const residuals = dataset.outputs.map((row) => row.map(() => 0));
  for (let index = start; index < dataset.time.length; index += 1) {
    predictions[index] = model.outputNames.map((_, output) => {
      const outputPart = model.a[output].reduce((sum, coefficients, lag) => sum - coefficients.reduce((part, value, source) => part + value * dataset.outputs[index - lag - 1][source], 0), 0);
      const inputPart = model.b[output].reduce((sum, coefficients, lag) => sum + coefficients.reduce((part, value, input) => part + value * dataset.inputs[index - model.nk - lag][input], 0), 0);
      const noisePart = (model.c?.[output] ?? []).reduce((sum, value, lag) => sum + value * residuals[index - lag - 1][output], 0);
      return model.bias[output] + outputPart + inputPart + noisePart;
    });
    residuals[index] = dataset.outputs[index].map((value, output) => value - predictions[index][output]);
  }
  return { predictions, residuals };
}

function flattenModel(model: PolynomialModel) {
  return [...model.bias, ...model.a.flat(2), ...model.b.flat(2), ...(model.c?.flat() ?? [])];
}
