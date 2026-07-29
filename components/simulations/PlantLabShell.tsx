"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import type { ControlModuleId } from "@/lib/moduleCatalog";
import type { PlantHistoryPoint, PlantModelSummary, PlantOutputChannel, PlantSignal } from "@/lib/simulation/core/types";

export type PlantLabShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  inputLabel: string;
  inputUnit: string;
  inputRange: [number, number];
  running: boolean;
  error: string;
  time: number;
  signal: PlantSignal;
  manualInput: number;
  outputs: PlantOutputChannel[];
  selectedOutput: string;
  history: PlantHistoryPoint[];
  summary: PlantModelSummary;
  scene: ReactNode;
  parameters: ReactNode;
  extraInput?: ReactNode;
  onRunningChange: (running: boolean) => void;
  onSignalChange: (signal: PlantSignal) => void;
  onManualInputChange: (value: number) => void;
  onOutputChange: (id: string) => void;
  onReset: () => void;
  onBack: () => void;
  onNavigate: (module: ControlModuleId) => void;
};

export function PlantLabShell({ title, eyebrow, description, inputLabel, inputUnit, inputRange, running, error, time, signal, manualInput, outputs, selectedOutput, history, summary, scene, parameters, extraInput, onRunningChange, onSignalChange, onManualInputChange, onOutputChange, onReset, onBack, onNavigate }: PlantLabShellProps) {
  const output = outputs.find((item) => item.id === selectedOutput) ?? outputs[0];
  return <main className="controlab-app plant-lab-page">
    <AppHeader title={`动力学仿真 / ${title}`} onHome={onBack} trailing={<ModuleNav current="simulation" onNavigate={onNavigate} />} />
    <section className="plant-lab">
      <header className="plant-lab-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="plant-lab-status"><span>{time.toFixed(2)} s</span><button onClick={() => onRunningChange(!running)}>{running ? "暂停" : "运行"}</button><button onClick={onReset}>复位</button><button onClick={onBack}>实验大厅</button></div></header>
      <div className="plant-lab-grid">
        <section className="plant-stage-card">{scene}{error && <p className="plant-error">{error}</p>}</section>
        <aside className="plant-parameter-card"><header><span>OBJECT</span><h2>结构与参数</h2></header>{parameters}</aside>
        <section className="plant-input-card"><header><span>INPUT</span><h2>{inputLabel}</h2></header><SignalEditor signal={signal} unit={inputUnit} range={inputRange} manualInput={manualInput} onSignalChange={onSignalChange} onManualInputChange={onManualInputChange} />{extraInput}</section>
        <section className="plant-output-card"><header><div><span>OUTPUT</span><h2>选择观察量</h2></div><select value={selectedOutput} onChange={(event) => onOutputChange(event.target.value)}>{outputs.map((item) => <option key={item.id} value={item.id}>{item.label} / {item.unit}</option>)}</select></header><Plot id={`plant-${title}-${selectedOutput}`} height={300} xLabel="时间 t / s" yLabel={`${output.label} / ${output.unit}`} series={[{ name: output.label, color: "#b7ff4a", points: history.map((point) => ({ x: point.time, y: output.read(point.state, point.input, point.derivative) })) }, { name: inputLabel, color: "#708090", dashed: true, points: history.map((point) => ({ x: point.time, y: point.input })) }]} /></section>
        <section className="plant-model-card"><header><span>MODEL</span><h2>当前模型</h2></header><div className="plant-model-equations">{summary.equations.map((equation) => <MathFormula key={equation} latex={equation} display />)}</div><div className="plant-model-metrics">{summary.metrics.map((metric) => <span key={metric.label}>{metric.label}<strong>{metric.value}</strong></span>)}</div></section>
      </div>
    </section>
  </main>;
}

function SignalEditor({ signal, unit, range, manualInput, onSignalChange, onManualInputChange }: { signal: PlantSignal; unit: string; range: [number, number]; manualInput: number; onSignalChange: (signal: PlantSignal) => void; onManualInputChange: (value: number) => void }) {
  const changeKind = (kind: PlantSignal["kind"]) => {
    if (kind === "manual") onSignalChange({ kind });
    if (kind === "constant") onSignalChange({ kind, amplitude: 1 });
    if (kind === "step") onSignalChange({ kind, amplitude: 1, start: 0.5 });
    if (kind === "sine") onSignalChange({ kind, amplitude: 1, frequency: 0.5, phase: 0 });
    if (kind === "pulse") onSignalChange({ kind, amplitude: 1, start: 0.5, duration: 0.25 });
  };
  const update = (key: "amplitude" | "start" | "frequency" | "duration", value: number) => {
    if (signal.kind === "manual") return;
    onSignalChange({ ...signal, [key]: value } as PlantSignal);
  };
  return <div className="plant-signal-editor"><div className="mini-switch">{(["manual", "constant", "step", "sine", "pulse"] as const).map((kind) => <button key={kind} className={signal.kind === kind ? "active" : ""} onClick={() => changeKind(kind)}>{{ manual: "手动", constant: "恒值", step: "阶跃", sine: "正弦", pulse: "脉冲" }[kind]}</button>)}</div>{signal.kind === "manual" ? <label className="plant-force-slider"><span>{manualInput.toFixed(2)} {unit}</span><input type="range" min={range[0]} max={range[1]} step={(range[1] - range[0]) / 200} value={manualInput} onChange={(event) => onManualInputChange(Number(event.target.value))} onPointerUp={() => onManualInputChange(0)} /></label> : <div className="plant-signal-fields"><NumberField label="幅值" value={signal.amplitude} onChange={(value) => update("amplitude", value)} />{"start" in signal && <NumberField label="开始 / s" value={signal.start} onChange={(value) => update("start", value)} />}{signal.kind === "sine" && <NumberField label="频率 / Hz" value={signal.frequency} onChange={(value) => update("frequency", value)} />}{signal.kind === "pulse" && <NumberField label="持续 / s" value={signal.duration} onChange={(value) => update("duration", value)} />}</div>}</div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="plant-number"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
