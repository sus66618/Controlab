"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import { parseIdentificationCsvDataset } from "@/lib/identificationData";
import { readIdentificationFile } from "@/lib/identificationFile";
import { arxPolynomialsLatex, fitVarx, IDENTIFICATION_EXAMPLES, samplesToCsv } from "@/lib/systemIdentification";
import type { ControlModuleId } from "@/lib/moduleCatalog";
import type { IdentificationDataset } from "@/lib/identificationData";
import type { ArxOrders, IdentificationSample, VarxResult } from "@/lib/systemIdentification";

type IdentificationView = "data" | "fit" | "residual";

const COLORS = ["#f3ac58", "#b18cff", "#6f9dff", "#ff7e72", "#d8c36a", "#8aa4b8"];

export function SystemIdentificationLab({ onHome, onNavigate }: {
  onHome: () => void;
  onNavigate: (module: ControlModuleId) => void;
}) {
  const initialExample = IDENTIFICATION_EXAMPLES[1];
  const initialDataset = samplesDataset(initialExample.samples);
  const [exampleId, setExampleId] = useState(initialExample.id);
  const [csv, setCsv] = useState(() => samplesToCsv(initialExample.samples));
  const [orders, setOrders] = useState<ArxOrders>(initialExample.suggested);
  const [dataset, setDataset] = useState<IdentificationDataset>(initialDataset);
  const [result, setResult] = useState<VarxResult>(() => fitVarx(initialDataset, initialExample.suggested));
  const [sourceName, setSourceName] = useState("内置示例 · 欠阻尼伺服");
  const [selectedOutput, setSelectedOutput] = useState(0);
  const [error, setError] = useState("");
  const [view, setView] = useState<IdentificationView>("fit");
  const [readingFile, setReadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [resultDirty, setResultDirty] = useState(false);

  const applyDataset = (nextDataset: IdentificationDataset, nextOrders: ArxOrders, name: string) => {
    try {
      const nextResult = fitVarx(nextDataset, nextOrders);
      setDataset(nextDataset);
      setOrders(nextOrders);
      setResult(nextResult);
      setSelectedOutput(0);
      setSourceName(name);
      setCsv(datasetToCsv(nextDataset));
      setResultDirty(false);
      setError("");
      setView("fit");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "辨识失败");
      return false;
    }
  };

  const identify = () => {
    try {
      const nextDataset = parseIdentificationCsvDataset(csv);
      const nextResult = fitVarx(nextDataset, orders);
      setDataset(nextDataset);
      setResult(nextResult);
      setSelectedOutput(0);
      setSourceName(exampleId === "custom" ? "粘贴的 CSV 数据" : sourceName);
      setResultDirty(false);
      setError("");
      setView("fit");
    } catch (reason) {
      setResultDirty(true);
      setError(reason instanceof Error ? reason.message : "辨识失败");
    }
  };

  const loadExample = (id: string) => {
    const example = IDENTIFICATION_EXAMPLES.find((item) => item.id === id) ?? IDENTIFICATION_EXAMPLES[0];
    if (applyDataset(samplesDataset(example.samples), example.suggested, `内置示例 · ${example.name}`)) setExampleId(example.id);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setReadingFile(true);
    setError("");
    try {
      const nextDataset = await readIdentificationFile(file);
      if (applyDataset(nextDataset, safeOrders(nextDataset, orders), file.name)) setExampleId("custom");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "文件读取失败");
    } finally {
      setReadingFile(false);
      setDragActive(false);
    }
  };

  const channel = result.channels[selectedOutput];
  const series = useMemo(() => {
    const outputName = dataset.outputNames[selectedOutput];
    if (view === "data") return [
      ...dataset.inputNames.map((name, input) => ({ name: `输入 ${name}`, color: COLORS[input % COLORS.length], dashed: true, points: dataset.time.map((time, index) => ({ x: time, y: dataset.inputs[index][input] })) })),
      { name: `输出 ${outputName}`, color: "#55d6be", points: dataset.time.map((time, index) => ({ x: time, y: dataset.outputs[index][selectedOutput] })) },
    ];
    if (view === "residual") return [{ name: `${outputName} 未解释误差`, color: "#ff7e72", points: dataset.time.map((time, index) => ({ x: time, y: result.residuals[index]?.[selectedOutput] ?? 0 })) }];
    return [
      { name: `${outputName} 真实测量`, color: "#55d6be", points: dataset.time.map((time, index) => ({ x: time, y: dataset.outputs[index][selectedOutput] })) },
      { name: `${outputName} 模型预测`, color: "#b7ff4a", dashed: true, points: dataset.time.map((time, index) => ({ x: time, y: result.estimated[index]?.[selectedOutput] ?? 0 })) },
    ];
  }, [dataset, result, selectedOutput, view]);

  const sisoEquations = dataset.inputNames.length === 1 && dataset.outputNames.length === 1
    ? arxPolynomialsLatex({ na: result.na, nb: result.nb, nk: result.nk, a: result.a[0].map((lag) => lag[0]), b: result.b[0].map((lag) => lag[0]) })
    : null;
  const initializationSamples = Math.max(result.na, result.nk + result.nb - 1);

  return <main className="controlab-app identification-page">
    <AppHeader title="系统辨识 / System Identification" onHome={onHome} trailing={<ModuleNav current="identification" onNavigate={onNavigate} />} />
    <section className="identification-studio">
      <header className="identification-toolbar">
        <div><span className="section-label">INPUT / OUTPUT → MODEL</span><h1>从数据辨认系统</h1></div>
        <div className="identification-flow" aria-label="系统辨识流程"><span><b>01</b>导入数据</span><i>→</i><span><b>02</b>选择结构</span><i>→</i><span><b>03</b>验证模型</span></div>
      </header>

      <div className="identification-main">
        <aside className="identification-config">
          <section className="identification-step">
            <StepHeading index="01" title="导入实验数据" note="CSV 或 XLSX；列名决定输入与输出维度。" />
            <label className={`identification-file-drop ${dragActive ? "active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); void importFile(event.dataTransfer.files[0]); }}>
              <input type="file" accept=".csv,.xlsx" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
              <span>CSV / XLSX</span><strong>{readingFile ? "正在读取…" : "点击选择或拖入文件"}</strong><small>表头示例：time, u1, u2, y1, y2</small>
            </label>
            <div className="identification-source"><span>{sourceName}</span><b>{dataset.inputs.length} 点 · {dataset.inputNames.length} 入 × {dataset.outputNames.length} 出</b></div>
            <div className="identification-examples">{IDENTIFICATION_EXAMPLES.map((example) => <button key={example.id} className={exampleId === example.id ? "active" : ""} onClick={() => loadExample(example.id)}>{example.name}</button>)}</div>
            <div className="identification-signal-key"><span><b>t</b>采样时刻</span><span><b>u</b>{dataset.inputNames.length} 个输入</span><span><b>y</b>{dataset.outputNames.length} 个输出</span></div>
            <details className="csv-details"><summary>查看或粘贴 CSV 数据</summary><label className="csv-editor"><textarea aria-label="辨识 CSV 数据" value={csv} onChange={(event) => { setCsv(event.target.value); setExampleId("custom"); setResultDirty(true); }} spellCheck={false} /></label></details>
          </section>

          <section className="identification-step">
            <StepHeading index="02" title="选择模型结构" note="统一阶次作用于所有通道；维度由数据自动决定。" />
            <MathFormula className="identification-structure-formula" latex="\mathbf{A}(q^{-1})\mathbf{y}(k)=q^{-n_k}\mathbf{B}(q^{-1})\mathbf{u}(k)+\mathbf{e}(k)" display />
            <div className="order-controls">
              <OrderSelect label="na" description="输出记忆" value={orders.na} minimum={1} onChange={(value) => { setOrders((current) => ({ ...current, na: value })); setResultDirty(true); }} />
              <OrderSelect label="nb" description="输入记忆" value={orders.nb} minimum={1} onChange={(value) => { setOrders((current) => ({ ...current, nb: value })); setResultDirty(true); }} />
              <OrderSelect label="nk" description="纯延迟" value={orders.nk} minimum={0} onChange={(value) => { setOrders((current) => ({ ...current, nk: value })); setResultDirty(true); }} />
            </div>
            <button className="identify-action" onClick={identify}>用当前数据重新辨识</button>
            {error && <p className="identification-message error">{error}</p>}
          </section>
        </aside>

        <section className="identification-result">
          <div className="identification-result-head"><StepHeading index="03" title="验证模型" note={viewNote(view)} /><div className="identification-summary">{resultDirty && <span className="identification-stale">草稿已修改<strong>结果未更新</strong></span>}<span>模型维度<strong>{dataset.inputNames.length} × {dataset.outputNames.length}</strong></span><span>当前拟合度<strong className={channel.fitPercent >= 70 ? "good" : "warn"}>{formatNumber(channel.fitPercent, 1)}%</strong></span></div></div>
          <div className="identification-view-bar"><div className="modern-result-tabs">{([['data', '输入与输出'], ['fit', '测量 vs 预测'], ['residual', '剩余误差']] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>{dataset.outputNames.length > 1 && <label>查看输出<select value={selectedOutput} onChange={(event) => setSelectedOutput(Number(event.target.value))}>{dataset.outputNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>}</div>
          <div className="primary-plot identification-plot"><Plot id={`identification-${view}`} height={410} legendLimit={8} series={series} xLabel="时间 t / s" yLabel={view === "data" ? "信号幅值" : view === "fit" ? `输出 ${dataset.outputNames[selectedOutput]}` : "误差 e"} /></div>
          <p className="identification-init-note">前 {initializationSamples} 个采样点用于递推初始化，不计入拟合度。</p>

          <div className="identification-verdict"><span className={channel.fitPercent >= 70 ? "good" : "warn"}>{formatNumber(channel.fitPercent, 1)}%</span><div><strong>{fitVerdict(channel.fitPercent)}</strong><p>当前通道 RMSE = {formatNumber(channel.rmse, 5)}。切换输出可逐一检查多变量模型。</p></div></div>

          <section className="identified-model-card">
            <header><span>辨识得到的离散模型</span><small>A {dataset.outputNames.length}×{dataset.outputNames.length} · B {dataset.outputNames.length}×{dataset.inputNames.length}</small></header>
            {sisoEquations ? <div className="identified-equations"><MathFormula latex={sisoEquations.a} display /><MathFormula latex={sisoEquations.b} display /><MathFormula className="identified-model-relation" latex={sisoEquations.model} display /></div> : <>
              <MathFormula className="identified-mimo-relation" latex="\mathbf{A}(q^{-1})\mathbf{y}(k)=q^{-n_k}\mathbf{B}(q^{-1})\mathbf{u}(k)+\mathbf{e}(k)" display />
              <div className="mimo-channel-coefficients"><strong>{dataset.outputNames[selectedOutput]} 方程的系数</strong>{result.a[selectedOutput].map((row, lag) => <code key={`a-${lag}`}>A{lag + 1} [{row.map((value) => formatNumber(value, 5)).join(", ")}] ← {dataset.outputNames.join(", ")}</code>)}{result.b[selectedOutput].map((row, lag) => <code key={`b-${lag}`}>B{lag} [{row.map((value) => formatNumber(value, 5)).join(", ")}] ← {dataset.inputNames.join(", ")}</code>)}</div>
            </>}
          </section>
        </section>
      </div>
    </section>
  </main>;
}

function StepHeading({ index, title, note }: { index: string; title: string; note: string }) {
  return <header className="identification-step-heading"><span>{index}</span><div><h2>{title}</h2><p>{note}</p></div></header>;
}

function OrderSelect({ label, description, value, minimum, onChange }: { label: string; description: string; value: number; minimum: number; onChange: (value: number) => void }) {
  return <label><span><b>{label}</b>{description}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: 5 - minimum }, (_, index) => index + minimum).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function samplesDataset(samples: IdentificationSample[]): IdentificationDataset {
  return { time: samples.map((sample) => sample.t), inputs: samples.map((sample) => [sample.u]), outputs: samples.map((sample) => [sample.y]), inputNames: ["u"], outputNames: ["y"] };
}

function datasetToCsv(dataset: IdentificationDataset) {
  return [["t", ...dataset.inputNames, ...dataset.outputNames].join(","), ...dataset.time.map((time, index) => [time, ...dataset.inputs[index], ...dataset.outputs[index]].join(","))].join("\n");
}

function safeOrders(dataset: IdentificationDataset, preferred: ArxOrders) {
  const fits = (orders: ArxOrders) => {
    const start = Math.max(orders.na, orders.nk + orders.nb - 1);
    return dataset.time.length - start >= orders.na * dataset.outputNames.length + orders.nb * dataset.inputNames.length + 1;
  };
  return fits(preferred) ? preferred : { na: 1, nb: 1, nk: 1 };
}

function viewNote(view: IdentificationView) {
  if (view === "data") return "先确认每个输入都充分激励系统，再查看目标输出。";
  if (view === "residual") return "理想残差应围绕零散开，不应保留明显趋势或振荡。";
  return "预测线越贴近测量线，模型越能复现当前输出通道。";
}

function fitVerdict(fit: number) {
  if (fit >= 90) return "当前模型能很好地复现这个输出";
  if (fit >= 70) return "模型已经抓住当前输出的主要动态";
  return "当前结构还没有充分解释这个输出";
}
