export type IdentificationSample = { t: number; u: number; y: number };
export type ArxOrders = { na: number; nb: number; nk: number };
export type ArxModel = ArxOrders & { a: number[]; b: number[] };
export type ArxResult = ArxModel & { estimated: number[]; residuals: number[]; rmse: number; fitPercent: number };
export type IdentificationExample = { id: string; name: string; description: string; samples: IdentificationSample[]; suggested: ArxOrders };

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
  const columns = rows[0].length;
  const normal = Array.from({ length: columns }, (_, row) => Array.from({ length: columns }, (_, column) => rows.reduce((sum, values) => sum + values[row] * values[column], 0)));
  const rhs = Array.from({ length: columns }, (_, column) => rows.reduce((sum, values, row) => sum + values[column] * target[row], 0));
  for (let index = 0; index < columns; index += 1) normal[index][index] += 1e-9;
  return solve(normal, rhs);
}

function solve(matrix: number[][], vector: number[]) {
  const work = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < matrix.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < matrix.length; row += 1) if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    if (Math.abs(work[pivot][column]) < 1e-12) throw new Error("数据激励不足，无法唯一辨识参数");
    [work[column], work[pivot]] = [work[pivot], work[column]];
    const divisor = work[column][column];
    for (let index = column; index <= matrix.length; index += 1) work[column][index] /= divisor;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === column) continue;
      const factor = work[row][column];
      for (let index = column; index <= matrix.length; index += 1) work[row][index] -= factor * work[column][index];
    }
  }
  return work.map((row) => row.at(-1)!);
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
