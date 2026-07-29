export type ModernControlSample = {
  t: number;
  state: number[];
  estimate: number[];
  error: number[];
  errorNorm: number;
  control: number[];
  output: number[];
};

export type OutputFeedbackConfig = {
  A: number[][];
  B: number[][];
  C: number[][];
  initial: number[];
  estimatedInitial: number[];
  K: number[][];
  L?: number[][];
  duration: number;
  dt?: number;
  externalInput?: (time: number) => number[];
  measurementNoise?: number;
};

export function placeSisoPoles(A: number[][], B: number[][], poles: number[]) {
  const order = A.length;
  if (B[0]?.length !== 1 || poles.length !== order) throw new Error("极点配置要求单输入且极点数量等于状态维数");
  const controllability = controllabilityMatrix(A, B);
  const inverse = invert(controllability);
  const coefficients = polynomialFromRoots(poles);
  let phi = matrixPower(A, order);
  for (let index = 1; index <= order; index += 1) phi = add(phi, scale(matrixPower(A, order - index), coefficients[index]));
  const selector = [Array(order).fill(0)];
  selector[0][order - 1] = 1;
  return multiply(multiply(selector, inverse), phi).map((row) => row.map(clean));
}

export function placeObserverPoles(A: number[][], C: number[][], poles: number[]) {
  if (C.length !== 1) throw new Error("观测器极点配置要求单输出系统");
  return transpose(placeSisoPoles(transpose(A), transpose(C), poles)).map((row) => row.map(clean));
}

export function designDiscreteLqr(A: number[][], B: number[][], q: number[], r: number[], dt = 0.02) {
  const order = A.length;
  const inputs = B[0]?.length ?? 0;
  if (q.length !== order || r.length !== inputs) throw new Error("LQR 权重维度与系统不一致");
  const Ad = add(identity(order), scale(A, dt));
  const Bd = scale(B, dt);
  const Q = diagonal(q.map((value) => Math.max(1e-8, value) * dt));
  const R = diagonal(r.map((value) => Math.max(1e-8, value) * dt));
  let P = Q.map((row) => [...row]);
  for (let iteration = 0; iteration < 5000; iteration += 1) {
    const BtP = multiply(transpose(Bd), P);
    const denominator = add(R, multiply(BtP, Bd));
    const correction = multiply(multiply(multiply(multiply(transpose(Ad), P), Bd), invert(denominator)), multiply(BtP, Ad));
    const next = add(subtract(multiply(multiply(transpose(Ad), P), Ad), correction), Q);
    const change = maximumDifference(P, next);
    P = next;
    if (change < 1e-10) break;
  }
  return multiply(invert(add(R, multiply(multiply(transpose(Bd), P), Bd))), multiply(multiply(transpose(Bd), P), Ad)).map((row) => row.map(clean));
}

export function designKalmanGain(A: number[][], C: number[][], processNoise: number[], measurementNoise: number[], dt = 0.02) {
  return transpose(designDiscreteLqr(transpose(A), transpose(C), processNoise, measurementNoise, dt));
}

export function simulateOutputFeedback(config: OutputFeedbackConfig) {
  const dt = config.dt ?? 0.02;
  const steps = Math.max(1, Math.ceil(config.duration / dt));
  const inputCount = config.B[0]?.length ?? 0;
  let state = [...config.initial];
  let estimate = [...config.estimatedInitial];
  const samples: ModernControlSample[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const time = index * dt;
    const noise = Array.from({ length: config.C.length }, (_, output) => (config.measurementNoise ?? 0) * Math.sin(31.7 * time + output * 1.91));
    const output = addVectors(matrixVector(config.C, state), noise);
    const external = config.externalInput?.(time) ?? Array(inputCount).fill(0);
    const control = subtractVectors(external, matrixVector(config.K, estimate));
    const error = subtractVectors(state, estimate);
    samples.push({ t: time, state: [...state], estimate: [...estimate], error, errorNorm: Math.hypot(...error), control, output });
    if (index === steps) break;
    const stateDerivative = addVectors(matrixVector(config.A, state), matrixVector(config.B, control));
    const innovation = subtractVectors(output, matrixVector(config.C, estimate));
    const estimateDerivative = addVectors(addVectors(matrixVector(config.A, estimate), matrixVector(config.B, control)), config.L ? matrixVector(config.L, innovation) : matrixVector(config.A, error));
    state = addScaled(state, stateDerivative, dt);
    estimate = config.L ? addScaled(estimate, estimateDerivative, dt) : [...state];
  }
  return { samples };
}

export function closedLoopMatrix(A: number[][], B: number[][], K: number[][]) { return subtract(A, multiply(B, K)); }
export function observerErrorMatrix(A: number[][], L: number[][], C: number[][]) { return subtract(A, multiply(L, C)); }

function controllabilityMatrix(A: number[][], B: number[][]) {
  const blocks: number[][][] = [];
  let block = B.map((row) => [...row]);
  for (let index = 0; index < A.length; index += 1) { blocks.push(block); block = multiply(A, block); }
  return A.map((_, row) => blocks.flatMap((matrix) => matrix[row]));
}

function polynomialFromRoots(roots: number[]) {
  let coefficients = [1];
  roots.forEach((root) => {
    const next = Array(coefficients.length + 1).fill(0);
    coefficients.forEach((value, index) => { next[index] += value; next[index + 1] -= value * root; });
    coefficients = next;
  });
  return coefficients;
}

function matrixPower(matrix: number[][], exponent: number) {
  let result = identity(matrix.length);
  for (let index = 0; index < exponent; index += 1) result = multiply(result, matrix);
  return result;
}

function invert(source: number[][]) {
  if (!source.length || source.length !== source[0].length) throw new Error("矩阵必须为方阵");
  const size = source.length;
  const work = source.map((row, index) => [...row, ...identity(size)[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    if (Math.abs(work[pivot][column]) < 1e-10) throw new Error("矩阵奇异，无法完成设计");
    [work[column], work[pivot]] = [work[pivot], work[column]];
    const divisor = work[column][column];
    work[column] = work[column].map((value) => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = work[row][column];
      work[row] = work[row].map((value, index) => value - factor * work[column][index]);
    }
  }
  return work.map((row) => row.slice(size));
}

function identity(size: number) { return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? 1 : 0)); }
function diagonal(values: number[]) { return values.map((value, row) => values.map((_, column) => row === column ? value : 0)); }
function transpose(matrix: number[][]) { return matrix[0].map((_, column) => matrix.map((row) => row[column])); }
function multiply(left: number[][], right: number[][]) { return left.map((row) => right[0].map((_, column) => row.reduce((sum, value, index) => sum + value * right[index][column], 0))); }
function matrixVector(matrix: number[][], vector: number[]) { return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0)); }
function add(left: number[][], right: number[][]) { return left.map((row, i) => row.map((value, j) => value + right[i][j])); }
function subtract(left: number[][], right: number[][]) { return left.map((row, i) => row.map((value, j) => value - right[i][j])); }
function scale(matrix: number[][], value: number) { return matrix.map((row) => row.map((item) => item * value)); }
function addVectors(left: number[], right: number[]) { return left.map((value, index) => value + (right[index] ?? 0)); }
function subtractVectors(left: number[], right: number[]) { return left.map((value, index) => value - (right[index] ?? 0)); }
function addScaled(vector: number[], derivative: number[], value: number) { return vector.map((item, index) => item + derivative[index] * value); }
function maximumDifference(left: number[][], right: number[][]) { return Math.max(...left.flatMap((row, i) => row.map((value, j) => Math.abs(value - right[i][j])))); }
function clean(value: number) { return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(8)); }
