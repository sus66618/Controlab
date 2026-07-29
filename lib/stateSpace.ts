import { polynomialRoots } from "./control.ts";
import type { Complex } from "./control.ts";

export type StateInputKind = "zero" | "step" | "sine" | "ramp";
export type StateInputConfig = { kind: StateInputKind; amplitude: number; frequency: number; startTime: number };
export type LinearStability = "unstable" | "lyapunov" | "asymptotic";

export type StateSpacePreset = {
  id: string;
  name: string;
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
  initial: number[];
  inputs: StateInputConfig[];
  plotAxes: [number, number];
  duration: number;
};

export type StateSample = { t: number; state: number[]; input: number[]; output: number[] };

const input = (kind: StateInputKind, amplitude: number, frequency = 0.5, startTime = 0) => ({ kind, amplitude, frequency, startTime });

export const STATE_SPACE_PRESETS: StateSpacePreset[] = [
  { id: "mass-spring", name: "质量–弹簧–阻尼", A: [[0, 1], [-4, -0.8]], B: [[0], [1]], C: [[1, 0]], D: [[0]], initial: [1, 0], inputs: [input("zero", 0)], plotAxes: [0, 1], duration: 12 },
  { id: "dc-motor", name: "直流电机", A: [[-2, 1], [-0.5, -4]], B: [[0], [2]], C: [[1, 0]], D: [[0]], initial: [0, 0], inputs: [input("step", 1)], plotAxes: [0, 1], duration: 6 },
  { id: "sensor-demo", name: "双模态系统", A: [[-1, 0], [0, -2]], B: [[1], [1]], C: [[1, 0]], D: [[0]], initial: [1, -0.8], inputs: [input("zero", 0)], plotAxes: [0, 1], duration: 6 },
  { id: "cart-pole", name: "倒立摆线性模型", A: [[0, 1, 0, 0], [0, -0.0769, -1.1319, 0], [0, 0, 0, 1], [0, 0.0995, 14.149, 0]], B: [[0], [0.9615], [0], [-1.2434]], C: [[1, 0, 0, 0], [0, 0, 1, 0]], D: [[0], [0]], initial: [0, 0, 0.08, 0], inputs: [input("zero", 0)], plotAxes: [0, 2], duration: 3.5 },
];

export function emptyStateSpace(order = 2, inputs = 1, outputs = 1): StateSpacePreset {
  return {
    id: "custom",
    name: "自定义系统",
    A: zeroMatrix(order, order),
    B: zeroMatrix(order, inputs),
    C: zeroMatrix(outputs, order),
    D: zeroMatrix(outputs, inputs),
    initial: Array(order).fill(0),
    inputs: Array.from({ length: inputs }, () => input("zero", 0)),
    plotAxes: [0, Math.min(1, order - 1)],
    duration: 8,
  };
}

export function clonePreset(preset: StateSpacePreset): StateSpacePreset {
  return { ...preset, A: preset.A.map((row) => [...row]), B: preset.B.map((row) => [...row]), C: preset.C.map((row) => [...row]), D: preset.D.map((row) => [...row]), initial: [...preset.initial], inputs: preset.inputs.map((item) => ({ ...item })), plotAxes: [...preset.plotAxes] as [number, number] };
}

export function createInitialStateSpaceModel() {
  return clonePreset(STATE_SPACE_PRESETS[0]);
}

export function resizeStateSpace(model: StateSpacePreset, order: number, inputCount: number, outputCount: number): StateSpacePreset {
  return {
    ...model,
    id: "custom",
    name: "自定义系统",
    A: resizeMatrix(model.A, order, order),
    B: resizeMatrix(model.B, order, inputCount),
    C: resizeMatrix(model.C, outputCount, order),
    D: resizeMatrix(model.D, outputCount, inputCount),
    initial: resizeVector(model.initial, order),
    inputs: Array.from({ length: inputCount }, (_, index) => model.inputs[index] ? { ...model.inputs[index] } : input("zero", 0)),
    plotAxes: [Math.min(model.plotAxes[0], order - 1), Math.min(model.plotAxes[1], order - 1)],
  };
}

export function parseMatrixText(text: string, rows: number, columns: number) {
  const parsed = text.trim().split(/\n|;/).filter(Boolean).map((row) => row.trim().split(/[\s,，]+/).filter(Boolean).map(Number));
  if (parsed.length !== rows || parsed.some((row) => row.length !== columns || row.some((value) => !Number.isFinite(value)))) throw new Error(`请输入 ${rows}×${columns} 个有效数字`);
  return parsed;
}

export function controllabilityMatrix(A: number[][], B: number[][]) {
  const order = A.length;
  const blocks: number[][][] = [];
  let block = B.map((row) => [...row]);
  for (let index = 0; index < order; index += 1) {
    blocks.push(block);
    block = multiplyMatrices(A, block);
  }
  return Array.from({ length: order }, (_, row) => blocks.flatMap((matrix) => matrix[row]));
}

export function observabilityMatrix(A: number[][], C: number[][]) {
  const order = A.length;
  const rows: number[][] = [];
  let power = identity(order);
  for (let index = 0; index < order; index += 1) {
    rows.push(...multiplyMatrices(C, power));
    power = multiplyMatrices(power, A);
  }
  return rows;
}

export function matrixRank(matrix: number[][], tolerance = 1e-8) {
  if (!matrix.length || !matrix[0]?.length) return 0;
  const work = matrix.map((row) => [...row]);
  let rank = 0;
  for (let column = 0; column < work[0].length && rank < work.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < work.length; row += 1) if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    if (Math.abs(work[pivot][column]) <= tolerance) continue;
    [work[rank], work[pivot]] = [work[pivot], work[rank]];
    const scale = work[rank][column];
    for (let col = column; col < work[0].length; col += 1) work[rank][col] /= scale;
    for (let row = 0; row < work.length; row += 1) {
      if (row === rank) continue;
      const factor = work[row][column];
      for (let col = column; col < work[0].length; col += 1) work[row][col] -= factor * work[rank][col];
    }
    rank += 1;
  }
  return rank;
}

export function stateEigenvalues(A: number[][]): Complex[] {
  return polynomialRoots(characteristicPolynomial(A)).sort((left, right) => left.re - right.re || left.im - right.im);
}

export function classifyLinearStability(A: number[][], eigenvalues = stateEigenvalues(A)): LinearStability {
  const tolerance = 1e-6;
  if (eigenvalues.some((value) => value.re > tolerance)) return "unstable";
  if (eigenvalues.every((value) => value.re < -tolerance)) return "asymptotic";
  const boundary: Complex[][] = [];
  eigenvalues.filter((value) => Math.abs(value.re) <= tolerance).forEach((value) => {
    const group = boundary.find((items) => Math.hypot(items[0].re - value.re, items[0].im - value.im) < 1e-4);
    if (group) group.push(value); else boundary.push([value]);
  });
  const semisimple = boundary.every((group) => A.length - complexMatrixRank(shiftComplexMatrix(A, group[0])) >= group.length);
  return semisimple ? "lyapunov" : "unstable";
}

export function analyzeStateSpace(A: number[][], B: number[][], C: number[][]) {
  const controllability = controllabilityMatrix(A, B);
  const observability = observabilityMatrix(A, C);
  const eigenvalues = stateEigenvalues(A);
  return {
    controllability,
    observability,
    controllabilityRank: matrixRank(controllability),
    observabilityRank: matrixRank(observability),
    eigenvalues,
    stability: classifyLinearStability(A, eigenvalues),
  };
}

export function inputVectorAtTime(configs: StateInputConfig[], time: number) {
  return configs.map((config) => {
    const elapsed = time - config.startTime;
    if (elapsed < 0 || config.kind === "zero") return 0;
    if (config.kind === "step") return config.amplitude;
    if (config.kind === "ramp") return config.amplitude * elapsed;
    return config.amplitude * Math.sin(2 * Math.PI * config.frequency * elapsed);
  });
}

export function simulateStateSpace(A: number[][], B: number[][], C: number[][], D: number[][], initial: number[], inputs: StateInputConfig[], duration: number, steps = 520): StateSample[] {
  const dt = duration / steps;
  let state = [...initial];
  const samples: StateSample[] = [];
  const derivative = (values: number[], time: number) => addVectors(multiplyMatrixVector(A, values), multiplyMatrixVector(B, inputVectorAtTime(inputs, time)));
  for (let index = 0; index <= steps; index += 1) {
    const time = index * dt;
    const currentInput = inputVectorAtTime(inputs, time);
    const output = addVectors(multiplyMatrixVector(C, state), multiplyMatrixVector(D, currentInput));
    samples.push({ t: time, state: [...state], input: currentInput, output });
    const k1 = derivative(state, time);
    const k2 = derivative(addScaled(state, k1, dt / 2), time + dt / 2);
    const k3 = derivative(addScaled(state, k2, dt / 2), time + dt / 2);
    const k4 = derivative(addScaled(state, k3, dt), time + dt);
    state = state.map((value, stateIndex) => value + (dt / 6) * (k1[stateIndex] + 2 * k2[stateIndex] + 2 * k3[stateIndex] + k4[stateIndex]));
    if (state.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e9)) break;
  }
  return samples;
}

function characteristicPolynomial(A: number[][]) {
  const order = A.length;
  const coefficients = [1];
  let previous = identity(order);
  for (let index = 1; index <= order; index += 1) {
    const product = multiplyMatrices(A, previous);
    const coefficient = -trace(product) / index;
    coefficients.push(Math.abs(coefficient) < 1e-12 ? 0 : coefficient);
    previous = product.map((row, rowIndex) => row.map((value, columnIndex) => value + (rowIndex === columnIndex ? coefficient : 0)));
  }
  return coefficients;
}

function complexMatrixRank(matrix: Complex[][], tolerance = 1e-7) {
  const work = matrix.map((row) => row.map((value) => ({ ...value })));
  let rank = 0;
  for (let column = 0; column < work[0].length && rank < work.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < work.length; row += 1) if (complexAbs(work[row][column]) > complexAbs(work[pivot][column])) pivot = row;
    if (complexAbs(work[pivot][column]) <= tolerance) continue;
    [work[rank], work[pivot]] = [work[pivot], work[rank]];
    const divisor = work[rank][column];
    for (let col = column; col < work[0].length; col += 1) work[rank][col] = complexDiv(work[rank][col], divisor);
    for (let row = 0; row < work.length; row += 1) {
      if (row === rank) continue;
      const factor = work[row][column];
      for (let col = column; col < work[0].length; col += 1) work[row][col] = complexSub(work[row][col], complexMul(factor, work[rank][col]));
    }
    rank += 1;
  }
  return rank;
}

function shiftComplexMatrix(A: number[][], eigenvalue: Complex) { return A.map((row, rowIndex) => row.map((value, columnIndex) => ({ re: value - (rowIndex === columnIndex ? eigenvalue.re : 0), im: rowIndex === columnIndex ? -eigenvalue.im : 0 }))); }
function complexAbs(value: Complex) { return Math.hypot(value.re, value.im); }
function complexMul(a: Complex, b: Complex): Complex { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function complexSub(a: Complex, b: Complex): Complex { return { re: a.re - b.re, im: a.im - b.im }; }
function complexDiv(a: Complex, b: Complex): Complex { const denominator = b.re ** 2 + b.im ** 2 || 1e-12; return { re: (a.re * b.re + a.im * b.im) / denominator, im: (a.im * b.re - a.re * b.im) / denominator }; }
function zeroMatrix(rows: number, columns: number) { return Array.from({ length: rows }, () => Array(columns).fill(0)); }
function resizeMatrix(matrix: number[][], rows: number, columns: number) { return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => matrix[row]?.[column] ?? 0)); }
function resizeVector(vector: number[], length: number) { return Array.from({ length }, (_, index) => vector[index] ?? 0); }
function identity(order: number) { return Array.from({ length: order }, (_, row) => Array.from({ length: order }, (_, column) => row === column ? 1 : 0)); }
function trace(matrix: number[][]) { return matrix.reduce((sum, row, index) => sum + row[index], 0); }
function multiplyMatrixVector(matrix: number[][], vector: number[]) { return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0)); }
function multiplyMatrices(left: number[][], right: number[][]) { const columns = right[0]?.length ?? 0; return left.map((row) => Array.from({ length: columns }, (_, column) => row.reduce((sum, value, index) => sum + value * (right[index]?.[column] ?? 0), 0))); }
function addVectors(left: number[], right: number[]) { return left.map((value, index) => value + (right[index] ?? 0)); }
function addScaled(state: number[], derivative: number[], scale: number) { return state.map((value, index) => value + derivative[index] * scale); }
