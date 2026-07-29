import { polynomialRoots } from "../../control/math.ts";
import type { PlantModelSummary, PlantOutputChannel } from "../core/types.ts";

export type DcMotorParams = {
  R: number;
  L: number;
  ke: number;
  kt: number;
  J: number;
  b: number;
  initialCurrent: number;
  initialSpeed: number;
  initialAngle: number;
};

export const DEFAULT_DC_MOTOR_PARAMS: DcMotorParams = {
  R: 2,
  L: 0.5,
  ke: 0.12,
  kt: 0.12,
  J: 0.02,
  b: 0.015,
  initialCurrent: 0,
  initialSpeed: 0,
  initialAngle: 0,
};

export function validateDcMotorParams(params: DcMotorParams) {
  if (!(params.R > 0)) throw new Error("电枢电阻必须为正数");
  if (!(params.L > 0)) throw new Error("电枢电感必须为正数");
  if (!(params.ke > 0) || !(params.kt > 0)) throw new Error("电机常数必须为正数");
  if (!(params.J > 0)) throw new Error("转动惯量必须为正数");
  if (!(params.b >= 0)) throw new Error("黏性摩擦不能为负数");
  if (Object.values(params).some((value) => !Number.isFinite(value))) throw new Error("电机参数必须是有限数值");
}

export function dcMotorDerivative(params: DcMotorParams, _time: number, state: number[], voltage: number, loadTorque: number) {
  validateDcMotorParams(params);
  if (state.length !== 3) throw new Error("直流电机状态必须包含电流、转速和角度");
  const [current, speed] = state;
  return [
    (voltage - params.R * current - params.ke * speed) / params.L,
    (params.kt * current - params.b * speed - loadTorque) / params.J,
    speed,
  ];
}

export function dcMotorSteadyState(params: DcMotorParams, voltage: number, loadTorque: number) {
  validateDcMotorParams(params);
  const denominator = params.R * params.b + params.ke * params.kt;
  if (!(denominator > 0)) throw new Error("当前参数无法形成有限稳态");
  const speed = (params.kt * voltage - params.R * loadTorque) / denominator;
  const current = (params.b * speed + loadTorque) / params.kt;
  return { current, speed, torque: params.kt * current };
}

export function initialDcMotorState(params: DcMotorParams) {
  validateDcMotorParams(params);
  return [params.initialCurrent, params.initialSpeed, params.initialAngle];
}

export function dcMotorOutputs(params: DcMotorParams): PlantOutputChannel[] {
  return [
    { id: "current", label: "电枢电流", unit: "A", read: (state) => state[0] },
    { id: "speed", label: "角速度", unit: "rad/s", read: (state) => state[1] },
    { id: "angle", label: "转角", unit: "rad", read: (state) => state[2] },
    { id: "torque", label: "电磁转矩", unit: "N·m", read: (state) => params.kt * state[0] },
    { id: "power", label: "机械功率", unit: "W", read: (state) => params.kt * state[0] * state[1] },
  ];
}

export function dcMotorSummary(params: DcMotorParams): PlantModelSummary {
  validateDcMotorParams(params);
  const denominator = [params.L * params.J, params.L * params.b + params.R * params.J, params.R * params.b + params.ke * params.kt];
  const poles = polynomialRoots(denominator).map((pole) => pole.im === 0 ? pole.re.toFixed(3) : `${pole.re.toFixed(3)}${pole.im >= 0 ? "+" : ""}${pole.im.toFixed(3)}j`).join(" · ");
  return {
    equations: ["L\\dot{i}+Ri+K_e\\omega=u", "J\\dot{\\omega}+b\\omega=K_ti-T_L"],
    metrics: [
      { label: "电气时间常数", value: `${(params.L / params.R).toFixed(3)} s` },
      { label: "机械时间常数", value: params.b > 0 ? `${(params.J / params.b).toFixed(3)} s` : "∞" },
      { label: "速度模型极点", value: poles },
    ],
  };
}
