import type { IdentificationDataset } from "../../identificationData.ts";
import { evaluateChannels, modelStart, predictPolynomial } from "../predict.ts";
import { splitAndPreprocess } from "../preprocess.ts";
import { solveLeastSquares } from "../regression.ts";
import type { IdentificationConfig, IdentificationResult, PolynomialModel } from "../types.ts";

export function fitLinearMethod(source: IdentificationDataset, config: IdentificationConfig): IdentificationResult {
  const prepared = splitAndPreprocess(source, config);
  const dataset = prepared.dataset;
  const outputCount = dataset.outputNames.length;
  const inputCount = dataset.inputNames.length;
  const na = config.method === "fir" ? 0 : config.na;
  const modelShape = { na, nb: config.nb, nk: config.nk };
  const start = Math.max(na, config.nk + config.nb - 1);
  const parameterCount = (config.includeBias ? 1 : 0) + na * outputCount + config.nb * inputCount;
  if (parameterCount > 200) throw new Error("当前维度与阶次产生了超过 200 个参数，请降低阶次或通道数");
  if (prepared.splitIndex - start < parameterCount + 1) throw new Error("训练样本不足以辨识当前模型");
  const rows = Array.from({ length: prepared.splitIndex - start }, (_, offset) => regressionRow(dataset, start + offset, modelShape, config.includeBias));
  const lambda = config.method === "ridge-arx" ? config.lambda : 0;
  const a: number[][][] = [], b: number[][][] = [], bias: number[] = [];
  for (let output = 0; output < outputCount; output += 1) {
    const target = dataset.outputs.slice(start, prepared.splitIndex).map((row) => row[output]);
    const theta = solveLeastSquares(rows, target, lambda, config.includeBias ? new Set([0]) : new Set());
    let cursor = 0;
    bias.push(config.includeBias ? theta[cursor++] : 0);
    a.push(Array.from({ length: na }, () => theta.slice(cursor, cursor += outputCount)));
    b.push(Array.from({ length: config.nb }, () => theta.slice(cursor, cursor += inputCount)));
  }
  const model: PolynomialModel = { method: config.method, ...modelShape, inputNames: [...dataset.inputNames], outputNames: [...dataset.outputNames], a, b, bias };
  const oneStepPrepared = predictPolynomial(dataset, model, "oneStep", prepared.splitIndex);
  const simulationPrepared = predictPolynomial(dataset, model, "simulation", prepared.splitIndex);
  const oneStep = prepared.restoreOutputs(oneStepPrepared);
  const simulation = prepared.restoreOutputs(simulationPrepared);
  const residuals = source.outputs.map((row, index) => row.map((value, output) => value - oneStep[index][output]));
  return {
    method: config.method, config, model, splitIndex: prepared.splitIndex, parameterCount,
    predictions: { oneStep, simulation, residuals },
    channels: evaluateChannels(source, oneStep, simulation, prepared.splitIndex, modelStart(model), parameterCount),
    iterations: 1, converged: true,
    methodNote: config.method === "fir" ? "有限脉冲响应模型" : config.method === "ridge-arx" ? "岭正则化 ARX" : "最小二乘 ARX",
    dataset: source,
  };
}
export function regressionRow(dataset: IdentificationDataset, index: number, orders: { na: number; nb: number; nk: number }, includeBias: boolean) {
  return [
    ...(includeBias ? [1] : []),
    ...Array.from({ length: orders.na }, (_, lag) => dataset.outputs[index - lag - 1].map((value) => -value)).flat(),
    ...Array.from({ length: orders.nb }, (_, lag) => dataset.inputs[index - orders.nk - lag]).flat(),
  ];
}
