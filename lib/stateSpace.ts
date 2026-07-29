import { polynomialRoots } from "./control.ts";
import type { Complex } from "./control.ts";

export type StateSpacePreset = {
  id: string;
  name: string;
  description: string;
  stateLabels: string[];
  stateUnits: string[];
  A: number[][];
  B: number[];
  initial: number[];
  input: number;
  sensors: number[];
  plotAxes: [number, number];
  duration: number;
};

export type StateSample = { t: number; state: number[] };

export const STATE_SPACE_PRESETS: StateSpacePreset[] = [
  {
    id: "mass-spring",
    name: "质量–弹簧–阻尼",
    description: "用位置与速度两个状态，看懂二阶系统如何在状态平面中衰减。",
    stateLabels: ["x", "ẋ"],
    stateUnits: ["m", "m/s"],
    A: [[0, 1], [-4, -0.8]],
    B: [0, 1],
    initial: [1, 0],
    input: 0,
    sensors: [0],
    plotAxes: [0, 1],
    duration: 12,
  },
  {
    id: "dc-motor",
    name: "直流电机",
    description: "电流产生转矩、转速产生反电动势，两个状态彼此耦合。",
    stateLabels: ["ω", "i"],
    stateUnits: ["rad/s", "A"],
    A: [[-2, 1], [-0.5, -4]],
    B: [0, 2],
    initial: [0, 0],
    input: 1,
    sensors: [0],
    plotAxes: [0, 1],
    duration: 6,
  },
  {
    id: "sensor-demo",
    name: "双模态传感器实验",
    description: "两个互不耦合的模态最适合观察：少装一个传感器，就会藏住一个状态。",
    stateLabels: ["x₁", "x₂"],
    stateUnits: ["", ""],
    A: [[-1, 0], [0, -2]],
    B: [1, 1],
    initial: [1, -0.8],
    input: 0,
    sensors: [0],
    plotAxes: [0, 1],
    duration: 6,
  },
  {
    id: "cart-pole",
    name: "倒立摆线性模型",
    description: "把当前非线性实验在直立点附近线性化，直接连接后续 LQR 与观测器。",
    stateLabels: ["x", "ẋ", "θ", "θ̇"],
    stateUnits: ["m", "m/s", "rad", "rad/s"],
    A: [[0, 1, 0, 0], [0, -0.0769, -1.1319, 0], [0, 0, 0, 1], [0, 0.0995, 14.149, 0]],
    B: [0, 0.9615, 0, -1.2434],
    initial: [0, 0, 0.08, 0],
    input: 0,
    sensors: [0, 2],
    plotAxes: [0, 2],
    duration: 3.5,
  },
];

export function clonePreset(preset: StateSpacePreset): StateSpacePreset {
  return { ...preset, stateLabels: [...preset.stateLabels], stateUnits: [...preset.stateUnits], A: preset.A.map((row) => [...row]), B: [...preset.B], initial: [...preset.initial], sensors: [...preset.sensors], plotAxes: [...preset.plotAxes] as [number, number] };
}

export function sensorMatrix(order: number, sensors: number[]) {
  if (!sensors.length) return [Array(order).fill(0)];
  return sensors.map((sensor) => Array.from({ length: order }, (_, index) => index === sensor ? 1 : 0));
}

export function controllabilityMatrix(A: number[][], B: number[]) {
  const order = A.length;
  const columns: number[][] = [];
  let column = [...B];
  for (let index = 0; index < order; index += 1) {
    columns.push(column);
    column = multiplyMatrixVector(A, column);
  }
  return Array.from({ length: order }, (_, row) => columns.map((values) => values[row]));
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

export function singularValues(matrix: number[][]) {
  if (!matrix.length || !matrix[0]?.length) return [];
  const gram = multiplyMatrices(transpose(matrix), matrix);
  return symmetricEigenvalues(gram).map((value) => Math.sqrt(Math.max(0, value))).sort((a, b) => b - a);
}

export function stateEigenvalues(A: number[][]): Complex[] {
  return polynomialRoots(characteristicPolynomial(A)).sort((left, right) => left.re - right.re || left.im - right.im);
}

export function analyzeStateSpace(A: number[][], B: number[], C: number[][]) {
  const controllability = controllabilityMatrix(A, B);
  const observability = observabilityMatrix(A, C);
  return {
    controllability,
    observability,
    controllabilityRank: matrixRank(controllability),
    observabilityRank: matrixRank(observability),
    controllabilityStrength: singularValues(controllability),
    observabilityStrength: singularValues(observability),
    eigenvalues: stateEigenvalues(A),
  };
}

export function simulateStateSpace(A: number[][], B: number[], initial: number[], input: number, duration: number, steps = 480): StateSample[] {
  const dt = duration / steps;
  let state = [...initial];
  const samples: StateSample[] = [];
  const derivative = (values: number[]) => multiplyMatrixVector(A, values).map((value, index) => value + B[index] * input);
  for (let index = 0; index <= steps; index += 1) {
    samples.push({ t: index * dt, state: [...state] });
    const k1 = derivative(state);
    const k2 = derivative(addScaled(state, k1, dt / 2));
    const k3 = derivative(addScaled(state, k2, dt / 2));
    const k4 = derivative(addScaled(state, k3, dt));
    state = state.map((value, stateIndex) => value + (dt / 6) * (k1[stateIndex] + 2 * k2[stateIndex] + 2 * k3[stateIndex] + k4[stateIndex]));
    if (state.some((value) => !Number.isFinite(value))) break;
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

function symmetricEigenvalues(matrix: number[][]) {
  const work = matrix.map((row) => [...row]);
  const order = work.length;
  for (let iteration = 0; iteration < 80 * order * order; iteration += 1) {
    let p = 0; let q = 1; let largest = 0;
    for (let row = 0; row < order; row += 1) for (let column = row + 1; column < order; column += 1) {
      if (Math.abs(work[row][column]) > largest) { largest = Math.abs(work[row][column]); p = row; q = column; }
    }
    if (largest < 1e-11 || order < 2) break;
    const angle = 0.5 * Math.atan2(2 * work[p][q], work[q][q] - work[p][p]);
    const cosine = Math.cos(angle); const sine = Math.sin(angle);
    for (let index = 0; index < order; index += 1) {
      const left = work[index][p]; const right = work[index][q];
      work[index][p] = cosine * left - sine * right;
      work[index][q] = sine * left + cosine * right;
    }
    for (let index = 0; index < order; index += 1) {
      const top = work[p][index]; const bottom = work[q][index];
      work[p][index] = cosine * top - sine * bottom;
      work[q][index] = sine * top + cosine * bottom;
    }
  }
  return work.map((row, index) => row[index]);
}

function identity(order: number) { return Array.from({ length: order }, (_, row) => Array.from({ length: order }, (_, column) => row === column ? 1 : 0)); }
function transpose(matrix: number[][]) { return matrix[0].map((_, column) => matrix.map((row) => row[column])); }
function trace(matrix: number[][]) { return matrix.reduce((sum, row, index) => sum + row[index], 0); }
function multiplyMatrixVector(matrix: number[][], vector: number[]) { return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0)); }
function multiplyMatrices(left: number[][], right: number[][]) { const transposed = transpose(right); return left.map((row) => transposed.map((column) => row.reduce((sum, value, index) => sum + value * column[index], 0))); }
function addScaled(state: number[], derivative: number[], scale: number) { return state.map((value, index) => value + derivative[index] * scale); }
