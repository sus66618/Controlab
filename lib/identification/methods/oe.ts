import type { IdentificationDataset } from "../../identificationData.ts";
import { polynomialRoots } from "../../control/math.ts";
import { evaluateChannels, predictPolynomial } from "../predict.ts";
import { splitAndPreprocess } from "../preprocess.ts";
import { solveLeastSquares } from "../regression.ts";
import type { IdentificationConfig, IdentificationResult, PolynomialModel } from "../types.ts";
import { fitLinearMethod } from "./linear.ts";

export function isStableDiscreteDenominator(coefficients: number[] | undefined) {
  if (!coefficients || coefficients.some((value) => !Number.isFinite(value))) return false;
  return polynomialRoots([1, ...coefficients]).every((root) => Math.hypot(root.re, root.im) < 0.999999);
}

export function fitOutputError(source: IdentificationDataset, config: IdentificationConfig): IdentificationResult {
  if (source.inputNames.length !== 1 || source.outputNames.length !== 1) throw new Error("OE 首版仅支持单输入单输出数据");
  const prepared = splitAndPreprocess(source, config);
  const dataset = prepared.dataset;
  const start = Math.max(config.nf, config.nk + config.nb - 1);
  const parameterCount = config.nf + config.nb + (config.includeBias ? 1 : 0);
  if (prepared.splitIndex - start < parameterCount + 2) throw new Error("训练样本不足以辨识当前 OE 模型");

  const initial = fitLinearMethod(source, { ...config, method: "arx", na: config.nf });
  let theta = [
    ...(config.includeBias ? [initial.model.bias[0]] : []),
    ...initial.model.a[0].map((row) => row[0]),
    ...initial.model.b[0].map((row) => row[0]),
  ];
  if (!isStableDiscreteDenominator(theta.slice(config.includeBias ? 1 : 0, (config.includeBias ? 1 : 0) + config.nf))) {
    const offset = config.includeBias ? 1 : 0;
    theta = [...theta.slice(0, offset), ...Array(config.nf).fill(0), ...theta.slice(offset + config.nf)];
  }

  let damping = 1e-3;
  let converged = false;
  let iterations = 0;
  let rejected = 0;
  for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
    const currentModel = thetaToModel(theta, dataset, config);
    const currentPrediction = predictPolynomial(dataset, currentModel, "simulation", prepared.splitIndex);
    const residual = dataset.outputs.slice(start, prepared.splitIndex).map((row, index) => row[0] - currentPrediction[start + index][0]);
    const loss = squaredNorm(residual);
    const jacobian = residual.map(() => Array(theta.length).fill(0));
    for (let parameter = 0; parameter < theta.length; parameter += 1) {
      const step = 1e-5 * Math.max(1, Math.abs(theta[parameter]));
      const plus = [...theta], minus = [...theta];
      plus[parameter] += step; minus[parameter] -= step;
      const plusPrediction = predictPolynomial(dataset, thetaToModel(plus, dataset, config), "simulation", prepared.splitIndex);
      const minusPrediction = predictPolynomial(dataset, thetaToModel(minus, dataset, config), "simulation", prepared.splitIndex);
      for (let row = 0; row < jacobian.length; row += 1) jacobian[row][parameter] = (plusPrediction[start + row][0] - minusPrediction[start + row][0]) / (2 * step);
    }
    let delta: number[];
    try { delta = solveLeastSquares(jacobian, residual, damping); }
    catch { damping *= 10; rejected += 1; iterations = iteration; if (rejected >= 8) break; continue; }
    const candidate = theta.map((value, index) => value + delta[index]);
    const candidateModel = thetaToModel(candidate, dataset, config);
    const denominator = candidateModel.f ?? [];
    if (!isStableDiscreteDenominator(denominator)) { damping *= 10; rejected += 1; iterations = iteration; if (rejected >= 8) break; continue; }
    const candidatePrediction = predictPolynomial(dataset, candidateModel, "simulation", prepared.splitIndex);
    const candidateResidual = dataset.outputs.slice(start, prepared.splitIndex).map((row, index) => row[0] - candidatePrediction[start + index][0]);
    if (squaredNorm(candidateResidual) >= loss || candidate.some((value) => !Number.isFinite(value))) {
      damping *= 10; rejected += 1; iterations = iteration; if (rejected >= 8) break; continue;
    }
    theta = candidate;
    damping = Math.max(1e-9, damping / 3);
    rejected = 0;
    iterations = iteration;
    if (Math.hypot(...delta) / Math.max(1, Math.hypot(...theta)) < config.tolerance) { converged = true; break; }
  }

  const model = thetaToModel(theta, dataset, config);
  const oneStepPrepared = predictPolynomial(dataset, model, "oneStep", prepared.splitIndex);
  const simulationPrepared = predictPolynomial(dataset, model, "simulation", prepared.splitIndex);
  const oneStep = prepared.restoreOutputs(oneStepPrepared);
  const simulation = prepared.restoreOutputs(simulationPrepared);
  const residuals = source.outputs.map((row, index) => [row[0] - oneStep[index][0]]);
  return {
    method: "oe", config, model, splitIndex: prepared.splitIndex, parameterCount,
    predictions: { oneStep, simulation, residuals },
    channels: evaluateChannels(source, oneStep, simulation, prepared.splitIndex, start, parameterCount),
    iterations, converged,
    methodNote: converged ? "OE 输出误差法已收敛" : "OE 返回当前真实最优结果，但未达到收敛阈值",
    dataset: source,
  };
}

function thetaToModel(theta: number[], dataset: IdentificationDataset, config: IdentificationConfig): PolynomialModel {
  let cursor = 0;
  const bias = config.includeBias ? theta[cursor++] : 0;
  const f = theta.slice(cursor, cursor += config.nf);
  const b = theta.slice(cursor, cursor + config.nb);
  return {
    method: "oe", na: config.nf, nb: config.nb, nk: config.nk,
    inputNames: [...dataset.inputNames], outputNames: [...dataset.outputNames],
    a: [f.map((value) => [value])], b: [b.map((value) => [value])], bias: [bias], f,
  };
}

function squaredNorm(values: number[]) { return values.reduce((sum, value) => sum + value * value, 0); }
