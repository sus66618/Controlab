import { complex, padLeft, polyEval, polynomialRoots } from "./math.ts";
import { normalizeModel } from "./model.ts";
import type { AnalysisResult, Complex, InputSignal, ResponsePoint, TransferModel } from "./types.ts";

const EPS = 1e-10;

export function evaluateTransfer(model: TransferModel, s: Complex): Complex {
  const normalized = normalizeModel(model);
  return complex.div(polyEval(normalized.numerator, s), polyEval(normalized.denominator, s));
}

function frequencyBounds(model: TransferModel): [number, number] {
  const values = [...polynomialRoots(model.denominator), ...polynomialRoots(model.numerator)]
    .map(complex.abs)
    .filter((value) => value > 1e-4 && Number.isFinite(value));
  if (!values.length) return [0.01, 100];
  return [Math.max(1e-3, Math.min(...values) / 100), Math.min(1e4, Math.max(...values) * 100)];
}

export function frequencyResponse(model: TransferModel, count = 260) {
  const [minimum, maximum] = frequencyBounds(model);
  const start = Math.log10(minimum);
  const end = Math.log10(maximum);
  const result = Array.from({ length: count }, (_, index) => {
    const omega = 10 ** (start + ((end - start) * index) / (count - 1));
    const value = evaluateTransfer(model, { re: 0, im: omega });
    return {
      omega,
      value,
      magnitude: 20 * Math.log10(Math.max(complex.abs(value), EPS)),
      phase: (Math.atan2(value.im, value.re) * 180) / Math.PI,
    };
  });
  for (let index = 1; index < result.length; index += 1) {
    while (result[index].phase - result[index - 1].phase > 180) result[index].phase -= 360;
    while (result[index].phase - result[index - 1].phase < -180) result[index].phase += 360;
  }
  return result;
}

function interpolateCrossing(a: number, b: number, ya: number, yb: number, target: number) {
  const ratio = Math.abs(yb - ya) < EPS ? 0 : (target - ya) / (yb - ya);
  return a + (b - a) * Math.min(1, Math.max(0, ratio));
}

export function stabilityMargins(model: TransferModel) {
  const response = frequencyResponse(model, 720);
  let gainCrossover: number | null = null;
  let phaseAtGain = 0;
  let phaseCrossover: number | null = null;
  let magnitudeAtPhase = 0;
  for (let index = 1; index < response.length; index += 1) {
    const a = response[index - 1];
    const b = response[index];
    if (gainCrossover === null && (a.magnitude >= 0) !== (b.magnitude >= 0)) {
      const x = interpolateCrossing(Math.log10(a.omega), Math.log10(b.omega), a.magnitude, b.magnitude, 0);
      gainCrossover = 10 ** x;
      phaseAtGain = interpolateCrossing(a.phase, b.phase, a.magnitude, b.magnitude, 0);
    }
    if (phaseCrossover === null && (a.phase >= -180) !== (b.phase >= -180)) {
      const x = interpolateCrossing(Math.log10(a.omega), Math.log10(b.omega), a.phase, b.phase, -180);
      phaseCrossover = 10 ** x;
      magnitudeAtPhase = interpolateCrossing(a.magnitude, b.magnitude, a.phase, b.phase, -180);
    }
  }
  return {
    gainCrossover,
    phaseMargin: gainCrossover === null ? null : 180 + phaseAtGain,
    phaseCrossover,
    gainMargin: phaseCrossover === null ? null : -magnitudeAtPhase,
  };
}

export function rootLocus(model: TransferModel, count = 130): Complex[][] {
  const normalized = normalizeModel(model);
  const length = Math.max(normalized.denominator.length, normalized.numerator.length);
  const denominator = padLeft(normalized.denominator, length);
  const numerator = padLeft(normalized.numerator, length);
  const gains = [0, ...Array.from({ length: count - 1 }, (_, index) => 10 ** (-3 + (6 * index) / (count - 2)))];
  const rootSets = gains.map((gain) => polynomialRoots(denominator.map((value, index) => value + gain * numerator[index])));
  const branches: Complex[][] = rootSets[0].map((root) => [root]);
  for (let step = 1; step < rootSets.length; step += 1) {
    const available = [...rootSets[step]];
    branches.forEach((branch) => {
      const previous = branch[branch.length - 1];
      let bestIndex = 0;
      let bestDistance = Infinity;
      available.forEach((candidate, index) => {
        const distance = complex.abs(complex.sub(candidate, previous));
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      branch.push(available.splice(bestIndex, 1)[0]);
    });
  }
  return branches;
}

export function nyquist(model: TransferModel) {
  const positive = frequencyResponse(model, 320).map((point) => point.value);
  return [...positive.map((point) => ({ re: point.re, im: -point.im })).reverse(), ...positive];
}

function stateDerivative(state: number[], input: number, denominator: number[]) {
  const result = Array(state.length).fill(0);
  for (let index = 0; index < state.length - 1; index += 1) result[index] = state[index + 1];
  result[state.length - 1] = input;
  for (let index = 0; index < state.length; index += 1) {
    result[state.length - 1] -= denominator[denominator.length - 1 - index] * state[index];
  }
  return result;
}

function addScaled(a: number[], b: number[], scale: number) {
  return a.map((value, index) => value + b[index] * scale);
}

export function simulateResponse(model: TransferModel, inputType: InputSignal, duration = 12, count = 700): ResponsePoint[] {
  const normalized = normalizeModel(model);
  const order = normalized.denominator.length - 1;
  if (order < 1) throw new Error("分母至少需要一阶动态");
  const numerator = padLeft(normalized.numerator, order + 1);
  const direct = numerator[0];
  const outputVector = Array.from(
    { length: order },
    (_, index) => numerator[order - index] - direct * normalized.denominator[order - index],
  );
  const inputAt = (time: number) => inputType === "step" ? 1 : inputType === "ramp" ? time : Math.sin(time);
  const dt = duration / (count - 1);
  let state = Array(order).fill(0);
  const points: ResponsePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const time = index * dt;
    const input = inputAt(time);
    const output = outputVector.reduce((sum, coefficient, i) => sum + coefficient * state[i], direct * input);
    points.push({ t: time, input, output: Number.isFinite(output) ? Math.max(-1e6, Math.min(1e6, output)) : 0 });
    const k1 = stateDerivative(state, inputAt(time), normalized.denominator);
    const k2 = stateDerivative(addScaled(state, k1, dt / 2), inputAt(time + dt / 2), normalized.denominator);
    const k3 = stateDerivative(addScaled(state, k2, dt / 2), inputAt(time + dt / 2), normalized.denominator);
    const k4 = stateDerivative(addScaled(state, k3, dt), inputAt(time + dt), normalized.denominator);
    state = state.map((value, i) => value + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  return points;
}

export function systemSummary(model: TransferModel) {
  const poles = polynomialRoots(model.denominator);
  const zeros = polynomialRoots(model.numerator);
  const stable = poles.every((pole) => pole.re < -1e-7);
  const marginal = !stable && poles.every((pole) => pole.re <= 1e-7);
  return { poles, zeros, stable, marginal };
}

export function analyzeSystem(model: TransferModel, inputSignal: InputSignal, duration: number): AnalysisResult {
  return {
    summary: systemSummary(model),
    margins: stabilityMargins(model),
    frequency: frequencyResponse(model),
    response: simulateResponse(model, inputSignal, duration),
    locus: rootLocus(model),
    nyquist: nyquist(model),
  };
}
