import { normalizeModel } from "./model.ts";
import type { ControllerConfig, ResponseMetrics, ResponsePoint, TransferModel } from "./types.ts";

function multiply(a: number[], b: number[]) {
  const result = Array(a.length + b.length - 1).fill(0);
  a.forEach((left, i) => b.forEach((right, j) => { result[i + j] += left * right; }));
  return result;
}

function add(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  const left = [...Array(length - a.length).fill(0), ...a];
  const right = [...Array(length - b.length).fill(0), ...b];
  return left.map((value, index) => value + right[index]);
}

export const DEFAULT_CONTROLLER: ControllerConfig = {
  kind: "pid",
  kp: 2,
  ki: 1,
  kd: 0.18,
  gain: 1,
  tau: 1,
  ratio: 0.2,
};

export function controllerTransfer(config: ControllerConfig): TransferModel {
  const filter = 0.02;
  if (config.kind === "p") return normalizeModel({ numerator: [config.kp], denominator: [1] });
  if (config.kind === "pi") return normalizeModel({ numerator: [config.kp, config.ki], denominator: [1, 0] });
  if (config.kind === "pd") {
    return normalizeModel({ numerator: [config.kp * filter + config.kd, config.kp], denominator: [filter, 1] });
  }
  if (config.kind === "pid") {
    return normalizeModel({
      numerator: [config.kp * filter + config.kd, config.kp + config.ki * filter, config.ki],
      denominator: [filter, 1, 0],
    });
  }
  if (config.kind === "lead") {
    const alpha = Math.min(0.95, Math.max(0.05, config.ratio));
    return normalizeModel({ numerator: [config.gain * config.tau, config.gain], denominator: [alpha * config.tau, 1] });
  }
  const beta = Math.max(1.05, config.ratio);
  return normalizeModel({ numerator: [config.gain * config.tau, config.gain], denominator: [beta * config.tau, 1] });
}

export function seriesModel(a: TransferModel, b: TransferModel): TransferModel {
  return normalizeModel({
    numerator: multiply(a.numerator, b.numerator),
    denominator: multiply(a.denominator, b.denominator),
  });
}

export function feedbackModels(
  plant: TransferModel,
  controller: TransferModel,
  feedback: TransferModel = { numerator: [1], denominator: [1] },
) {
  const forward = seriesModel(plant, controller);
  const loop = seriesModel(forward, feedback);
  const closed = normalizeModel({
    numerator: multiply(forward.numerator, feedback.denominator),
    denominator: add(
      multiply(forward.denominator, feedback.denominator),
      multiply(forward.numerator, feedback.numerator),
    ),
  });
  return { forward, loop, closed };
}

export function responseMetrics(points: ResponsePoint[]): ResponseMetrics {
  if (points.length < 3) return { overshoot: null, riseTime: null, settlingTime: null, steadyError: null };
  const tail = points.slice(Math.floor(points.length * 0.92));
  const steady = tail.reduce((sum, point) => sum + point.output, 0) / tail.length;
  const reference = points[points.length - 1].input;
  const scale = Math.max(Math.abs(steady), 1e-8);
  const peak = steady >= 0 ? Math.max(...points.map((point) => point.output)) : Math.min(...points.map((point) => point.output));
  const overshoot = Math.max(0, ((Math.abs(peak) - Math.abs(steady)) / scale) * 100);
  const direction = steady >= 0 ? 1 : -1;
  const firstAt = (fraction: number) => points.find((point) => direction * point.output >= direction * steady * fraction)?.t ?? null;
  const t10 = firstAt(0.1);
  const t90 = firstAt(0.9);
  let settlingTime: number | null = null;
  const band = Math.max(scale * 0.02, 1e-4);
  for (let index = 0; index < points.length; index += 1) {
    if (points.slice(index).every((point) => Math.abs(point.output - steady) <= band)) {
      settlingTime = points[index].t;
      break;
    }
  }
  return {
    overshoot: Number.isFinite(overshoot) ? overshoot : null,
    riseTime: t10 === null || t90 === null ? null : Math.max(0, t90 - t10),
    settlingTime,
    steadyError: Number.isFinite(reference - steady) ? Math.abs(reference - steady) : null,
  };
}
