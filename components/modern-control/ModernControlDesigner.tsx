"use client";

import { useMemo, useState } from "react";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import { closedLoopMatrix, designDiscreteLqr, designKalmanGain, observerErrorMatrix, placeObserverPoles, placeSisoPoles, simulateOutputFeedback } from "@/lib/modernControl";
import { inputVectorAtTime, stateEigenvalues } from "@/lib/stateSpace";
import type { StateSpacePreset } from "@/lib/stateSpace";

type ControllerMode = "lqr" | "poles" | "manual";
type EstimatorMode = "kalman" | "poles" | "full-state";
type ResultView = "state" | "error" | "control" | "poles";

const COLORS = ["#b7ff4a", "#55d6be", "#f3ac58", "#b18cff", "#ff7e72", "#6f9dff"];

export function ModernControlDesigner({ model }: { model: StateSpacePreset }) {
  const order = model.A.length;
  const inputCount = model.B[0].length;
  const outputCount = model.C.length;
  const [controllerMode, setControllerMode] = useState<ControllerMode>("lqr");
  const [estimatorMode, setEstimatorMode] = useState<EstimatorMode>("kalman");
  const [view, setView] = useState<ResultView>("state");
  const [selectedState, setSelectedState] = useState(0);
  const [q, setQ] = useState(() => Array(order).fill(1));
  const [r, setR] = useState(() => Array(inputCount).fill(1));
  const [processNoise, setProcessNoise] = useState(() => Array(order).fill(0.04));
  const [measurementNoise, setMeasurementNoise] = useState(() => Array(outputCount).fill(0.12));
  const [controllerPoles, setControllerPoles] = useState(() => defaultPoles(order, 1.5));
  const [observerPoles, setObserverPoles] = useState(() => defaultPoles(order, 4));
  const [manualK, setManualK] = useState(() => zeroMatrix(inputCount, order));

  const controller = useMemo(() => designSafely(() => controllerMode === "lqr" ? designDiscreteLqr(model.A, model.B, q, r) : controllerMode === "poles" ? placeSisoPoles(model.A, model.B, controllerPoles) : manualK, zeroMatrix(inputCount, order)), [controllerMode, controllerPoles, manualK, model.A, model.B, q, r, inputCount, order]);
  const estimator = useMemo(() => estimatorMode === "full-state" ? { value: undefined, error: "" } : designSafely(() => estimatorMode === "kalman" ? designKalmanGain(model.A, model.C, processNoise, measurementNoise) : placeObserverPoles(model.A, model.C, observerPoles), zeroMatrix(order, outputCount)), [estimatorMode, measurementNoise, model.A, model.C, observerPoles, order, outputCount, processNoise]);

  const simulation = useMemo(() => simulateOutputFeedback({
    A: model.A,
    B: model.B,
    C: model.C,
    initial: model.initial,
    estimatedInitial: Array(order).fill(0),
    K: controller.value,
    L: estimator.value,
    duration: model.duration,
    dt: 0.02,
    externalInput: (time) => inputVectorAtTime(model.inputs, time),
    measurementNoise: estimatorMode === "kalman" ? Math.sqrt(Math.max(...measurementNoise)) * 0.03 : 0,
  }), [controller.value, estimator.value, estimatorMode, measurementNoise, model, order]);

  const closedPoles = useMemo(() => stateEigenvalues(closedLoopMatrix(model.A, model.B, controller.value)), [controller.value, model.A, model.B]);
  const observerPolesResult = useMemo(() => estimator.value ? stateEigenvalues(observerErrorMatrix(model.A, estimator.value, model.C)) : [], [estimator.value, model.A, model.C]);
  const stable = !controller.error && closedPoles.every((pole) => pole.re < -1e-6);
  const observerStable = !estimator.error && (estimatorMode === "full-state" || observerPolesResult.every((pole) => pole.re < -1e-6));
  const rmsError = rms(simulation.samples.map((sample) => sample.errorNorm));
  const rmsControl = rms(simulation.samples.flatMap((sample) => sample.control));

  const series = view === "state" ? [
    { name: `真实 x${selectedState + 1}`, color: COLORS[selectedState % COLORS.length], points: simulation.samples.map((sample) => ({ x: sample.t, y: sample.state[selectedState] })) },
    { name: `估计 x̂${selectedState + 1}`, color: "#f3ac58", dashed: true, points: simulation.samples.map((sample) => ({ x: sample.t, y: sample.estimate[selectedState] })) },
  ] : view === "error" ? Array.from({ length: order }, (_, state) => ({ name: `e${state + 1}`, color: COLORS[state % COLORS.length], points: simulation.samples.map((sample) => ({ x: sample.t, y: sample.error[state] })) })) : Array.from({ length: inputCount }, (_, input) => ({ name: `u${input + 1}`, color: COLORS[input % COLORS.length], points: simulation.samples.map((sample) => ({ x: sample.t, y: sample.control[input] })) }));

  return <div className="modern-design-shell">
    <aside className="modern-design-panel">
      <section className="design-stage">
        <header><span>01</span><div><small>STATE FEEDBACK</small><h2>状态反馈</h2></div></header>
        <Segmented value={controllerMode} options={[["lqr", "LQR"], ["poles", "极点配置"], ["manual", "自定义增益"]]} onChange={setControllerMode} />
        {controllerMode === "lqr" && <><WeightEditor label="Q 对角" prefix="q" values={q} onChange={setQ} /><WeightEditor label="R 对角" prefix="r" values={r} onChange={setR} /></>}
        {controllerMode === "poles" && <PoleEditor values={controllerPoles} onChange={setControllerPoles} disabled={inputCount !== 1} />}
        {controllerMode === "manual" && <><p className="stage-note">输入已经计算好的状态反馈矩阵 K；初学时建议先使用 LQR 或极点配置。</p><GainEditor label="K" values={manualK} onChange={setManualK} /></>}
        <InlineStatus ok={!controller.error} text={controller.error || `K · ${inputCount}×${order}`} />
      </section>

      <section className="design-stage">
        <header><span>02</span><div><small>STATE ESTIMATION</small><h2>状态估计</h2></div></header>
        <Segmented value={estimatorMode} options={[["kalman", "卡尔曼"], ["poles", "观测器"], ["full-state", "全状态"]]} onChange={setEstimatorMode} />
        {estimatorMode === "kalman" && <><WeightEditor label="过程噪声 Qn" prefix="q" values={processNoise} onChange={setProcessNoise} /><WeightEditor label="测量噪声 Rn" prefix="r" values={measurementNoise} onChange={setMeasurementNoise} /></>}
        {estimatorMode === "poles" && <PoleEditor values={observerPoles} onChange={setObserverPoles} disabled={outputCount !== 1} />}
        {estimatorMode === "full-state" && <p className="stage-note">直接使用 x，不经过估计器。</p>}
        <InlineStatus ok={!estimator.error} text={estimator.error || (estimatorMode === "full-state" ? "x̂ = x" : `L · ${order}×${outputCount}`)} />
      </section>
    </aside>

    <section className="modern-result-panel">
      <div className="output-feedback-strip"><span>r / uext</span><i>→</i><b>−K</b><i>→</i><b>被控对象</b><i>→</i><span>y</span><em>观测器 / Kalman → x̂ ↩</em></div>
      <div className="modern-result-tabs">{([["state", "状态对比"], ["error", "估计误差"], ["control", "控制输入"], ["poles", "闭环极点"]] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>
      <div className="modern-result-head"><div><span className="section-label">OUTPUT FEEDBACK</span><h2>{resultTitle(view)}</h2></div>{view === "state" && <select aria-label="选择状态" value={selectedState} onChange={(event) => setSelectedState(Number(event.target.value))}>{Array.from({ length: order }, (_, index) => <option key={index} value={index}>x{index + 1}</option>)}</select>}</div>
      <div className="primary-plot modern-control-plot">
        {view !== "poles" ? <Plot id={`modern-${view}`} height={480} legendLimit={4} series={series} xLabel="时间 t / s" yLabel={view === "control" ? "控制输入 u" : view === "error" ? "估计误差 e" : "状态 x"} /> : <Plot id="modern-poles" height={480} legendLimit={0} square series={[]} markers={[...closedPoles.map((pole) => ({ point: { x: pole.re, y: pole.im }, color: "#b7ff4a", shape: "cross" as const })), ...observerPolesResult.map((pole) => ({ point: { x: pole.re, y: pole.im }, color: "#f3ac58", shape: "circle" as const }))]} xLabel="实部 Re" yLabel="虚部 Im" />}
      </div>
      <div className="modern-metric-rail">
        <Metric label="闭环" value={stable ? "稳定" : "不稳定"} good={stable} />
        <Metric label="估计器" value={observerStable ? "收敛" : "不收敛"} good={observerStable} />
        <Metric label="估计 RMSE" value={formatNumber(rmsError, 4)} />
        <Metric label="控制 RMS" value={formatNumber(rmsControl, 4)} />
      </div>
      <details className="gain-readout"><summary>查看增益与极点</summary><div><MathFormula latex="u=u_{ext}-K\hat{x}" display /><GainTable label="K" values={controller.value} /><GainTable label="L" values={estimator.value ?? identityEstimate(order, outputCount)} /></div></details>
    </section>
  </div>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<readonly [T, string]>; onChange: (value: T) => void }) { return <div className="design-segmented">{options.map(([key, label]) => <button key={key} className={value === key ? "active" : ""} onClick={() => onChange(key)}>{label}</button>)}</div>; }
function WeightEditor({ label, prefix, values, onChange }: { label: string; prefix: string; values: number[]; onChange: (values: number[]) => void }) { return <label className="weight-editor"><span>{label}</span><div>{values.map((value, index) => <label key={index}><small>{prefix}{index + 1}</small><input type="number" min="0.0001" step="0.1" value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? Math.max(0.0001, Number(event.target.value) || 0.0001) : item))} /></label>)}</div></label>; }
function PoleEditor({ values, onChange, disabled }: { values: number[]; onChange: (values: number[]) => void; disabled: boolean }) { return <label className="weight-editor"><span>目标极点 {disabled && "· 仅支持 SISO"}</span><div>{values.map((value, index) => <label key={index}><small>p{index + 1}</small><input disabled={disabled} type="number" step="0.5" value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) || -1 : item))} /></label>)}</div></label>; }
function GainEditor({ label, values, onChange }: { label: string; values: number[][]; onChange: (values: number[][]) => void }) { return <div className="gain-editor"><span>{label}</span><div style={{ gridTemplateColumns: `repeat(${values[0].length},1fr)` }}>{values.flatMap((row, i) => row.map((value, j) => <input aria-label={`${label}${i + 1},${j + 1}`} key={`${i}-${j}`} type="number" step="0.1" value={value} onChange={(event) => onChange(values.map((items, row) => items.map((item, column) => row === i && column === j ? Number(event.target.value) || 0 : item)))} />))}</div></div>; }
function GainTable({ label, values }: { label: string; values: number[][] }) { return <div className="gain-table"><strong>{label}</strong>{values.map((row, index) => <code key={index}>[{row.map((value) => formatNumber(value, 3).padStart(8, " ")).join("  ")}]</code>)}</div>; }
function InlineStatus({ ok, text }: { ok: boolean; text: string }) { return <div className={`inline-design-status ${ok ? "ok" : "error"}`}><i />{text}</div>; }
function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) { return <div><span>{label}</span><strong className={good === false ? "bad" : good ? "good" : ""}>{value}</strong></div>; }
function designSafely<T>(factory: () => T, fallback: T) { try { return { value: factory(), error: "" }; } catch (reason) { return { value: fallback, error: reason instanceof Error ? reason.message : "设计失败" }; } }
function defaultPoles(order: number, start: number) { return Array.from({ length: order }, (_, index) => -(start + index)); }
function zeroMatrix(rows: number, columns: number) { return Array.from({ length: rows }, () => Array(columns).fill(0)); }
function identityEstimate(rows: number, columns: number) { return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row === column ? 1 : 0)); }
function rms(values: number[]) { return values.length ? Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length) : 0; }
function resultTitle(view: ResultView) { return { state: "真实状态与估计状态", error: "估计误差是否收敛", control: "控制器实际输出", poles: "控制与估计的动态速度" }[view]; }
