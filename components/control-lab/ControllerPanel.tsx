"use client";

import type { ControllerConfig, ControllerKind } from "@/lib/control";

const CONTROLLERS: Array<{ key: ControllerKind; label: string }> = [
  { key: "p", label: "P" },
  { key: "pi", label: "PI" },
  { key: "pd", label: "PD" },
  { key: "pid", label: "PID" },
  { key: "lead", label: "超前" },
  { key: "lag", label: "滞后" },
];

export function ControllerPanel({ config, onChange }: {
  config: ControllerConfig;
  onChange: (next: ControllerConfig) => void;
}) {
  const setNumber = (field: keyof ControllerConfig, value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onChange({ ...config, [field]: parsed });
  };
  const isPidFamily = ["p", "pi", "pd", "pid"].includes(config.kind);

  return <section className="controller-panel" aria-label="控制器设置">
    <div className="controller-title">
      <div><span className="section-label">CONTROLLER</span><strong>C(s) 控制器</strong></div>
      <small>{isPidFamily ? "带一阶微分滤波" : "频域校正网络"}</small>
    </div>
    <div className="controller-kinds">
      {CONTROLLERS.map((item) => <button key={item.key} className={config.kind === item.key ? "active" : ""} onClick={() => onChange({ ...config, kind: item.key })}>{item.label}</button>)}
    </div>
    <div className="controller-fields">
      {isPidFamily ? <>
        <ControllerField label="Kp" value={config.kp} disabled={false} onChange={(value) => setNumber("kp", value)} />
        <ControllerField label="Ki" value={config.ki} disabled={!(["pi", "pid"].includes(config.kind))} onChange={(value) => setNumber("ki", value)} />
        <ControllerField label="Kd" value={config.kd} disabled={!(["pd", "pid"].includes(config.kind))} onChange={(value) => setNumber("kd", value)} />
      </> : <>
        <ControllerField label="K" value={config.gain} disabled={false} onChange={(value) => setNumber("gain", value)} />
        <ControllerField label="τ" value={config.tau} disabled={false} onChange={(value) => setNumber("tau", value)} />
        <ControllerField label={config.kind === "lead" ? "α" : "β"} value={config.ratio} disabled={false} onChange={(value) => setNumber("ratio", value)} />
      </>}
    </div>
    <div className="controller-note">自定义控制律将在仿真接口稳定后开放；当前先保证每个结果都可验证。</div>
  </section>;
}

function ControllerField({ label, value, disabled, onChange }: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return <label><span>{label}</span><input aria-label={label} type="number" step="0.05" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}
