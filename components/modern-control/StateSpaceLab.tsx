"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import {
  analyzeStateSpace,
  clonePreset,
  sensorMatrix,
  simulateStateSpace,
  STATE_SPACE_PRESETS,
} from "@/lib/stateSpace";
import type { StateSpacePreset } from "@/lib/stateSpace";

const COLORS = ["#b7ff4a", "#55d6be", "#f3ac58", "#b18cff"];

export function StateSpaceLab({ onHome, onTransfer, onSimulation }: { onHome: () => void; onTransfer: () => void; onSimulation: () => void }) {
  const [model, setModel] = useState(() => clonePreset(STATE_SPACE_PRESETS[0]));
  const [actuatorEnabled, setActuatorEnabled] = useState(true);
  const order = model.A.length;
  const effectiveB = useMemo(() => actuatorEnabled ? model.B : model.B.map(() => 0), [actuatorEnabled, model.B]);
  const C = useMemo(() => sensorMatrix(order, model.sensors), [model.sensors, order]);
  const analysis = useMemo(() => analyzeStateSpace(model.A, effectiveB, C), [C, effectiveB, model.A]);
  const samples = useMemo(() => simulateStateSpace(model.A, effectiveB, model.initial, model.input, model.duration), [effectiveB, model]);
  const controllable = analysis.controllabilityRank === order;
  const observable = analysis.observabilityRank === order;
  const stable = analysis.eigenvalues.every((value) => value.re < -1e-7);
  const axes = model.plotAxes;

  const loadPreset = (preset: StateSpacePreset) => {
    setModel(clonePreset(preset));
    setActuatorEnabled(true);
  };

  const updateA = (row: number, column: number, value: number) => setModel((current) => ({ ...current, A: current.A.map((items, rowIndex) => items.map((item, columnIndex) => rowIndex === row && columnIndex === column ? value : item)) }));
  const updateB = (index: number, value: number) => setModel((current) => ({ ...current, B: current.B.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const updateInitial = (index: number, value: number) => setModel((current) => ({ ...current, initial: current.initial.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const toggleSensor = (index: number) => setModel((current) => ({ ...current, sensors: current.sensors.includes(index) ? current.sensors.filter((item) => item !== index) : [...current.sensors, index].sort() }));

  return <main className="controlab-app state-space-page">
    <AppHeader title="状态空间实验台 / Modern Control" onHome={onHome} trailing={<>
      <button className="simulation-shortcut" onClick={onTransfer}>传函工作台</button>
      <button className="simulation-shortcut" onClick={onSimulation}>倒立摆实验</button>
    </>} />

    <div className="state-space-shell">
      <aside className="state-model-panel">
        <div className="state-panel-head"><div><span className="section-label">STATE MODEL</span><h2>系统内部模型</h2></div><span>{order} STATES</span></div>
        <p className="state-panel-intro">修改矩阵、执行器或传感器，右侧分析会同步变化。</p>

        <div className="state-presets">
          {STATE_SPACE_PRESETS.map((preset) => <button key={preset.id} className={model.id === preset.id ? "active" : ""} onClick={() => loadPreset(preset)}>{preset.name}</button>)}
        </div>
        <p className="preset-description">{model.description}</p>

        <MatrixEditor label="系统矩阵 A" value={model.A} onChange={updateA} />
        <VectorEditor label="输入矩阵 B" value={model.B} labels={model.stateLabels} onChange={updateB} />

        <section className="io-selector">
          <div className="io-selector-head"><span>执行器</span><label className={`feedback-toggle ${actuatorEnabled ? "on" : ""}`}><input aria-label="执行器接通" type="checkbox" checked={actuatorEnabled} onChange={(event) => setActuatorEnabled(event.target.checked)} /><i /></label></div>
          <p>{actuatorEnabled ? "输入 u 可以通过 B 进入系统。" : "执行器已断开：B 等效为零。"}</p>
        </section>

        <section className="sensor-selector">
          <span>可测状态 / 传感器 C</span>
          <div>{model.stateLabels.map((label, index) => <button key={label} className={model.sensors.includes(index) ? "active" : ""} onClick={() => toggleSensor(index)}>{label}</button>)}</div>
          <small>每个按钮代表直接测量一个状态；关闭后，观测器只能从其余输出推断它。</small>
        </section>

        <VectorEditor label="初始状态 x(0)" value={model.initial} labels={model.stateLabels} onChange={updateInitial} />
        <label className="state-input-control"><span>恒定输入 u<b>{formatNumber(model.input, 1)}</b></span><input type="range" min="-2" max="2" step="0.1" value={model.input} onInput={(event) => setModel((current) => ({ ...current, input: Number(event.currentTarget.value) }))} /></label>
      </aside>

      <section className="state-workspace">
        <header className="state-hero">
          <div><span className="section-label">UNDER THE OUTPUT</span><h1>看见系统内部，而不只看见输出。</h1><p>状态空间把系统写成一阶方程组；能控性回答“推不推得到”，能观性回答“看不看得见”。</p></div>
          <MathFormula latex="\dot{\mathbf{x}}=A\mathbf{x}+B u,\qquad \mathbf{y}=C\mathbf{x}" display />
        </header>

        <div className="property-grid">
          <PropertyCard kind="controllable" title="能控性" rank={analysis.controllabilityRank} order={order} passed={controllable} description={controllable ? "输入能够影响全部状态方向。" : `有 ${order - analysis.controllabilityRank} 个状态方向无法由当前执行器到达。`} values={analysis.controllabilityStrength} />
          <PropertyCard kind="observable" title="能观性" rank={analysis.observabilityRank} order={order} passed={observable} description={observable ? "当前输出包含重建全部状态所需的信息。" : `有 ${order - analysis.observabilityRank} 个状态方向藏在传感器背后。`} values={analysis.observabilityStrength} />
          <div className="mode-summary"><span>系统模态</span><strong className={stable ? "good" : "warn"}>{stable ? "渐近稳定" : "含不稳定模态"}</strong><div>{analysis.eigenvalues.map((value, index) => <code key={index}>{complexText(value)}</code>)}</div></div>
        </div>

        <div className="state-visual-grid">
          <article className="state-visual-card trajectory-card">
            <div className="visual-title"><div><span>STATE PORTRAIT</span><h2>状态轨迹</h2></div><AxisPicker model={model} onChange={(plotAxes) => setModel((current) => ({ ...current, plotAxes }))} /></div>
            <Plot id="controlab-state-portrait" height={360} square series={[{ name: `${model.stateLabels[axes[0]]}–${model.stateLabels[axes[1]]} 轨迹`, color: "#b7ff4a", points: samples.map((sample) => ({ x: sample.state[axes[0]], y: sample.state[axes[1]] })) }]} markers={samples.length ? [{ point: { x: samples[0].state[axes[0]], y: samples[0].state[axes[1]] }, color: "#f3ac58", shape: "circle" }, { point: { x: samples.at(-1)!.state[axes[0]], y: samples.at(-1)!.state[axes[1]] }, color: "#55d6be", shape: "cross" }] : []} xLabel={model.stateLabels[axes[0]]} yLabel={model.stateLabels[axes[1]]} />
            <p>橙色圆点是初始状态，青色叉号是仿真终点。轨迹是否回到原点，直接反映系统模态。</p>
          </article>

          <article className="state-visual-card">
            <div className="visual-title"><div><span>STATE RESPONSE</span><h2>全部状态随时间变化</h2></div><small>{model.duration}s</small></div>
            <Plot id="controlab-state-response" height={360} series={model.stateLabels.map((label, index) => ({ name: label, color: COLORS[index % COLORS.length], points: samples.map((sample) => ({ x: sample.t, y: sample.state[index] })) }))} xLabel="时间 t / s" yLabel="状态值" />
          </article>
        </div>

        <div className="state-evidence-grid">
          <article className="state-visual-card mode-card">
            <div className="visual-title"><div><span>EIGEN MODES</span><h2>特征值平面</h2></div><small>× = λ(A)</small></div>
            <Plot id="controlab-state-modes" height={270} square series={[{ name: "系统模态", color: "#6f7c8a", points: [] }]} markers={analysis.eigenvalues.map((value) => ({ point: { x: value.re, y: value.im }, color: value.re < 0 ? "#55d6be" : "#ff6f61", shape: "cross" }))} xLabel="实部 Re" yLabel="虚部 Im" />
          </article>
          <MatrixEvidence title="能控矩阵" symbol="\mathcal{C}=[B\ AB\ \cdots\ A^{n-1}B]" matrix={analysis.controllability} rank={analysis.controllabilityRank} />
          <MatrixEvidence title="能观矩阵" symbol="\mathcal{O}=[C^\mathsf{T}\ (CA)^\mathsf{T}\ \cdots]^\mathsf{T}" matrix={analysis.observability} rank={analysis.observabilityRank} />
        </div>
      </section>
    </div>
  </main>;
}

function MatrixEditor({ label, value, onChange }: { label: string; value: number[][]; onChange: (row: number, column: number, value: number) => void }) {
  return <section className="matrix-editor"><span>{label}</span><div style={{ gridTemplateColumns: `repeat(${value[0].length},minmax(0,1fr))` }}>{value.flatMap((row, rowIndex) => row.map((item, columnIndex) => <input aria-label={`${label} ${rowIndex + 1},${columnIndex + 1}`} key={`${rowIndex}-${columnIndex}`} type="number" step="0.1" value={item} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(rowIndex, columnIndex, next); }} />))}</div></section>;
}

function VectorEditor({ label, value, labels, onChange }: { label: string; value: number[]; labels: string[]; onChange: (index: number, value: number) => void }) {
  return <section className="vector-editor"><span>{label}</span><div>{value.map((item, index) => <label key={labels[index]}><small>{labels[index]}</small><input aria-label={`${label} ${labels[index]}`} type="number" step="0.1" value={item} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(index, next); }} /></label>)}</div></section>;
}

function PropertyCard({ kind, title, rank, order, passed, description, values }: { kind: string; title: string; rank: number; order: number; passed: boolean; description: string; values: number[] }) {
  const maximum = Math.max(...values, 1e-9);
  return <article className={`property-card ${passed ? "passed" : "failed"}`}><div><span>{title}</span><strong>{rank}/{order}</strong></div><p>{description}</p><div className="strength-bars" aria-label={`${title}方向强度`}>{values.slice(0, order).map((value, index) => <i key={index} title={`${kind} σ${index + 1}=${formatNumber(value, 4)}`}><b style={{ width: `${Math.max(2, (value / maximum) * 100)}%` }} /></i>)}</div></article>;
}

function AxisPicker({ model, onChange }: { model: StateSpacePreset; onChange: (axes: [number, number]) => void }) {
  return <div className="axis-picker"><select aria-label="状态轨迹横轴" value={model.plotAxes[0]} onChange={(event) => onChange([Number(event.target.value), model.plotAxes[1]])}>{model.stateLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}</select><span>×</span><select aria-label="状态轨迹纵轴" value={model.plotAxes[1]} onChange={(event) => onChange([model.plotAxes[0], Number(event.target.value)])}>{model.stateLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></div>;
}

function MatrixEvidence({ title, symbol, matrix, rank }: { title: string; symbol: string; matrix: number[][]; rank: number }) {
  return <article className="state-visual-card matrix-evidence"><div className="visual-title"><div><span>RANK TEST</span><h2>{title}</h2></div><strong>rank {rank}</strong></div><MathFormula latex={symbol} display /><div className="matrix-readout">{matrix.map((row, index) => <code key={index}>[{row.map((value) => formatNumber(value, 3).padStart(7, " ")).join("  ")}]</code>)}</div></article>;
}

function complexText(value: { re: number; im: number }) {
  if (Math.abs(value.im) < 1e-7) return formatNumber(value.re, 3);
  return `${formatNumber(value.re, 3)} ${value.im >= 0 ? "+" : "−"} ${formatNumber(Math.abs(value.im), 3)}j`;
}
