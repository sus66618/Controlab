export type CartPoleState = {
  x: number;
  xVelocity: number;
  theta: number;
  thetaVelocity: number;
  time: number;
};

export type CartPoleParams = {
  cartMass: number;
  poleMass: number;
  poleLength: number;
  cartFriction: number;
  gravity: number;
};

export type PendulumController = "off" | "pid" | "lqr";
export type ExcitationType = "none" | "step" | "ramp" | "sine" | "pulse";
export type ExcitationTarget = "reference" | "disturbance";
export type PidStructure = "classic" | "composite";

export type ExcitationConfig = {
  target: ExcitationTarget;
  type: ExcitationType;
  amplitude: number;
  frequency: number;
  startTime: number;
  duration: number;
};

export type PidControllerConfig = {
  structure: PidStructure;
  kp: number;
  ki: number;
  kd: number;
  kx: number;
  kv: number;
  maxForce: number;
};

export type LqrControllerConfig = {
  gains: [number, number, number, number];
  q: [number, number, number, number];
  r: number;
  maxForce: number;
};

export type ControlOptions = {
  reference?: number;
  angleIntegral?: number;
  pid?: PidControllerConfig;
  lqr?: LqrControllerConfig;
};

export type LinearCartPoleModel = {
  A: number[][];
  B: number[];
  C: number[][];
  D: number[][];
  positionTransfer: { numerator: number[]; denominator: number[] };
  angleTransfer: { numerator: number[]; denominator: number[] };
  controllabilityRank: number;
};

export const DEFAULT_CART_POLE_PARAMS: CartPoleParams = {
  cartMass: 1,
  poleMass: 0.16,
  poleLength: 0.58,
  cartFriction: 0.08,
  gravity: 9.81,
};

export const DEFAULT_PID_CONFIG: PidControllerConfig = {
  structure: "composite",
  kp: 20,
  ki: 0,
  kd: 4,
  kx: 0.5,
  kv: 1,
  maxForce: 34,
};

export const DEFAULT_LQR_CONFIG: LqrControllerConfig = {
  gains: [2, 3, 30, 8],
  q: [2, 0.7, 75, 4],
  r: 0.35,
  maxForce: 34,
};

export const DEFAULT_EXCITATION: ExcitationConfig = {
  target: "reference",
  type: "none",
  amplitude: 0.45,
  frequency: 0.35,
  startTime: 0.5,
  duration: 0.35,
};

export function initialCartPoleState(angleDegrees = 7): CartPoleState {
  return { x: 0, xVelocity: 0, theta: (angleDegrees * Math.PI) / 180, thetaVelocity: 0, time: 0 };
}

export function excitationValue(config: ExcitationConfig, elapsed: number) {
  const time = elapsed - config.startTime;
  if (config.type === "none" || time < 0) return 0;
  if (config.type === "step") return config.amplitude;
  if (config.type === "ramp") return config.amplitude * time;
  if (config.type === "sine") return config.amplitude * Math.sin(2 * Math.PI * config.frequency * time);
  return time <= config.duration ? config.amplitude : 0;
}

export function pendulumControlForce(state: CartPoleState, mode: PendulumController, options: ControlOptions = {}) {
  if (mode === "off") return 0;
  const reference = options.reference ?? 0;
  if (mode === "pid") {
    const gains = options.pid ?? DEFAULT_PID_CONFIG;
    const angleForce = gains.kp * state.theta
      + gains.ki * (options.angleIntegral ?? 0)
      + gains.kd * state.thetaVelocity;
    const positionForce = gains.structure === "composite"
      ? gains.kx * (state.x - reference) + gains.kv * state.xVelocity
      : 0;
    const force = angleForce + positionForce;
    return clamp(force, -gains.maxForce, gains.maxForce);
  }
  const config = options.lqr ?? DEFAULT_LQR_CONFIG;
  const values = [state.x - reference, state.xVelocity, state.theta, state.thetaVelocity];
  const force = config.gains.reduce((sum, gain, index) => sum + gain * values[index], 0);
  return clamp(force, -config.maxForce, config.maxForce);
}

function derivative(state: CartPoleState, force: number, params: CartPoleParams) {
  const { cartMass, poleMass, poleLength, cartFriction, gravity } = params;
  const sine = Math.sin(state.theta);
  const cosine = Math.cos(state.theta);
  const totalMass = cartMass + poleMass;
  const effectiveForce = force - cartFriction * state.xVelocity;
  const temp = (effectiveForce + poleMass * poleLength * state.thetaVelocity ** 2 * sine) / totalMass;
  const thetaAcceleration = (gravity * sine - cosine * temp) / (poleLength * (4 / 3 - (poleMass * cosine ** 2) / totalMass));
  const xAcceleration = temp - (poleMass * poleLength * thetaAcceleration * cosine) / totalMass;
  return [state.xVelocity, xAcceleration, state.thetaVelocity, thetaAcceleration];
}

export function stepCartPole(state: CartPoleState, force: number, params: CartPoleParams, dt: number): CartPoleState {
  const k1 = derivative(state, force, params);
  const k2 = derivative(addDerivative(state, k1, dt / 2), force, params);
  const k3 = derivative(addDerivative(state, k2, dt / 2), force, params);
  const k4 = derivative(addDerivative(state, k3, dt), force, params);
  const next = {
    x: state.x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    xVelocity: state.xVelocity + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    theta: state.theta + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    thetaVelocity: state.thetaVelocity + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    time: state.time + dt,
  };
  next.theta = Math.atan2(Math.sin(next.theta), Math.cos(next.theta));
  return next;
}

export function linearizeCartPole(params: CartPoleParams): LinearCartPoleModel {
  const equilibrium = initialCartPoleState(0);
  const epsilon = 1e-5;
  const A = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let column = 0; column < 4; column += 1) {
    const plus = stateWithOffset(equilibrium, column, epsilon);
    const minus = stateWithOffset(equilibrium, column, -epsilon);
    const positive = derivative(plus, 0, params);
    const negative = derivative(minus, 0, params);
    for (let row = 0; row < 4; row += 1) A[row][column] = clean((positive[row] - negative[row]) / (2 * epsilon));
  }
  const positiveForce = derivative(equilibrium, epsilon, params);
  const negativeForce = derivative(equilibrium, -epsilon, params);
  const B = positiveForce.map((value, row) => clean((value - negativeForce[row]) / (2 * epsilon)));
  const denominator = characteristicPolynomial(A);
  const positionTransfer = { numerator: transferNumerator(A, B, 0, denominator), denominator };
  const angleTransfer = { numerator: transferNumerator(A, B, 2, denominator), denominator };
  return {
    A,
    B,
    C: [[1, 0, 0, 0], [0, 0, 1, 0]],
    D: [[0], [0]],
    positionTransfer,
    angleTransfer,
    controllabilityRank: matrixRank(controllabilityMatrix(A, B)),
  };
}

export function designLqrGains(params: CartPoleParams, q: [number, number, number, number], r: number): [number, number, number, number] {
  const { A, B } = linearizeCartPole(params);
  const dt = 0.01;
  const Ad = matrixAdd(identity(4), matrixScale(A, dt));
  const Bd = B.map((value) => value * dt);
  const Q = diagonal(q.map((value) => Math.max(1e-5, value) * dt));
  const R = Math.max(1e-5, r) * dt;
  let P = Q.map((row) => [...row]);
  for (let iteration = 0; iteration < 2400; iteration += 1) {
    const pB = matrixVector(P, Bd);
    const denominator = R + dot(Bd, pB);
    const pA = matrixMultiply(P, Ad);
    const bPAd = vectorMatrix(Bd, pA);
    const correction = outer(matrixVector(transpose(Ad), pB), bPAd).map((row) => row.map((value) => value / denominator));
    const next = matrixAdd(matrixSubtract(matrixMultiply(transpose(Ad), pA), correction), Q);
    const change = matrixMaximumDifference(P, next);
    P = next;
    if (change < 1e-10) break;
  }
  const pB = matrixVector(P, Bd);
  const gain = vectorMatrix(Bd, matrixMultiply(P, Ad)).map((value) => value / (R + dot(Bd, pB)));
  // 标准 LQR 为 u=-Kx；界面采用 u=kx 的展示约定，因此在此反号。
  return gain.map((value) => clean(-value, 6)) as [number, number, number, number];
}

function transferNumerator(A: number[][], B: number[], outputIndex: number, denominator: number[]) {
  const order = A.length;
  const markov: number[] = [];
  let vector = [...B];
  for (let index = 0; index < order; index += 1) {
    markov.push(vector[outputIndex]);
    vector = matrixVector(A, vector);
  }
  const numerator = markov.map((_, index) => {
    let value = markov[index];
    for (let offset = 1; offset <= index; offset += 1) value += denominator[offset] * markov[index - offset];
    return clean(value);
  });
  while (numerator.length > 1 && Math.abs(numerator[0]) < 1e-8) numerator.shift();
  return numerator;
}

function characteristicPolynomial(matrix: number[][]) {
  const size = matrix.length;
  let auxiliary = identity(size);
  const coefficients = [1];
  for (let order = 1; order <= size; order += 1) {
    const product = matrixMultiply(matrix, auxiliary);
    const coefficient = -trace(product) / order;
    coefficients.push(clean(coefficient));
    auxiliary = matrixAdd(product, matrixScale(identity(size), coefficient));
  }
  return coefficients;
}

function controllabilityMatrix(A: number[][], B: number[]) {
  const columns: number[][] = [];
  let column = [...B];
  for (let index = 0; index < A.length; index += 1) {
    columns.push(column);
    column = matrixVector(A, column);
  }
  return A.map((_, row) => columns.map((value) => value[row]));
}

function matrixRank(source: number[][]) {
  const matrix = source.map((row) => [...row]);
  let rank = 0;
  for (let column = 0; column < matrix[0].length && rank < matrix.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < matrix.length; row += 1) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-8) continue;
    [matrix[rank], matrix[pivot]] = [matrix[pivot], matrix[rank]];
    const divisor = matrix[rank][column];
    for (let index = column; index < matrix[rank].length; index += 1) matrix[rank][index] /= divisor;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === rank) continue;
      const factor = matrix[row][column];
      for (let index = column; index < matrix[row].length; index += 1) matrix[row][index] -= factor * matrix[rank][index];
    }
    rank += 1;
  }
  return rank;
}

function stateWithOffset(state: CartPoleState, index: number, offset: number) {
  const keys: Array<keyof CartPoleState> = ["x", "xVelocity", "theta", "thetaVelocity"];
  return { ...state, [keys[index]]: state[keys[index]] + offset };
}

function addDerivative(state: CartPoleState, value: number[], scale: number): CartPoleState {
  return {
    x: state.x + value[0] * scale,
    xVelocity: state.xVelocity + value[1] * scale,
    theta: state.theta + value[2] * scale,
    thetaVelocity: state.thetaVelocity + value[3] * scale,
    time: state.time + scale,
  };
}

function identity(size: number) { return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? 1 : 0)); }
function diagonal(values: number[]) { return values.map((value, row) => values.map((_, column) => row === column ? value : 0)); }
function transpose(matrix: number[][]) { return matrix[0].map((_, column) => matrix.map((row) => row[column])); }
function trace(matrix: number[][]) { return matrix.reduce((sum, row, index) => sum + row[index], 0); }
function dot(a: number[], b: number[]) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function matrixScale(matrix: number[][], scale: number) { return matrix.map((row) => row.map((value) => value * scale)); }
function matrixAdd(a: number[][], b: number[][]) { return a.map((row, i) => row.map((value, j) => value + b[i][j])); }
function matrixSubtract(a: number[][], b: number[][]) { return a.map((row, i) => row.map((value, j) => value - b[i][j])); }
function matrixMultiply(a: number[][], b: number[][]) { return a.map((row) => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0))); }
function matrixVector(matrix: number[][], vector: number[]) { return matrix.map((row) => dot(row, vector)); }
function vectorMatrix(vector: number[], matrix: number[][]) { return matrix[0].map((_, column) => vector.reduce((sum, value, row) => sum + value * matrix[row][column], 0)); }
function outer(a: number[], b: number[]) { return a.map((left) => b.map((right) => left * right)); }
function matrixMaximumDifference(a: number[][], b: number[][]) { return Math.max(...a.flatMap((row, i) => row.map((value, j) => Math.abs(value - b[i][j])))); }
function clean(value: number, digits = 10) { return Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(digits)); }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
