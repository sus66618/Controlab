export function assertFiniteState(state: number[]) {
  if (state.some((value) => !Number.isFinite(value))) throw new Error("仿真状态出现非有限数值");
  return state;
}

export function rk4Step(state: number[], time: number, dt: number, derivative: (time: number, state: number[]) => number[]) {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new Error("积分步长必须为正数");
  const k1 = checkedDerivative(derivative(time, state), state.length);
  const k2 = checkedDerivative(derivative(time + dt / 2, addScaled(state, k1, dt / 2)), state.length);
  const k3 = checkedDerivative(derivative(time + dt / 2, addScaled(state, k2, dt / 2)), state.length);
  const k4 = checkedDerivative(derivative(time + dt, addScaled(state, k3, dt)), state.length);
  return assertFiniteState(state.map((value, index) => value + dt * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]) / 6));
}

function checkedDerivative(derivative: number[], expectedLength: number) {
  if (derivative.length !== expectedLength) throw new Error("状态导数维度与状态不一致");
  return assertFiniteState(derivative);
}

function addScaled(state: number[], derivative: number[], scale: number) {
  return state.map((value, index) => value + derivative[index] * scale);
}
