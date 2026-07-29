"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import {
  analyzeStateSpace,
  clonePreset,
  createInitialStateSpaceModel,
  emptyStateSpace,
  parseMatrixText,
  resizeStateSpace,
  simulateStateSpace,
  STATE_SPACE_PRESETS,
} from "@/lib/stateSpace";
import type { LinearStability, StateInputConfig, StateSpacePreset } from "@/lib/stateSpace";

type MatrixKey = "A" | "B" | "C" | "D";
type ViewTab = "state" | "output" | "trajectory" | "eigen";
type DetailTab = "controllability" | "observability" | "stability" | null;

const COLORS = ["#b7ff4a", "#55d6be", "#f3ac58", "#b18cff", "#ff7e72", "#6f9dff"];
const INPUT_NAMES: Record<StateInputConfig["kind"], string> = { zero: "零输入", step: "阶跃", sine: "正弦", ramp: "斜坡" };

export function StateSpaceLab({ onHome, onTransfer, onSimulation }: { onHome: () => void; onTransfer: () => void; onSimulation: () => void }) {
  const [model, setModel] = useState(createInitialStateSpaceModel);
  const [view, setView] = useState<ViewTab>("state");
  const [detail, setDetail] = useState<DetailTab>(null);
  const [pasteTarget, setPasteTarget] = useState<MatrixKey | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

  const order = model.A.length;
  const inputCount = model.B[0]?.length ?? 1;
  const outputCount = model.C.length;
  const analysis = useMemo(() => analyzeStateSpace(model.A, model.B, model.C), [model.A, model.B, model.C]);
  const samples = useMemo(() => simulateStateSpace(model.A, model.B, model.C, model.D, model.initial, model.inputs, model.duration), [model]);
  const axes = model.plotAxes;
  const stateSeries = stateLabels(order).map((name, index) => ({ name, color: COLORS[index % COLORS.length], points: samples.map((sample) => ({ x: sample.t, y: sample.state[index] })) }));
  const outputSeries = outputLabels(outputCount).map((name, index) => ({ name, color: COLORS[index % COLORS.length], points: samples.map((sample) => ({ x: sample.t, y: sample.output[index] })) }));

  const updateDimensions = (nextOrder: number, nextInputs: number, nextOutputs: number) => setModel((current) => resizeStateSpace(current, nextOrder, nextInputs, nextOutputs));
  const updateMatrix = (key: MatrixKey, row: number, column: number, value: number) => setModel((current) => ({ ...current, id: "custom", name: "自定义系统", [key]: current[key].map((items, rowIndex) => items.map((item, columnIndex) => rowIndex === row && columnIndex === column ? value : item)) }));
  const clearMatrix = (key: MatrixKey) => setModel((current) => ({ ...current, id: "custom", name: "自定义系统", [key]: current[key].map((row) => row.map(() => 0)) }));
  const makeIdentity = () => setModel((current) => ({ ...current, id: "custom", name: "自定义系统", A: current.A.map((row, rowIndex) => row.map((_, columnIndex) => rowIndex === columnIndex ? 1 : 0)) }));
  const updateInitial = (index: number, value: number) => setModel((current) => ({ ...current, initial: current.initial.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const updateInput = (index: number, patch: Partial<StateInputConfig>) => setModel((current) => ({ ...current, inputs: current.inputs.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const resetWorkspace = () => {
    setModel(createInitialStateSpaceModel());
    setView("state");
    setDetail(null);
    setPasteTarget(null);
    setPasteText("");
    setPasteError("");
  };

  const openPaste = (key: MatrixKey) => {
    setPasteTarget(key);
    setPasteText(model[key].map((row) => row.join(" ")).join("\n"));
    setPasteError("");
  };
  const applyPaste = () => {
    if (!pasteTarget) return;
    try {
      const rows = model[pasteTarget].length;
      const columns = model[pasteTarget][0].length;
      const parsed = parseMatrixText(pasteText, rows, columns);
      setModel((current) => ({ ...current, id: "custom", name: "自定义系统", [pasteTarget]: parsed }));
      setPasteTarget(null);
      setPasteError("");
    } catch (reason) {
      setPasteError(reason instanceof Error ? reason.message : "矩阵格式不正确");
    }
  };

  return <main className="controlab-app matrix-studio-page">
    <AppHeader title="状态空间工作台 / Modern Control" onHome={onHome} trailing={<>
      <button className="simulation-shortcut" onClick={onTransfer}>传函工作台</button>
      <button className="simulation-shortcut" onClick={onSimulation}>倒立摆实验</button>
    </>} />

    <section className="matrix-studio">
      <header className="matrix-studio-toolbar">
        <div><span className="section-label">STATE–SPACE STUDIO</span><h1>状态空间模型</h1></div>
        <div className="dimension-controls">
          <DimensionSelect label="状态 n" value={order} maximum={6} onChange={(value) => updateDimensions(value, inputCount, outputCount)} />
          <DimensionSelect label="输入 m" value={inputCount} maximum={3} onChange={(value) => updateDimensions(order, value, outputCount)} />
          <DimensionSelect label="输出 p" value={outputCount} maximum={4} onChange={(value) => updateDimensions(order, inputCount, value)} />
          <label className="example-loader"><span>载入示例</span><select value={model.id} onChange={(event) => { const preset = STATE_SPACE_PRESETS.find((item) => item.id === event.target.value); if (preset) setModel(clonePreset(preset)); else setModel(emptyStateSpace(order, inputCount, outputCount)); }}><option value="custom">自定义系统</option>{STATE_SPACE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
          <button className="blank-model" onClick={resetWorkspace}>重置</button>
        </div>
      </header>

      <div className="matrix-studio-main">
        <section className="matrix-composer">
          <div className="matrix-composer-head"><div><span>MODEL COMPOSER</span><h2>ABCD 矩阵</h2></div><MathFormula latex="\dot{x}=Ax+Bu,\quad y=Cx+Du" display /></div>
          <div className="matrix-quartet">
            <MatrixCard symbol="A" value={model.A} onChange={(row, column, value) => updateMatrix("A", row, column, value)} onPaste={() => openPaste("A")} onClear={() => clearMatrix("A")} onIdentity={makeIdentity} />
            <MatrixCard symbol="B" value={model.B} onChange={(row, column, value) => updateMatrix("B", row, column, value)} onPaste={() => openPaste("B")} onClear={() => clearMatrix("B")} />
            <MatrixCard symbol="C" value={model.C} onChange={(row, column, value) => updateMatrix("C", row, column, value)} onPaste={() => openPaste("C")} onClear={() => clearMatrix("C")} />
            <MatrixCard symbol="D" value={model.D} onChange={(row, column, value) => updateMatrix("D", row, column, value)} onPaste={() => openPaste("D")} onClear={() => clearMatrix("D")} />
          </div>

          {pasteTarget && <section className="matrix-paste-panel"><div><strong>粘贴矩阵 {pasteTarget}</strong><span>{model[pasteTarget].length} × {model[pasteTarget][0].length}</span></div><textarea aria-label={`粘贴矩阵 ${pasteTarget}`} value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={Math.min(7, model[pasteTarget].length + 1)} spellCheck={false} /><p>{pasteError || "每行用换行或分号分隔，元素可用空格或逗号分隔。"}</p><div><button onClick={() => setPasteTarget(null)}>取消</button><button className="primary" onClick={applyPaste}>应用矩阵</button></div></section>}

          <div className="simulation-config">
            <section className="initial-state-editor"><div className="config-heading"><span>初始状态</span><MathFormula latex="x(0)" /></div><div>{model.initial.map((value, index) => <label key={index}><span>{stateLabel(index)}</span><input aria-label={`初始状态 ${stateLabel(index)}`} type="number" step="0.1" value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) updateInitial(index, next); }} /></label>)}</div></section>
            <section className="input-editor"><div className="config-heading"><span>输入信号</span><label>仿真时长<input aria-label="仿真时长" type="number" min="1" max="30" step="0.5" value={model.duration} onChange={(event) => setModel((current) => ({ ...current, duration: clamp(Number(event.target.value), 1, 30) }))} />s</label></div><div>{model.inputs.map((config, index) => <div className="input-channel" key={index}><strong>{inputLabel(index)}</strong><select aria-label={`${inputLabel(index)} 类型`} value={config.kind} onChange={(event) => updateInput(index, { kind: event.target.value as StateInputConfig["kind"] })}>{Object.entries(INPUT_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label>幅值<input aria-label={`${inputLabel(index)} 幅值`} type="number" step="0.1" value={config.amplitude} onChange={(event) => updateInput(index, { amplitude: Number(event.target.value) || 0 })} /></label>{config.kind === "sine" && <label>Hz<input aria-label={`${inputLabel(index)} 频率`} type="number" min="0.01" step="0.1" value={config.frequency} onChange={(event) => updateInput(index, { frequency: Math.max(0.01, Number(event.target.value) || 0.01) })} /></label>}</div>)}</div></section>
          </div>
        </section>

        <section className="primary-visualizer">
          <div className="visualizer-tabs" role="tablist">{([['state','状态响应'],['output','输出响应'],['trajectory','状态轨迹'],['eigen','特征值']] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>
          <div className="visualizer-head"><div><span>{viewKicker(view)}</span><h2>{viewTitle(view)}</h2></div>{view === "trajectory" && <AxisPicker order={order} axes={axes} onChange={(plotAxes) => setModel((current) => ({ ...current, plotAxes }))} />}</div>
          {(view === "state" || view === "output") && <SeriesLegend series={view === "state" ? stateSeries : outputSeries} />}
          <div className="primary-plot">
            {view === "state" && <Plot id="matrix-studio-state" height={500} legendLimit={0} series={stateSeries} xLabel="时间 t / s" yLabel="状态 x" />}
            {view === "output" && <Plot id="matrix-studio-output" height={500} legendLimit={0} series={outputSeries} xLabel="时间 t / s" yLabel="输出 y" />}
            {view === "trajectory" && <Plot id="matrix-studio-trajectory" height={500} legendLimit={0} square series={[{ name: "状态轨迹", color: "#b7ff4a", points: samples.map((sample) => ({ x: sample.state[axes[0]], y: sample.state[axes[1]] })) }]} markers={samples.length ? [{ point: { x: samples[0].state[axes[0]], y: samples[0].state[axes[1]] }, color: "#f3ac58", shape: "circle" }, { point: { x: samples.at(-1)!.state[axes[0]], y: samples.at(-1)!.state[axes[1]] }, color: "#55d6be", shape: "cross" }] : []} xLabel={stateLabel(axes[0])} yLabel={stateLabel(axes[1])} />}
            {view === "eigen" && <Plot id="matrix-studio-eigen" height={500} legendLimit={0} square series={[]} markers={analysis.eigenvalues.map((value) => ({ point: { x: value.re, y: value.im }, color: value.re < 0 ? "#55d6be" : "#ff7166", shape: "cross" }))} xLabel="实部 Re" yLabel="虚部 Im" />}
          </div>
          <p className="visualizer-note">{viewNote(view, model, analysis.stability)}</p>
        </section>
      </div>

      <section className="analysis-rail">
        <AnalysisItem label="能控性" value={`rank ${analysis.controllabilityRank}/${order}`} tone={analysis.controllabilityRank === order ? "good" : "warn"} summary={analysis.controllabilityRank === order ? "全部状态方向可由输入到达" : `${order - analysis.controllabilityRank} 个方向不可控`} active={detail === "controllability"} onClick={() => setDetail(detail === "controllability" ? null : "controllability")} />
        <AnalysisItem label="能观性" value={`rank ${analysis.observabilityRank}/${order}`} tone={analysis.observabilityRank === order ? "good" : "warn"} summary={analysis.observabilityRank === order ? "全部状态可由输出重建" : `${order - analysis.observabilityRank} 个方向不可观`} active={detail === "observability"} onClick={() => setDetail(detail === "observability" ? null : "observability")} />
        <AnalysisItem label="稳定性" value={stabilityLabel(analysis.stability)} tone={analysis.stability === "unstable" ? "warn" : "good"} summary={stabilitySummary(analysis.stability)} active={detail === "stability"} onClick={() => setDetail(detail === "stability" ? null : "stability")} />
      </section>

      {detail && <section className="analysis-detail">
        {detail === "controllability" && <MatrixDetail title="能控性推导" formula="\mathcal{C}=[B\ AB\ \cdots\ A^{n-1}B]" matrix={analysis.controllability} rank={analysis.controllabilityRank} conclusion={analysis.controllabilityRank === order ? "矩阵满行秩，因此任意状态方向都可以由输入影响。" : "矩阵不满行秩，当前 B 无法把输入作用传递到全部状态方向。"} />}
        {detail === "observability" && <MatrixDetail title="能观性推导" formula="\mathcal{O}=[C^\mathsf{T}\ (CA)^\mathsf{T}\ \cdots]^\mathsf{T}" matrix={analysis.observability} rank={analysis.observabilityRank} conclusion={analysis.observabilityRank === order ? "矩阵满列秩，状态可以由输出随时间的变化唯一重建。" : "矩阵不满列秩，存在不同内部状态产生相同输出的情况。"} />}
        {detail === "stability" && <StabilityDetail stability={analysis.stability} eigenvalues={analysis.eigenvalues} />}
      </section>}
    </section>
  </main>;
}

function DimensionSelect({ label, value, maximum, onChange }: { label: string; value: number; maximum: number; onChange: (value: number) => void }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: maximum }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>; }

function MatrixCard({ symbol, value, onChange, onPaste, onClear, onIdentity }: { symbol: MatrixKey; value: number[][]; onChange: (row: number, column: number, value: number) => void; onPaste: () => void; onClear: () => void; onIdentity?: () => void }) {
  return <article className="matrix-card"><header><div><strong>{symbol}</strong><span>{value.length} × {value[0].length}</span></div><div>{onIdentity && <button onClick={onIdentity}>单位阵</button>}<button onClick={onClear}>清零</button><button onClick={onPaste}>整块粘贴</button></div></header><div className="matrix-cell-grid" style={{ gridTemplateColumns: `repeat(${value[0].length},minmax(44px,1fr))` }}>{value.flatMap((row, rowIndex) => row.map((item, columnIndex) => <input aria-label={`矩阵 ${symbol} ${rowIndex + 1},${columnIndex + 1}`} key={`${rowIndex}-${columnIndex}`} type="number" step="0.1" value={item} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(rowIndex, columnIndex, next); }} />))}</div></article>;
}

function AxisPicker({ order, axes, onChange }: { order: number; axes: [number, number]; onChange: (axes: [number, number]) => void }) { return <div className="studio-axis-picker"><select aria-label="状态轨迹横轴" value={axes[0]} onChange={(event) => onChange([Number(event.target.value), axes[1]])}>{stateLabels(order).map((label, index) => <option key={label} value={index}>{label}</option>)}</select><span>×</span><select aria-label="状态轨迹纵轴" value={axes[1]} onChange={(event) => onChange([axes[0], Number(event.target.value)])}>{stateLabels(order).map((label, index) => <option key={label} value={index}>{label}</option>)}</select></div>; }

function SeriesLegend({ series }: { series: Array<{ name: string; color: string }> }) { return <div className="studio-series-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>; }

function AnalysisItem({ label, value, tone, summary, active, onClick }: { label: string; value: string; tone: "good" | "warn"; summary: string; active: boolean; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span>{label}</span><strong className={tone}>{value}</strong><p>{summary}</p><em>{active ? "收起" : "查看推导"} ↗</em></button>; }

function MatrixDetail({ title, formula, matrix, rank, conclusion }: { title: string; formula: string; matrix: number[][]; rank: number; conclusion: string }) { return <><div className="analysis-detail-copy"><span className="section-label">RANK TEST</span><h2>{title}</h2><MathFormula latex={formula} display /><p>{conclusion}</p><strong>rank = {rank}</strong></div><MatrixReadout matrix={matrix} /></>; }

function StabilityDetail({ stability, eigenvalues }: { stability: LinearStability; eigenvalues: Array<{ re: number; im: number }> }) { return <><div className="analysis-detail-copy"><span className="section-label">LINEAR STABILITY</span><h2>{stabilityLabel(stability)}</h2><MathFormula latex="\det(\lambda I-A)=0" display /><p>{stabilityLongSummary(stability)}</p></div><div className="eigenvalue-list">{eigenvalues.map((value, index) => <code key={index}>λ{index + 1} = {complexText(value)}</code>)}</div></>; }

function MatrixReadout({ matrix }: { matrix: number[][] }) { return <div className="studio-matrix-readout">{matrix.map((row, index) => <code key={index}>[{row.map((value) => formatNumber(value, 3).padStart(8, " ")).join("  ")}]</code>)}</div>; }

function stateLabel(index: number) { return `x${index + 1}`; }
function inputLabel(index: number) { return `u${index + 1}`; }
function stateLabels(count: number) { return Array.from({ length: count }, (_, index) => stateLabel(index)); }
function outputLabels(count: number) { return Array.from({ length: count }, (_, index) => `y${index + 1}`); }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum)); }
function viewKicker(view: ViewTab) { return { state: "STATE RESPONSE", output: "OUTPUT RESPONSE", trajectory: "STATE PORTRAIT", eigen: "EIGEN MODES" }[view]; }
function viewTitle(view: ViewTab) { return { state: "全部状态随时间变化", output: "由 Cx + Du 得到的输出", trajectory: "选择两个状态观察轨迹", eigen: "系统模态与稳定性" }[view]; }
function viewNote(view: ViewTab, model: StateSpacePreset, stability: LinearStability) { if (view === "state") return `当前显示 ${model.A.length} 个内部状态；它们不一定都能被传感器直接测量。`; if (view === "output") return `输出维数 p=${model.C.length}，每条曲线都严格由 Cx+Du 计算。`; if (view === "trajectory") return "橙色圆点为初始状态，青色叉号为仿真终点。"; return stabilityLongSummary(stability); }
function stabilityLabel(value: LinearStability) { return { unstable: "不稳定", lyapunov: "李雅普诺夫稳定", asymptotic: "渐近稳定" }[value]; }
function stabilitySummary(value: LinearStability) { return { unstable: "存在右半平面模态或临界模态缺陷", lyapunov: "状态有界，但不保证回到原点", asymptotic: "所有状态最终收敛到原点" }[value]; }
function stabilityLongSummary(value: LinearStability) { return value === "asymptotic" ? "全部特征值位于左半平面，线性自治系统的状态将随时间趋近原点。" : value === "lyapunov" ? "没有右半平面特征值，虚轴上的模态为半单纯，因此状态保持有界，但通常不会衰减到原点。" : "至少存在右半平面特征值，或虚轴模态含有非平凡 Jordan 块，状态会发散或无界增长。"; }
function complexText(value: { re: number; im: number }) { if (Math.abs(value.im) < 1e-7) return formatNumber(value.re, 4); return `${formatNumber(value.re, 4)} ${value.im >= 0 ? "+" : "−"} ${formatNumber(Math.abs(value.im), 4)}j`; }
