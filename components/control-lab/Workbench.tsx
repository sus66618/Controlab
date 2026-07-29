"use client";

import { useMemo, useState } from "react";
import {
  analyzeSystem,
  controllerTransfer,
  DEFAULT_CONTROLLER,
  feedbackModels,
  formatNumber,
  responseMetrics,
} from "@/lib/control";
import type { ControllerConfig, InputSignal } from "@/lib/control";
import type { ControlModelController } from "@/hooks/useControlModel";
import { AppHeader } from "./AppHeader";
import { ControllerPanel } from "./ControllerPanel";
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

export function Workbench({ controller, initialClosedLoop, onHome, onSimulation }: {
  controller: ControlModelController;
  initialClosedLoop: boolean;
  onHome: () => void;
  onSimulation: () => void;
}) {
  const [tab, setTab] = useState<AnalysisTab>("response");
  const [signal, setSignal] = useState<InputSignal>("step");
  const [duration, setDuration] = useState(12);
  const [closedLoop, setClosedLoop] = useState(initialClosedLoop);
  const [controllerConfig, setControllerConfig] = useState<ControllerConfig>(DEFAULT_CONTROLLER);

  const computed = useMemo(() => {
    try {
      const controlModel = controllerTransfer(controllerConfig);
      const feedback = feedbackModels(controller.model, controlModel);
      const plantAnalysis = analyzeSystem(controller.model, signal, duration);
      const closedAnalysis = analyzeSystem(feedback.closed, signal, duration);
      const loopAnalysis = analyzeSystem(feedback.loop, signal, duration);
      return { plantAnalysis, closedAnalysis, loopAnalysis, feedback, error: "" };
    } catch (reason) {
      return { plantAnalysis: null, closedAnalysis: null, loopAnalysis: null, feedback: null, error: reason instanceof Error ? reason.message : "分析失败" };
    }
  }, [controller.model, controllerConfig, duration, signal]);

  const activeAnalysis = closedLoop ? computed.closedAnalysis : computed.plantAnalysis;
  const stabilityAnalysis = closedLoop ? computed.closedAnalysis : computed.plantAnalysis;
  const loopAnalysis = closedLoop ? computed.loopAnalysis : computed.plantAnalysis;
  const metrics = activeAnalysis ? responseMetrics(activeAnalysis.response) : null;
  const showStepMetrics = closedLoop && signal === "step";
  const exportIds = tab === "bode" ? ["controlab-bode-magnitude", "controlab-bode-phase"] : `controlab-${tab}`;

  return <main className="controlab-app">
    <AppHeader title={closedLoop ? "闭环控制工作台 / Feedback Control" : "系统分析工作台 / Plant Analysis"} onHome={onHome} trailing={<>
      <button className="simulation-shortcut" onClick={onSimulation}>倒立摆实验</button>
      <label className={`feedback-toggle ${closedLoop ? "on" : ""}`}><span>闭环控制</span><input type="checkbox" checked={closedLoop} onChange={(event) => setClosedLoop(event.target.checked)} /><i /></label>
    </>} />

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

        {closedLoop && <ControllerPanel config={controllerConfig} onChange={setControllerConfig} />}
        {tab === "root" && <RootEditor zpk={controller.zpk} addRoot={controller.addRoot} removeRoot={controller.removeRoot} />}
        {computed.error && <div className="analysis-error">{computed.error}</div>}

        {activeAnalysis && loopAnalysis && <div className={`plot-stage ${tab === "bode" ? "bode-stage" : ""}`}>
          {tab === "response" && <>
            <div className="plot-controls"><div className="mini-switch">{SIGNALS.map((item) => <button key={item.key} className={signal === item.key ? "active" : ""} onClick={() => setSignal(item.key)}>{item.label}</button>)}</div><label>时长<input type="range" min="4" max="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />{duration}s</label></div>
            <Plot id="controlab-response" series={[
              { name: closedLoop ? "闭环输出 y(t)" : "输出 y(t)", color: "#b7ff4a", points: activeAnalysis.response.map((point) => ({ x: point.t, y: point.output })) },
              ...(closedLoop && computed.plantAnalysis ? [{ name: "未校正对象", color: "#55d6be", dashed: true, points: computed.plantAnalysis.response.map((point) => ({ x: point.t, y: point.output })) }] : []),
              { name: "参考 r(t)", color: "#6f7c8a", dashed: true, points: activeAnalysis.response.map((point) => ({ x: point.t, y: point.input })) },
            ]} xLabel="时间 t / s" yLabel="幅值" />
          </>}
          {tab === "bode" && <>
            <Plot id="controlab-bode-magnitude" height={275} logX series={[
              { name: closedLoop ? "闭环 T(s)" : "对象 G(s)", color: "#b7ff4a", points: activeAnalysis.frequency.map((point) => ({ x: point.omega, y: point.magnitude })) },
              ...(closedLoop ? [{ name: "环路 L(s)", color: "#55d6be", dashed: true, points: loopAnalysis.frequency.map((point) => ({ x: point.omega, y: point.magnitude })) }] : []),
            ]} xLabel="角频率 ω / rad·s⁻¹" yLabel="幅值 / dB" />
            <Plot id="controlab-bode-phase" height={275} logX series={[
              { name: closedLoop ? "闭环 T(s)" : "对象 G(s)", color: "#b7ff4a", points: activeAnalysis.frequency.map((point) => ({ x: point.omega, y: point.phase })) },
              ...(closedLoop ? [{ name: "环路 L(s)", color: "#55d6be", dashed: true, points: loopAnalysis.frequency.map((point) => ({ x: point.omega, y: point.phase })) }] : []),
            ]} xLabel="角频率 ω / rad·s⁻¹" yLabel="相位 / °" />
          </>}
          {tab === "root" && <Plot id="controlab-root" height={390} square robustFrame series={loopAnalysis.locus.map((branch, index) => ({ name: `分支 ${index + 1}`, color: index % 2 ? "#55d6be" : "#b7ff4a", points: branch.map((point) => ({ x: point.re, y: point.im })) }))} markers={[
            ...loopAnalysis.summary.poles.map((point) => ({ point: { x: point.re, y: point.im }, color: "#ff6f61", shape: "cross" as const })),
            ...loopAnalysis.summary.zeros.map((point) => ({ point: { x: point.re, y: point.im }, color: "#e8edf3", shape: "circle" as const })),
          ]} xLabel="实轴 Re" yLabel="虚轴 Im" />}
          {tab === "nyquist" && <Plot id="controlab-nyquist" square series={[{ name: closedLoop ? "L(jω)" : "G(jω)", color: "#b7ff4a", points: loopAnalysis.nyquist.map((point) => ({ x: point.re, y: point.im })) }]} markers={[{ point: { x: -1, y: 0 }, color: "#ff6f61", shape: "cross" }]} xLabel="实部 Re" yLabel="虚部 Im" />}
        </div>}

        {activeAnalysis && stabilityAnalysis && loopAnalysis && <div className="analysis-footer">
          <div className="metrics">
            <Metric label={closedLoop ? "闭环稳定性" : "开环稳定性"} value={stabilityAnalysis.summary.stable ? "稳定" : stabilityAnalysis.summary.marginal ? "临界" : "不稳定"} tone={stabilityAnalysis.summary.stable ? "good" : "warn"} />
            <Metric label={showStepMetrics ? "超调量" : "相位裕度"} value={showStepMetrics ? valueOrDash(metrics?.overshoot, "%") : valueOrDash(loopAnalysis.margins.phaseMargin, "°")} />
            <Metric label={showStepMetrics ? "调节时间" : "增益裕度"} value={showStepMetrics ? valueOrDash(metrics?.settlingTime, " s") : loopAnalysis.margins.gainMargin === null ? "∞ / —" : `${formatNumber(loopAnalysis.margins.gainMargin, 2)} dB`} />
            <Metric label={showStepMetrics ? "稳态误差" : "阶次"} value={showStepMetrics ? valueOrDash(metrics?.steadyError, "") : String((closedLoop && computed.feedback ? computed.feedback.closed : controller.model).denominator.length - 1)} />
          </div>
          <div className="compact-insight"><span>知识提示</span><p>{insightFor(tab, closedLoop, stabilityAnalysis.summary.stable, loopAnalysis.margins.phaseMargin)}</p></div>
        </div>}
      </section>
    </div>
  </main>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return <div><span>{label}</span><strong className={tone ?? ""}>{value}</strong></div>;
}

function valueOrDash(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "—" : `${formatNumber(value, 2)}${unit}`;
}

function insightFor(tab: AnalysisTab, closed: boolean, stable: boolean, phaseMargin: number | null) {
  if (tab === "response") return closed
    ? `控制器已接入反馈；当前闭环${stable ? "能够收敛，可继续比较速度与超调" : "不稳定，应先降低增益或重新配置极点"}。`
    : "当前只观察对象本身；开启闭环后可让控制器根据误差持续修正输出。";
  if (tab === "bode") return closed
    ? `实线为闭环 T(s)，虚线为环路 L(s)；稳定裕度应从 L(s) 判断。${phaseMargin === null ? "当前没有检测到 0 dB 穿越。" : `当前相位裕度约 ${formatNumber(phaseMargin, 2)}°。`}`
    : "Bode 图同时描述不同频率下的增益和相位，是设计校正器的主要入口。";
  if (tab === "root") return closed ? "当前根轨迹基于 C(s)G(s)H(s)；调整控制器会改变轨迹，而植物零极点仍可直接编辑。" : "× 为开环极点，○ 为开环零点；轨迹展示闭环极点随增益变化的位置。";
  return closed ? "奈氏图分析环路 L(jω) 对 −1 点的围绕关系，而不是直接绘制闭环 T(s)。" : "红色 × 标记 −1 点；悬停曲线可读取复平面坐标。";
}
