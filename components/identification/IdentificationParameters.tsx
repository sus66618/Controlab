import type { IdentificationConfig } from "@/lib/identification/types";

type NumericKey = "na" | "nb" | "nk" | "nc" | "nf" | "lambda" | "maxIterations" | "tolerance" | "trainRatio";

export function IdentificationParameters({ config, onChange }: { config: IdentificationConfig; onChange: (next: IdentificationConfig) => void }) {
  const set = (key: NumericKey, value: number) => onChange({ ...config, [key]: value });
  const fields: { key: NumericKey; label: string; note: string; min: number; max: number; step: number }[] = [];
  if (!["fir", "oe"].includes(config.method)) fields.push({ key: "na", label: "na", note: "输出记忆", min: 1, max: 10, step: 1 });
  fields.push({ key: "nb", label: "nb", note: config.method === "fir" ? "脉冲响应长度" : "输入记忆", min: 1, max: 10, step: 1 });
  fields.push({ key: "nk", label: "nk", note: "纯延迟", min: 0, max: 10, step: 1 });
  if (config.method === "armax") fields.push({ key: "nc", label: "nc", note: "噪声记忆", min: 1, max: 10, step: 1 });
  if (config.method === "oe") fields.unshift({ key: "nf", label: "nf", note: "分母阶次", min: 1, max: 10, step: 1 });
  if (config.method === "ridge-arx") fields.push({ key: "lambda", label: "λ / lambda", note: "正则强度", min: 0, max: 100, step: 0.01 });
  if (["armax", "oe"].includes(config.method)) {
    fields.push({ key: "maxIterations", label: "迭代", note: "最大次数", min: 1, max: 100, step: 1 });
    fields.push({ key: "tolerance", label: "精度", note: "停止阈值", min: 1e-9, max: 0.1, step: 1e-5 });
  }
  return <>
    <div className="identification-parameter-grid">{fields.map(({ key, ...field }) => <NumberField key={key} {...field} value={config[key]} onChange={(value) => set(key, value)} />)}</div>
    <details className="identification-validation-settings"><summary>验证与预处理</summary><div>
      <label><span>训练比例</span><select value={config.trainRatio} onChange={(event) => set("trainRatio", Number(event.target.value))}><option value={0.6}>60%</option><option value={0.7}>70%</option><option value={0.8}>80%</option><option value={0.9}>90%</option></select></label>
      <label><span>预处理</span><select value={config.preprocess} onChange={(event) => onChange({ ...config, preprocess: event.target.value as IdentificationConfig["preprocess"] })}><option value="none">不处理</option><option value="demean">去均值</option><option value="detrend">去线性趋势</option></select></label>
      <label className="identification-check"><input type="checkbox" checked={config.includeBias} onChange={(event) => onChange({ ...config, includeBias: event.target.checked })} /><span>估计常值偏置</span></label>
    </div></details>
  </>;
}

function NumberField({ label, note, value, min, max, step, onChange }: { label: string; note: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="identification-number"><span><b>{label}</b><small>{note}</small></span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
