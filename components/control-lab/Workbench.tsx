"use client";

import { useMemo, useState } from "react";
import { analyzeSystem, formatNumber } from "@/lib/control";
import type { InputSignal } from "@/lib/control";
import { useControlModel } from "@/hooks/useControlModel";
import { downloadCharts } from "./chartExport";
import { ModelEditor } from "./ModelEditor";
import { Plot } from "./Plot";
import { RootEditor } from "./RootEditor";

type AnalysisTab = "response" | "bode" | "root" | "nyquist";

const TABS: Array<{ key: AnalysisTab; label: string; short: string }> = [
  { key: "response", label: "时域响应", short: "TIME" },
  { key: "bode", label: "Bode 图", short: "FREQ" },
  { key: "root", label: "根轨迹", short: "ROOT" },
  { key: "nyquist", label: "奈奎斯特图", short: "NYQ" },
];

const SIGNALS: Array<{ key: InputSignal; label: string }> = [
  { key: "step", label: "阶跃" },
  { key: "ramp", label: "斜坡" },
  { key: "sine", label: "正弦" },
];

export function Workbench() {
  const controller = useControlModel();
  const [tab, setTab] = useState<AnalysisTab>("response");
  const [signal, setSignal] = useState<InputSignal>("step");
  const [duration, setDuration] = useState(12);
  const computed = useMemo(() => {
    try {
      return { value: analyzeSystem(controller.model, signal, duration), error: "" };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : "分析失败" };
    }
  }, [controller.model, duration, signal]);
  const analysis = computed.value;
  const exportIds = tab === "bode" ? ["controlab-bode-magnitude", "controlab-bode-phase"] : `controlab-${tab}`;

  return <main className="controlab-app">
    <header className="app-header">
      <div className="app-brand"><span className="brand-symbol">C</span><div><strong>Controlab</strong><small>CONTROL ANALYSIS</small></div></div>
      <div className="header-center">连续系统工作台 <span>/</span> Transfer Function</div>
      <div className="compute-status"><i />本地计算</div>
    </header>

    <div className="app-body">
      <ModelEditor
        model={controller.model}
        mode={controller.mode}
        setMode={controller.setMode}
        drafts={controller.drafts}
        error={controller.error}
        updateCoefficients={controller.updateCoefficients}
        updateExpression={controller.updateExpression}
        updateZpk={controller.updateZpk}
        loadModel={controller.loadModel}
      />

      <section className="analysis-workspace">
        <div className="workspace-head">
          <div className="analysis-tabs" role="tablist">
            {TABS.map((item) => <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><span>{item.short}</span>{item.label}</button>)}
          </div>
          <div className="export-actions"><button onClick={() => downloadCharts(exportIds, "svg")}>SVG</button><button onClick={() => downloadCharts(exportIds, "png")}>PNG 2×</button></div>
        </div>

        {tab === "root" && <RootEditor zpk={controller.zpk} addRoot={controller.addRoot} removeRoot={controller.removeRoot} />}

        {computed.error && <div className="analysis-error">{computed.error}</div>}
        {analysis && <div className={`plot-stage ${tab === "bode" ? "bode-stage" : ""}`}>
          {tab === "response" && <>
            <div className="plot-controls"><div className="mini-switch">{SIGNALS.map((item) => <button key={item.key} className={signal === item.key ? "active" : ""} onClick={() => setSignal(item.key)}>{item.label}</button>)}</div><label>时长<input type="range" min="4" max="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />{duration}s</label></div>
            <Plot id="controlab-response" series={[
              { name: "输出 y(t)", color: "#b7ff4a", points: analysis.response.map((point) => ({ x: point.t, y: point.output })) },
              { name: "输入 r(t)", color: "#6f7c8a", dashed: true, points: analysis.response.map((point) => ({ x: point.t, y: point.input })) },
            ]} xLabel="时间 t / s" yLabel="幅值" />
          </>}
          {tab === "bode" && <>
            <Plot id="controlab-bode-magnitude" height={275} logX series={[{ name: "幅值", color: "#b7ff4a", points: analysis.frequency.map((point) => ({ x: point.omega, y: point.magnitude })) }]} xLabel="角频率 ω / rad·s⁻¹" yLabel="幅值 / dB" />
            <Plot id="controlab-bode-phase" height={275} logX series={[{ name: "相位", color: "#55d6be", points: analysis.frequency.map((point) => ({ x: point.omega, y: point.phase })) }]} xLabel="角频率 ω / rad·s⁻¹" yLabel="相位 / °" />
          </>}
          {tab === "root" && <Plot id="controlab-root" height={390} square robustFrame series={analysis.locus.map((branch, index) => ({ name: `分支 ${index + 1}`, color: index % 2 ? "#55d6be" : "#b7ff4a", points: branch.map((point) => ({ x: point.re, y: point.im })) }))} markers={[
            ...analysis.summary.poles.map((point) => ({ point: { x: point.re, y: point.im }, color: "#ff6f61", shape: "cross" as const })),
            ...analysis.summary.zeros.map((point) => ({ point: { x: point.re, y: point.im }, color: "#e8edf3", shape: "circle" as const })),
          ]} xLabel="实轴 Re" yLabel="虚轴 Im" />}
          {tab === "nyquist" && <Plot id="controlab-nyquist" square series={[{ name: "G(jω)", color: "#b7ff4a", points: analysis.nyquist.map((point) => ({ x: point.re, y: point.im })) }]} markers={[{ point: { x: -1, y: 0 }, color: "#ff6f61", shape: "cross" }]} xLabel="实部 Re" yLabel="虚部 Im" />}
        </div>}

        {analysis && <div className="analysis-footer">
          <div className="metrics">
            <Metric label="开环稳定性" value={analysis.summary.stable ? "稳定" : analysis.summary.marginal ? "临界" : "不稳定"} tone={analysis.summary.stable ? "good" : "warn"} />
            <Metric label="相位裕度" value={analysis.margins.phaseMargin === null ? "—" : `${formatNumber(analysis.margins.phaseMargin, 2)}°`} />
            <Metric label="增益裕度" value={analysis.margins.gainMargin === null ? "∞ / —" : `${formatNumber(analysis.margins.gainMargin, 2)} dB`} />
            <Metric label="阶次" value={String(controller.model.denominator.length - 1)} />
          </div>
          <div className="compact-insight"><span>当前读图</span><p>{insightFor(tab, analysis.summary.stable, analysis.summary.poles.length, analysis.margins.phaseMargin)}</p></div>
        </div>}
      </section>
    </div>
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return <div><span>{label}</span><strong className={tone ?? ""}>{value}</strong></div>;
}

function insightFor(tab: AnalysisTab, stable: boolean, poleCount: number, phaseMargin: number | null) {
  if (tab === "response") return `${poleCount} 个开环极点；当前系统${stable ? "渐近稳定" : "不能渐近收敛"}。`;
  if (tab === "bode") return phaseMargin === null ? "当前频段内没有 0 dB 穿越。" : `相位裕度约 ${formatNumber(phaseMargin, 2)}°。`;
  if (tab === "root") return "× 为开环极点，○ 为开环零点；编辑后全部分析同步更新。";
  return "红色 × 标记 −1 点；悬停曲线可读取复平面坐标。";
}
