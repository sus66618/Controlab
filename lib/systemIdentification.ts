import type { IdentificationDataset } from "./identificationData.ts";

export type IdentificationSample = { t: number; u: number; y: number };
export type ArxOrders = { na: number; nb: number; nk: number };
export type ArxModel = ArxOrders & { a: number[]; b: number[] };
export type ArxResult = ArxModel & { estimated: number[]; residuals: number[]; rmse: number; fitPercent: number };
export type IdentificationExample = { id: string; name: string; description: string; samples: IdentificationSample[]; suggested: ArxOrders };
export type VarxModel = ArxOrders & { inputNames: string[]; outputNames: string[]; a: number[][][]; b: number[][][] };
export type VarxChannelResult = { name: string; rmse: number; fitPercent: number };
export type VarxResult = VarxModel & { estimated: number[][]; residuals: number[][]; channels: VarxChannelResult[] };

export function parseIdentificationCsv(text: string) {
  const samples = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[,;\t，]+/).map((item) => Number(item.trim()))).filter((row) => row.length >= 3 && row.slice(0, 3).every(Number.isFinite)).map(([t, u, y]) => ({ t, u, y }));
  if (samples.length < 3) throw new Error("至少需要 3 行有效的 t,u,y 数据");
  return samples;
}

export function fitArx(samples: IdentificationSample[], orders: ArxOrders): ArxResult {
  const { na, nb, nk } = orders;
  if (na < 1 || nb < 1 || nk < 0) throw new Error("ARX 阶次无效");
  const start = Math.max(na, nk + nb - 1);
  if (samples.length - start < na + nb + 1) throw new Error("样本数量不足以辨识当前阶次");
  const rows: number[][] = [];
  const target: number[] = [];
  for (let index = start; index < samples.length; index += 1) {
    rows.push([
      ...Array.from({ length: na }, (_, lag) => -samples[index - lag - 1].y),
      ...Array.from({ length: nb }, (_, lag) => samples[index - nk - lag].u),
    ]);
    target.push(samples[index].y);
  }
  const theta = leastSquares(rows, target);
  const model: ArxModel = { ...orders, a: theta.slice(0, na), b: theta.slice(na) };
  const estimated = simulateArx(samples, model);
  const metrics = identificationMetrics(samples.map((sample) => sample.y).slice(start), estimated.slice(start));
  return { ...model, estimated, residuals: samples.map((sample, index) => sample.y - estimated[index]), ...metrics };
}

export function simulateArx(samples: IdentificationSample[], model: ArxModel) {
  const start = Math.max(model.na, model.nk + model.nb - 1);
  const output = samples.map((sample) => sample.y);
  for (let index = start; index < samples.length; index += 1) {
    const autoregressive = model.a.reduce((sum, value, lag) => sum - value * output[index - lag - 1], 0);
    const input = model.b.reduce((sum, value, lag) => sum + value * samples[index - model.nk - lag].u, 0);
    output[index] = autoregressive + input;
  }
  return output;
}

export function fitVarx(dataset: IdentificationDataset, orders: ArxOrders): VarxResult {
  const { na, nb, nk } = orders;
  if (![na, nb, nk].every(Number.isInteger)) throw new Error("ARX 阶次必须是整数");
  if (na < 1 || nb < 1 || nk < 0) throw new Error("ARX 阶次无效");
  const inputCount = dataset.inputNames.length;
  const outputCount = dataset.outputNames.length;
  if (!inputCount || !outputCount) throw new Error("至少需要一个输入和一个输出通道");
  validateDataset(dataset, inputCount, outputCount);
  const start = Math.max(na, nk + nb - 1);
  const parameterCount = na * outputCount + nb * inputCount;
  if (parameterCount > 160) throw new Error("当前维度与阶次产生了超过 160 个参数，请降低阶次或通道数");
  if (dataset.time.length - start < parameterCount + 1) throw new Error(`样本不足：当前 ${inputCount}×${outputCount} 模型至少需要 ${start + parameterCount + 1} 个采样点`);

  const rows = Array.from({ length: dataset.time.length - start }, (_, rowIndex) => {
    const index = rowIndex + start;
    return [
      ...Array.from({ length: na }, (_, lag) => dataset.outputs[index - lag - 1].map((value) => -value)).flat(),
      ...Array.from({ length: nb }, (_, lag) => dataset.inputs[index - nk - lag]).flat(),
    ];
  });

  const a: number[][][] = [];
  const b: number[][][] = [];
  const decomposition = qrDecompose(rows);
  for (let output = 0; output < outputCount; output += 1) {
    const target = dataset.outputs.slice(start).map((values) => values[output]);
    const theta = qrSolve(decomposition, target);
    a.push(Array.from({ length: na }, (_, lag) => theta.slice(lag * outputCount, (lag + 1) * outputCount)));
    const offset = na * outputCount;
    b.push(Array.from({ length: nb }, (_, lag) => theta.slice(offset + lag * inputCount, offset + (lag + 1) * inputCount)));
  }

  const model: VarxModel = { ...orders, inputNames: [...dataset.inputNames], outputNames: [...dataset.outputNames], a, b };
  const estimated = simulateVarx(dataset, model);
  const residuals = dataset.outputs.map((values, index) => values.map((value, output) => value - estimated[index][output]));
  const channels = dataset.outputNames.map((name, output) => ({ name, ...identificationMetrics(dataset.outputs.slice(start).map((values) => values[output]), estimated.slice(start).map((values) => values[output])) }));
  return { ...model, estimated, residuals, channels };
}

function validateDataset(dataset: IdentificationDataset, inputCount: number, outputCount: number) {
  const count = dataset.time.length;
  if (dataset.inputs.length !== count || dataset.outputs.length !== count) throw new Error("时间、输入与输出的行数必须一致");
  if (count > 50_000) throw new Error("采样点不能超过 50000");
  for (let index = 0; index < count; index += 1) {
    if (dataset.inputs[index]?.length !== inputCount || dataset.outputs[index]?.length !== outputCount) throw new Error(`第 ${index + 1} 个采样点的通道维度不一致`);
    if (![dataset.time[index], ...dataset.inputs[index], ...dataset.outputs[index]].every(Number.isFinite)) throw new Error(`第 ${index + 1} 个采样点必须全部是有限数值`);
    if (index > 0 && dataset.time[index] <= dataset.time[index - 1]) throw new Error("时间必须严格递增");
  }
}

export function simulateVarx(dataset: IdentificationDataset, model: VarxModel) {
  const start = Math.max(model.na, model.nk + model.nb - 1);
  const estimated = dataset.outputs.map((values) => [...values]);
  for (let index = start; index < dataset.time.length; index += 1) {
    estimated[index] = model.outputNames.map((_, output) => {
      const outputMemory = model.a[output].reduce((sum, coefficients, lag) => sum - coefficients.reduce((part, value, source) => part + value * estimated[index - lag - 1][source], 0), 0);
      const inputMemory = model.b[output].reduce((sum, coefficients, lag) => sum + coefficients.reduce((part, value, input) => part + value * dataset.inputs[index - model.nk - lag][input], 0), 0);
      return outputMemory + inputMemory;
    });
  }
  return estimated;
}

export function identificationMetrics(measured: number[], estimated: number[]) {
  const count = Math.min(measured.length, estimated.length);
  if (!count) return { rmse: Number.NaN, fitPercent: Number.NaN };
  const mean = measured.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  const squaredError = measured.slice(0, count).reduce((sum, value, index) => sum + (value - estimated[index]) ** 2, 0);
  const spread = measured.slice(0, count).reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return { rmse: Math.sqrt(squaredError / count), fitPercent: spread < 1e-12 ? (squaredError < 1e-12 ? 100 : 0) : 100 * (1 - Math.sqrt(squaredError / spread)) };
}

export function samplesToCsv(samples: IdentificationSample[]) { return ["t,u,y", ...samples.map((sample) => `${sample.t.toFixed(3)},${sample.u.toFixed(5)},${sample.y.toFixed(5)}`)].join("\n"); }

export function arxPolynomialsLatex(model: ArxModel) {
  const a = polynomialLatex("A", [1, ...model.a]);
  const b = polynomialLatex("B", model.b);
  const delay = model.nk === 0 ? "" : `q^{-${model.nk}}`;
  return { a, b, model: `A(q^{-1})y(k)=${delay}B(q^{-1})u(k)+e(k)` };
}

function polynomialLatex(name: "A" | "B", coefficients: number[]) {
  const terms = coefficients.map((value, index) => {
    const magnitude = Number(Math.abs(value).toPrecision(6));
    const variable = index === 0 ? "" : `q^{-${index}}`;
    if (index === 0) return `${value < 0 ? "-" : ""}${magnitude}${variable}`;
    return `${value < 0 ? "-" : "+"}${magnitude}${variable}`;
  }).join("");
  return `${name}(q^{-1})=${terms}`;
}

function leastSquares(rows: number[][], target: number[]) {
  return qrSolve(qrDecompose(rows), target);
}

type QrDecomposition = { q: number[][]; r: number[][] };

function qrDecompose(rows: number[][]): QrDecomposition {
  const columnCount = rows[0].length;
  const q: number[][] = [];
  const r = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));
  const originalScale = Math.max(1, ...Array.from({ length: columnCount }, (_, column) => Math.hypot(...rows.map((row) => row[column]))));
  for (let column = 0; column < columnCount; column += 1) {
    const vector = rows.map((row) => row[column]);
    for (let previous = 0; previous < column; previous += 1) {
      r[previous][column] = q[previous].reduce((sum, value, row) => sum + value * vector[row], 0);
      for (let row = 0; row < vector.length; row += 1) vector[row] -= r[previous][column] * q[previous][row];
    }
    const norm = Math.hypot(...vector);
    if (norm <= originalScale * 1e-10) throw new Error("数据激励不足或通道高度共线，无法唯一辨识参数");
    r[column][column] = norm;
    q.push(vector.map((value) => value / norm));
  }
  return { q, r };
}

function qrSolve({ q, r }: QrDecomposition, target: number[]) {
  const transformed = q.map((column) => column.reduce((sum, value, row) => sum + value * target[row], 0));
  const solution = Array(transformed.length).fill(0);
  for (let row = transformed.length - 1; row >= 0; row -= 1) {
    const known = r[row].reduce((sum, value, column) => column > row ? sum + value * solution[column] : sum, 0);
    solution[row] = (transformed[row] - known) / r[row][row];
  }
  return solution;
}

function createExample(id: string, name: string, description: string, coefficients: { a: number[]; b: number[] }, suggested: ArxOrders) {
  const samples: IdentificationSample[] = [];
  const output: number[] = [];
  const dt = 0.08;
  for (let index = 0; index < 260; index += 1) {
    const u = index < 8 ? 0 : (Math.floor(index / 32) % 3 === 0 ? 1 : Math.floor(index / 32) % 3 === 1 ? -0.35 : 0.65);
    const autoregressive = coefficients.a.reduce((sum, value, lag) => sum - value * (output[index - lag - 1] ?? 0), 0);
    const input = coefficients.b.reduce((sum, value, lag) => sum + value * (samples[index - suggested.nk - lag]?.u ?? 0), 0);
    const cleanOutput = autoregressive + input;
    output.push(cleanOutput);
    const noise = 0.012 * Math.sin(index * 1.73) + 0.006 * Math.sin(index * 0.37);
    samples.push({ t: index * dt, u, y: cleanOutput + noise });
  }
  return { id, name, description, samples, suggested };
}

export const IDENTIFICATION_EXAMPLES: IdentificationExample[] = [
  createExample("thermal", "热过程", "响应缓慢、近似一阶的带噪对象", { a: [-0.93], b: [0.07] }, { na: 1, nb: 1, nk: 1 }),
  createExample("servo", "欠阻尼伺服", "具有振荡与衰减的二阶对象", { a: [-1.72, 0.78], b: [0.055, 0.018] }, { na: 2, nb: 2, nk: 1 }),
  createExample("motor", "直流电机", "双时间尺度的电机速度数据", { a: [-1.45, 0.49], b: [0.04, 0.025] }, { na: 2, nb: 2, nk: 1 }),
];
