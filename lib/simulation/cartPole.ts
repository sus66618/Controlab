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

export const DEFAULT_CART_POLE_PARAMS: CartPoleParams = {
  cartMass: 1,
  poleMass: 0.16,
  poleLength: 0.58,
  cartFriction: 0.08,
  gravity: 9.81,
};

export function initialCartPoleState(angleDegrees = 7): CartPoleState {
  return { x: 0, xVelocity: 0, theta: (angleDegrees * Math.PI) / 180, thetaVelocity: 0, time: 0 };
}

export function pendulumControlForce(state: CartPoleState, mode: PendulumController, gains = { kp: 20, kd: 4 }) {
  if (mode === "off") return 0;
  if (mode === "pid") {
    return clamp(gains.kp * state.theta + gains.kd * state.thetaVelocity + 0.5 * state.x + state.xVelocity, -34, 34);
  }
  // 状态反馈同时约束摆角和小车位置，系数取自当前教学模型的稳定工作区。
  return clamp(30 * state.theta + 8 * state.thetaVelocity + 2 * state.x + 3 * state.xVelocity, -34, 34);
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
  return { x: state.xVelocity, xVelocity: xAcceleration, theta: state.thetaVelocity, thetaVelocity: thetaAcceleration };
}

export function stepCartPole(state: CartPoleState, force: number, params: CartPoleParams, dt: number): CartPoleState {
  const k1 = derivative(state, force, params);
  const k2State = addDerivative(state, k1, dt / 2);
  const k2 = derivative(k2State, force, params);
  const k3State = addDerivative(state, k2, dt / 2);
  const k3 = derivative(k3State, force, params);
  const k4State = addDerivative(state, k3, dt);
  const k4 = derivative(k4State, force, params);
  const next = {
    x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    xVelocity: state.xVelocity + (dt / 6) * (k1.xVelocity + 2 * k2.xVelocity + 2 * k3.xVelocity + k4.xVelocity),
    theta: state.theta + (dt / 6) * (k1.theta + 2 * k2.theta + 2 * k3.theta + k4.theta),
    thetaVelocity: state.thetaVelocity + (dt / 6) * (k1.thetaVelocity + 2 * k2.thetaVelocity + 2 * k3.thetaVelocity + k4.thetaVelocity),
    time: state.time + dt,
  };
  // 保持角度在 [-π, π]，避免长时间无控制时数值无限增长。
  next.theta = Math.atan2(Math.sin(next.theta), Math.cos(next.theta));
  return next;
}

function addDerivative(state: CartPoleState, value: ReturnType<typeof derivative>, scale: number): CartPoleState {
  return {
    x: state.x + value.x * scale,
    xVelocity: state.xVelocity + value.xVelocity * scale,
    theta: state.theta + value.theta * scale,
    thetaVelocity: state.thetaVelocity + value.thetaVelocity * scale,
    time: state.time + scale,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
