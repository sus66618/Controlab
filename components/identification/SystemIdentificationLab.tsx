"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { EvaluationSummary } from "./EvaluationSummary";
import { IdentificationParameters } from "./IdentificationParameters";
import { MethodSelector, methodDescription } from "./MethodSelector";
import { OrderSearchPanel } from "./OrderSearchPanel";
import { parseIdentificationCsvDataset } from "@/lib/identificationData";
import { readIdentificationFile } from "@/lib/identificationFile";
import { fitIdentification } from "@/lib/identification/fit";
import { DEFAULT_IDENTIFICATION_CONFIG } from "@/lib/identification/types";
import { arxPolynomialsLatex, IDENTIFICATION_EXAMPLES, samplesToCsv } from "@/lib/systemIdentification";
import type { ControlModuleId } from "@/lib/moduleCatalog";
import type { IdentificationDataset } from "@/lib/identificationData";
import type { IdentificationConfig, IdentificationResult } from "@/lib/identification/types";
import type { IdentificationSample } from "@/lib/systemIdentification";

type ChartView = "data" | "fit" | "residual" | "autocorrelation";
type EvaluationSegment = "train" | "validation";
type PredictionMode = "oneStep" | "simulation";

const COLORS = ["#f3ac58", "#b18cff", "#6f9dff", "#ff7e72", "#d8c36a", "#8aa4b8"];

export function SystemIdentificationLab({ onHome, onNavigate }: { onHome: () => void; onNavigate: (module: ControlModuleId) => void }) {
  const initialExample = IDENTIFICATION_EXAMPLES[1];
  const initialDataset = samplesDataset(initialExample.samples);
  const initialConfig: IdentificationConfig = { ...DEFAULT_IDENTIFICATION_CONFIG, ...initialExample.suggested };
  const [exampleId, setExampleId] = useState(initialExample.id);
  const [csv, setCsv] = useState(() => samplesToCsv(initialExample.samples));
  const [config, setConfig] = useState(initialConfig);
  const [dataset, setDataset] = useState<IdentificationDataset>(initialDataset);
  const [result, setResult] = useState<IdentificationResult>(() => fitIdentification(initialDataset, initialConfig));
  const [sourceName, setSourceName] = useState("内置示例 · 欠阻尼伺服");
  const [selectedOutput, setSelectedOutput] = useState(0);
  const [error, setError] = useState("");
  const [view, setView] = useState<ChartView>("fit");
  const [segment, setSegment] = useState<EvaluationSegment>("validation");
  const [predictionMode, setPredictionMode] = useState<PredictionMode>("simulation");
  const [readingFile, setReadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [resultDirty, setResultDirty] = useState(false);

  const runIdentification = (nextDataset: IdentificationDataset, nextConfig: IdentificationConfig, name: string) => {
    try {
      const compatible = nextConfig.method === "oe" && (nextDataset.inputNames.length !== 1 || nextDataset.outputNames.length !== 1) ? { ...nextConfig, method: "arx" as const } : nextConfig;
      const nextResult = fitIdentification(nextDataset, compatible);
      setDataset(nextDataset); setConfig(compatible); setResult(nextResult); setSelectedOutput(0);
      setSourceName(name); setCsv(datasetToCsv(nextDataset)); setResultDirty(false); setError(""); setView("fit");
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "辨识失败"); return false; }
  };

  const identify = () => {
    try {
      const nextDataset = parseIdentificationCsvDataset(csv);
      runIdentification(nextDataset, config, exampleId === "custom" ? "自定义实验数据" : sourceName);
    } catch (reason) { setResultDirty(true); setError(reason instanceof Error ? reason.message : "辨识失败"); }
  };

  const loadExample = (id: string) => {
    const example = IDENTIFICATION_EXAMPLES.find((item) => item.id === id) ?? IDENTIFICATION_EXAMPLES[0];
    const nextConfig = { ...config, method: "arx" as const, ...example.suggested };
    if (runIdentification(samplesDataset(example.samples), nextConfig, `内置示例 · ${example.name}`)) setExampleId(example.id);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setReadingFile(true); setError("");
    try { const nextDataset = await readIdentificationFile(file); if (runIdentification(nextDataset, config, file.name)) setExampleId("custom"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "文件读取失败"); }
    finally { setReadingFile(false); setDragActive(false); }
  };

  const channel = result.channels[selectedOutput];
  const currentMetrics = channel[segment][predictionMode];
  const rangeStart = segment === "train" ? 0 : result.splitIndex;
  const rangeEnd = segment === "train" ? result.splitIndex : dataset.time.length;
  const series = useMemo(() => {
    const outputName = dataset.outputNames[selectedOutput];
    const from = rangeStart, to = rangeEnd;
    if (view === "autocorrelation") return [{ name: `${outputName} 残差自相关`, color: "#b7ff4a", points: channel.autocorrelation.map((value, lag) => ({ x: lag, y: value })) }];
    if (view === "data") return [
      ...dataset.inputNames.map((name, input) => ({ name: `输入 ${name}`, color: COLORS[input % COLORS.length], dashed: true, points: dataset.time.slice(from, to).map((time, offset) => ({ x: time, y: dataset.inputs[from + offset][input] })) })),
      { name: `输出 ${outputName}`, color: "#55d6be", points: dataset.time.slice(from, to).map((time, offset) => ({ x: time, y: dataset.outputs[from + offset][selectedOutput] })) },
    ];
    if (view === "residual") return [{ name: `${outputName} 一步预测残差`, color: "#ff7e72", points: dataset.time.slice(from, to).map((time, offset) => ({ x: time, y: result.predictions.residuals[from + offset]?.[selectedOutput] ?? 0 })) }];
    const prediction = result.predictions[predictionMode];
    return [
      { name: `${outputName} 实测`, color: "#55d6be", points: dataset.time.slice(from, to).map((time, offset) => ({ x: time, y: dataset.outputs[from + offset][selectedOutput] })) },
      { name: predictionMode === "oneStep" ? "一步预测" : "自由仿真", color: "#b7ff4a", dashed: true, points: dataset.time.slice(from, to).map((time, offset) => ({ x: time, y: prediction[from + offset]?.[selectedOutput] ?? 0 })) },
    ];
  }, [channel.autocorrelation, dataset, predictionMode, rangeEnd, rangeStart, result, selectedOutput, view]);

  const rawSisoEquations = dataset.inputNames.length === 1 && dataset.outputNames.length === 1 ? arxPolynomialsLatex({ na: result.model.na, nb: result.model.nb, nk: result.model.nk, a: result.model.a[0].map((lag) => lag[0]), b: result.model.b[0].map((lag) => lag[0]) }) : null;
  const inputDelay = result.model.nk === 0 ? "" : `q^{-${result.model.nk}}`;
  const sisoEquations = rawSisoEquations ? {
    a: result.method === "oe" ? rawSisoEquations.a.replace(/^A/, "F") : rawSisoEquations.a,
    b: rawSisoEquations.b,
    c: result.method === "armax" && result.model.c?.[0] ? polynomialLatex("C", [1, ...result.model.c[0]]) : null,
    model: result.method === "oe"
      ? `F(q^{-1})y(k)=${inputDelay}B(q^{-1})u(k)+e(k)`
      : result.method === "armax"
        ? `A(q^{-1})y(k)=${inputDelay}B(q^{-1})u(k)+C(q^{-1})e(k)`
        : rawSisoEquations.model,
  } : null;
  const methodLabel = { arx: "ARX", fir: "FIR", "ridge-arx": "正则化 ARX", armax: "ARMAX", oe: "OE" }[result.method];

  return <main className="controlab-app identification-page">
    <AppHeader title="系统辨识 / System Identification" onHome={onHome} trailing={<ModuleNav current="identification" onNavigate={onNavigate} />} />
    <section className="identification-studio">
      <header className="identification-toolbar"><div><span className="section-label">INPUT / OUTPUT → MODEL</span><h1>从数据辨认系统</h1></div><div className="identification-flow"><span><b>01</b>导入数据</span><i>→</i><span><b>02</b>选择方法</span><i>→</i><span><b>03</b>独立验证</span></div></header>
      <div className="identification-main">
        <aside className="identification-config">
          <section className="identification-step">
            <StepHeading index="01" title="导入实验数据" note="CSV / XLSX；列名自动决定输入输出维度。" />
            <label className={`identification-file-drop ${dragActive ? "active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); void importFile(event.dataTransfer.files[0]); }}><input type="file" accept=".csv,.xlsx" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /><span>CSV / XLSX</span><strong>{readingFile ? "正在读取…" : "点击选择或拖入文件"}</strong><small>time, u1, u2, y1, y2</small></label>
            <div className="identification-source"><span>{sourceName}</span><b>{dataset.inputs.length} 点 · {dataset.inputNames.length} 入 × {dataset.outputNames.length} 出</b></div>
            <div className="identification-examples">{IDENTIFICATION_EXAMPLES.map((example) => <button key={example.id} className={exampleId === example.id ? "active" : ""} onClick={() => loadExample(example.id)}>{example.name}</button>)}</div>
            <details className="csv-details"><summary>查看或粘贴 CSV</summary><label className="csv-editor"><textarea aria-label="辨识 CSV 数据" value={csv} onChange={(event) => { setCsv(event.target.value); setExampleId("custom"); setResultDirty(true); }} spellCheck={false} /></label></details>
          </section>
          <section className="identification-step">
            <StepHeading index="02" title="选择辨识方法" note="只显示当前方法真正使用的参数。" />
            <MethodSelector value={config.method} oeDisabled={dataset.inputNames.length !== 1 || dataset.outputNames.length !== 1} onChange={(method) => { setConfig({ ...config, method, na: method === "fir" ? 0 : Math.max(1, config.na) }); setResultDirty(true); }} />
            <p className="identification-method-note">{methodDescription(config.method, dataset.outputNames.length > 1)}</p>
            <IdentificationParameters config={config} onChange={(next) => { setConfig(next); setResultDirty(true); }} />
            <button className="identify-action" onClick={identify}>开始辨识</button>
            <OrderSearchPanel dataset={dataset} config={config} onApply={(candidate) => { if (candidate.result) { setConfig(candidate.config); setResult(candidate.result); setResultDirty(false); setError(""); } }} />
            {error && <p className="identification-message error">{error}</p>}
          </section>
        </aside>
        <section className="identification-result">
          <div className="identification-result-head"><StepHeading index="03" title="验证模型" note="预测能力与自由运行能力分开看。" /><div className="identification-summary">{resultDirty && <span className="identification-stale">参数已修改<strong>结果未更新</strong></span>}<span>方法<strong>{methodLabel}</strong></span><span>当前拟合度<strong className={currentMetrics.fitPercent >= 70 ? "good" : "warn"}>{currentMetrics.fitPercent.toFixed(1)}%</strong></span></div></div>
          <div className="identification-evaluation-switches"><div className="mini-switch"><button className={segment === "train" ? "active" : ""} onClick={() => setSegment("train")}>训练集</button><button className={segment === "validation" ? "active" : ""} onClick={() => setSegment("validation")}>验证集</button></div><div className="mini-switch"><button className={predictionMode === "oneStep" ? "active" : ""} onClick={() => setPredictionMode("oneStep")}>一步预测</button><button className={predictionMode === "simulation" ? "active" : ""} onClick={() => setPredictionMode("simulation")}>自由仿真</button></div>{dataset.outputNames.length > 1 && <select value={selectedOutput} onChange={(event) => setSelectedOutput(Number(event.target.value))}>{dataset.outputNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>}</div>
          <div className="identification-view-bar"><div className="modern-result-tabs">{([['data', '输入与输出'], ['fit', '测量 vs 模型'], ['residual', '剩余误差'], ['autocorrelation', '残差相关']] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div></div>
          <div className="primary-plot identification-plot"><Plot id={`identification-${view}-${segment}-${predictionMode}`} height={410} legendLimit={8} series={series} xLabel={view === "autocorrelation" ? "滞后阶数" : "时间 t / s"} yLabel={view === "residual" ? "误差 e" : view === "autocorrelation" ? "归一化相关" : "信号幅值"} /></div>
          <EvaluationSummary result={result} metrics={currentMetrics} />
          <p className="identification-truth-note">{result.methodNote}。拟合度不截断；负值表示模型不如输出均值基线。</p>
          <section className="identified-model-card"><header><span>实际计算得到的离散模型</span><small>{result.parameterCount} 个参数 · {dataset.inputNames.length} 入 × {dataset.outputNames.length} 出</small></header>{sisoEquations ? <div className="identified-equations"><MathFormula latex={sisoEquations.a} display /><MathFormula latex={sisoEquations.b} display />{sisoEquations.c && <MathFormula latex={sisoEquations.c} display />}<MathFormula className="identified-model-relation" latex={sisoEquations.model} display /></div> : <div className="mimo-channel-coefficients"><strong>{dataset.outputNames[selectedOutput]} 方程系数</strong>{result.model.a[selectedOutput].map((row, lag) => <code key={`a-${lag}`}>A{lag + 1} [{row.map((value) => value.toPrecision(5)).join(", ")}]</code>)}{result.model.b[selectedOutput].map((row, lag) => <code key={`b-${lag}`}>B{lag} [{row.map((value) => value.toPrecision(5)).join(", ")}]</code>)}</div>}</section>
        </section>
      </div>
    </section>
  </main>;
}

function StepHeading({ index, title, note }: { index: string; title: string; note: string }) { return <header className="identification-step-heading"><span>{index}</span><div><h2>{title}</h2><p>{note}</p></div></header>; }
function polynomialLatex(name: string, coefficients: number[]) { return `${name}(q^{-1})=${coefficients.map((value, index) => `${index > 0 && value >= 0 ? "+" : ""}${Number(value.toPrecision(6))}${index === 0 ? "" : `q^{-${index}}`}`).join("")}`; }
function samplesDataset(samples: IdentificationSample[]): IdentificationDataset { return { time: samples.map((sample) => sample.t), inputs: samples.map((sample) => [sample.u]), outputs: samples.map((sample) => [sample.y]), inputNames: ["u"], outputNames: ["y"] }; }
function datasetToCsv(dataset: IdentificationDataset) { return [["t", ...dataset.inputNames, ...dataset.outputNames].join(","), ...dataset.time.map((time, index) => [time, ...dataset.inputs[index], ...dataset.outputs[index]].join(","))].join("\n"); }
