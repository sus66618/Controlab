export type Complex = { re: number; im: number };

export type Model = {
  numerator: number[];
  denominator: number[];
};

export type ResponsePoint = { t: number; input: number; output: number };

const EPS = 1e-10;

const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const div = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im || EPS;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const abs = (a: Complex) => Math.hypot(a.re, a.im);

export function parseCoefficients(value: string): number[] {
  const values = value
    .trim()
    .split(/[\s,，;；]+/)
    .filter(Boolean)
    .map(Number);
  if (!values.length || values.some((item) => !Number.isFinite(item))) {
    throw new Error("请输入用逗号或空格分隔的有效数字");
  }
  while (values.length > 1 && Math.abs(values[0]) < EPS) values.shift();
  return values;
}

function normalize(model: Model): Model {
  const denominator = [...model.denominator];
  const numerator = [...model.numerator];
  if (Math.abs(denominator[0]) < EPS) throw new Error("分母最高次项不能为 0");
  if (numerator.length > denominator.length) throw new Error("当前版本仅支持真有理或正则传递函数");
  const lead = denominator[0];
  return {
    numerator: numerator.map((v) => v / lead),
    denominator: denominator.map((v) => v / lead),
  };
}

function polyEval(coefficients: number[], z: Complex): Complex {
  return coefficients.reduce<Complex>((acc, coefficient) => add(mul(acc, z), { re: coefficient, im: 0 }), { re: 0, im: 0 });
}

export function polynomialRoots(coefficients: number[]): Complex[] {
  const coeffs = [...coefficients];
  while (coeffs.length > 1 && Math.abs(coeffs[0]) < EPS) coeffs.shift();
  const degree = coeffs.length - 1;
  if (degree <= 0) return [];
  if (degree === 1) return [{ re: -coeffs[1] / coeffs[0], im: 0 }];
  const normalized = coeffs.map((v) => v / coeffs[0]);
  const radius = 1 + Math.max(...normalized.slice(1).map(Math.abs));
  let roots = Array.from({ length: degree }, (_, index) => {
    const angle = (2 * Math.PI * index) / degree + 0.17;
    return { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
  });

  for (let iteration = 0; iteration < 180; iteration += 1) {
    let movement = 0;
    roots = roots.map((root, index) => {
      let denominator: Complex = { re: 1, im: 0 };
      roots.forEach((other, otherIndex) => {
        if (otherIndex !== index) denominator = mul(denominator, sub(root, other));
      });
      const delta = div(polyEval(normalized, root), denominator);
      movement = Math.max(movement, abs(delta));
      return sub(root, delta);
    });
    if (movement < 1e-9) break;
  }
  return roots.map((root) => ({ re: Math.abs(root.re) < 1e-8 ? 0 : root.re, im: Math.abs(root.im) < 1e-8 ? 0 : root.im }));
}

export function evaluateTransfer(model: Model, s: Complex): Complex {
  const value = normalize(model);
  return div(polyEval(value.numerator, s), polyEval(value.denominator, s));
}

function frequencyBounds(model: Model): [number, number] {
  const values = [...polynomialRoots(model.denominator), ...polynomialRoots(model.numerator)]
    .map(abs)
    .filter((value) => value > 1e-4 && Number.isFinite(value));
  if (!values.length) return [0.01, 100];
  return [Math.max(1e-3, Math.min(...values) / 100), Math.min(1e4, Math.max(...values) * 100)];
}

export function frequencyResponse(model: Model, count = 260) {
  const [minimum, maximum] = frequencyBounds(model);
  const start = Math.log10(minimum);
  const end = Math.log10(maximum);
  const raw = Array.from({ length: count }, (_, index) => {
    const omega = 10 ** (start + ((end - start) * index) / (count - 1));
    const value = evaluateTransfer(model, { re: 0, im: omega });
    return { omega, value, magnitude: 20 * Math.log10(Math.max(abs(value), EPS)), phase: (Math.atan2(value.im, value.re) * 180) / Math.PI };
  });
  for (let index = 1; index < raw.length; index += 1) {
    while (raw[index].phase - raw[index - 1].phase > 180) raw[index].phase -= 360;
    while (raw[index].phase - raw[index - 1].phase < -180) raw[index].phase += 360;
  }
  return raw;
}

function interpolateCrossing(a: number, b: number, ya: number, yb: number, target: number) {
  const ratio = Math.abs(yb - ya) < EPS ? 0 : (target - ya) / (yb - ya);
  return a + (b - a) * Math.min(1, Math.max(0, ratio));
}

export function stabilityMargins(model: Model) {
  const response = frequencyResponse(model, 720);
  let gainCrossover: number | null = null;
  let phaseAtGain = 0;
  let phaseCrossover: number | null = null;
  let magnitudeAtPhase = 0;
  for (let i = 1; i < response.length; i += 1) {
    const a = response[i - 1];
    const b = response[i];
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

function padLeft(values: number[], length: number) {
  return [...Array(Math.max(0, length - values.length)).fill(0), ...values];
}

export function rootLocus(model: Model, count = 130): Complex[][] {
  const value = normalize(model);
  const length = Math.max(value.denominator.length, value.numerator.length);
  const den = padLeft(value.denominator, length);
  const num = padLeft(value.numerator, length);
  const gains = [0, ...Array.from({ length: count - 1 }, (_, index) => 10 ** (-3 + (6 * index) / (count - 2)))];
  const sets = gains.map((gain) => polynomialRoots(den.map((coefficient, index) => coefficient + gain * num[index])));
  const branches: Complex[][] = sets[0].map((root) => [root]);
  for (let step = 1; step < sets.length; step += 1) {
    const available = [...sets[step]];
    branches.forEach((branch) => {
      const previous = branch[branch.length - 1];
      let bestIndex = 0;
      let bestDistance = Infinity;
      available.forEach((candidate, index) => {
        const distance = abs(sub(candidate, previous));
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

export function nyquist(model: Model) {
  const positive = frequencyResponse(model, 320).map((point) => point.value);
  return [...positive.map((point) => ({ re: point.re, im: -point.im })).reverse(), ...positive];
}

function stateDerivative(state: number[], input: number, denominator: number[]) {
  const result = Array(state.length).fill(0);
  for (let i = 0; i < state.length - 1; i += 1) result[i] = state[i + 1];
  result[state.length - 1] = input;
  for (let i = 0; i < state.length; i += 1) result[state.length - 1] -= denominator[denominator.length - 1 - i] * state[i];
  return result;
}

function addScaled(a: number[], b: number[], scale: number) {
  return a.map((value, index) => value + b[index] * scale);
}

export function simulateResponse(model: Model, inputType: "step" | "ramp" | "sine", duration = 12, count = 700): ResponsePoint[] {
  const value = normalize(model);
  const order = value.denominator.length - 1;
  if (order < 1) throw new Error("分母至少需要一阶动态");
  const numerator = padLeft(value.numerator, order + 1);
  const direct = numerator[0];
  const outputVector = Array.from({ length: order }, (_, index) => numerator[order - index] - direct * value.denominator[order - index]);
  const inputAt = (time: number) => inputType === "step" ? 1 : inputType === "ramp" ? time : Math.sin(time);
  const dt = duration / (count - 1);
  let state = Array(order).fill(0);
  const points: ResponsePoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const time = index * dt;
    const input = inputAt(time);
    const output = outputVector.reduce((sum, coefficient, i) => sum + coefficient * state[i], direct * input);
    points.push({ t: time, input, output: Number.isFinite(output) ? Math.max(-1e6, Math.min(1e6, output)) : 0 });
    const k1 = stateDerivative(state, inputAt(time), value.denominator);
    const k2 = stateDerivative(addScaled(state, k1, dt / 2), inputAt(time + dt / 2), value.denominator);
    const k3 = stateDerivative(addScaled(state, k2, dt / 2), inputAt(time + dt / 2), value.denominator);
    const k4 = stateDerivative(addScaled(state, k3, dt), inputAt(time + dt), value.denominator);
    state = state.map((item, i) => item + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  return points;
}

export function formatPolynomial(coefficients: number[], variable = "s") {
  const degree = coefficients.length - 1;
  const terms = coefficients.flatMap((coefficient, index) => {
    if (Math.abs(coefficient) < EPS) return [];
    const power = degree - index;
    const sign = coefficient < 0 ? "−" : "+";
    const magnitude = Math.abs(coefficient);
    const number = magnitude === 1 && power > 0 ? "" : Number(magnitude.toFixed(4)).toString();
    const symbol = power === 0 ? "" : power === 1 ? variable : `${variable}^${power}`;
    return [{ sign, text: `${number}${symbol}` }];
  });
  if (!terms.length) return "0";
  return terms.map((term, index) => `${index === 0 && term.sign === "+" ? "" : `${term.sign} `}${term.text}`).join(" ");
}

export function systemSummary(model: Model) {
  const poles = polynomialRoots(model.denominator);
  const zeros = polynomialRoots(model.numerator);
  const stable = poles.every((pole) => pole.re < -1e-7);
  const marginal = !stable && poles.every((pole) => pole.re <= 1e-7);
  return { poles, zeros, stable, marginal };
}
