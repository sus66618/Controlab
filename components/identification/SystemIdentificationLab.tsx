"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import { fitArx, IDENTIFICATION_EXAMPLES, parseIdentificationCsv, samplesToCsv } from "@/lib/systemIdentification";
import type { ArxOrders, ArxResult, IdentificationSample } from "@/lib/systemIdentification";

type IdentificationView = "data" | "fit" | "residual";

export function SystemIdentificationLab({ onHome, onAnalysis, onModern }: { onHome: () => void; onAnalysis: () => void; onModern: () => void }) {
  const initialExample = IDENTIFICATION_EXAMPLES[1];
  const [exampleId, setExampleId] = useState(initialExample.id);
  const [csv, setCsv] = useState(() => samplesToCsv(initialExample.samples));
  const [orders, setOrders] = useState<ArxOrders>(initialExample.suggested);
  const [result, setResult] = useState<ArxResult>(() => fitArx(initialExample.samples, initialExample.suggested));
  const [samples, setSamples] = useState<IdentificationSample[]>(initialExample.samples);
  const [error, setError] = useState("");
  const [view, setView] = useState<IdentificationView>("fit");

  const identify = () => {
    try {
      const parsed = parseIdentificationCsv(csv);
      setSamples(parsed);
      setResult(fitArx(parsed, orders));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "辨识失败");
    }
  };

  const loadExample = (id: string) => {
    const example = IDENTIFICATION_EXAMPLES.find((item) => item.id === id) ?? IDENTIFICATION_EXAMPLES[0];
    setExampleId(example.id);
    setCsv(samplesToCsv(example.samples));
    setOrders(example.suggested);
    setSamples(example.samples);
    setResult(fitArx(example.samples, example.suggested));
    setError("");
  };

  const series = useMemo(() => {
    if (view === "data") return [
      { name: "输入 u", color: "#f3ac58", points: samples.map((sample) => ({ x: sample.t, y: sample.u })) },
      { name: "测量 y", color: "#55d6be", points: samples.map((sample) => ({ x: sample.t, y: sample.y })) },
    ];
    if (view === "residual") return [{ name: "残差 e", color: "#ff7e72", points: samples.map((sample, index) => ({ x: sample.t, y: result.residuals[index] ?? 0 })) }];
    return [
      { name: "测量输出", color: "#55d6be", points: samples.map((sample) => ({ x: sample.t, y: sample.y })) },
      { name: "ARX 自由仿真", color: "#b7ff4a", dashed: true, points: samples.map((sample, index) => ({ x: sample.t, y: result.estimated[index] ?? 0 })) },
    ];
  }, [result, samples, view]);

  return <main className="controlab-app identification-page">
    <AppHeader title="系统辨识 / System Identification" onHome={onHome} trailing={<><button className="simulation-shortcut" onClick={onAnalysis}>系统分析</button><button className="simulation-shortcut" onClick={onModern}>现代控制</button></>} />
    <section className="identification-studio">
      <header className="identification-toolbar"><div><span className="section-label">DATA → MODEL → VALIDATION</span><h1>ARX 系统辨识</h1></div><div className="identification-summary"><span>采样点<strong>{samples.length}</strong></span><span>模型阶次<strong>{orders.na} / {orders.nb} / {orders.nk}</strong></span><span>拟合度<strong className={result.fitPercent >= 70 ? "good" : "warn"}>{formatNumber(result.fitPercent, 1)}%</strong></span></div></header>

      <div className="identification-main">
        <aside className="identification-config">
          <section><div className="config-heading"><span>数据集</span><small>t, u, y</small></div><div className="identification-examples">{IDENTIFICATION_EXAMPLES.map((example) => <button key={example.id} className={exampleId === example.id ? "active" : ""} onClick={() => loadExample(example.id)}>{example.name}</button>)}</div></section>
          <label className="csv-editor"><span>CSV 数据</span><textarea aria-label="辨识 CSV 数据" value={csv} onChange={(event) => { setCsv(event.target.value); setExampleId("custom"); }} spellCheck={false} /></label>
          <section><div className="config-heading"><span>模型结构</span><MathFormula latex="A(q^{-1})y=B(q^{-1})u+e" /></div><div className="order-controls"><OrderSelect label="na" value={orders.na} minimum={1} onChange={(value) => setOrders((current) => ({ ...current, na: value }))} /><OrderSelect label="nb" value={orders.nb} minimum={1} onChange={(value) => setOrders((current) => ({ ...current, nb: value }))} /><OrderSelect label="nk" value={orders.nk} minimum={0} onChange={(value) => setOrders((current) => ({ ...current, nk: value }))} /></div></section>
          <button className="identify-action" onClick={identify}>开始辨识</button>
          <p className={`identification-message ${error ? "error" : ""}`}>{error || "使用自由仿真验证模型，不用测量输出替它作弊。"}</p>
        </aside>

        <section className="identification-result">
          <div className="modern-result-tabs">{([["data", "原始数据"], ["fit", "拟合验证"], ["residual", "残差"]] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>
          <div className="modern-result-head"><div><span className="section-label">{view === "fit" ? "MODEL VALIDATION" : view === "data" ? "EXPERIMENT DATA" : "RESIDUAL ANALYSIS"}</span><h2>{view === "fit" ? "测量输出与模型输出" : view === "data" ? "输入和输出记录" : "模型没有解释的部分"}</h2></div></div>
          <div className="primary-plot identification-plot"><Plot id={`identification-${view}`} height={500} legendLimit={3} series={series} xLabel="时间 t / s" yLabel={view === "data" ? "信号" : view === "fit" ? "输出 y" : "残差 e"} /></div>
        </section>
      </div>

      <section className="identification-result-rail">
        <ResultMetric label="拟合度" value={`${formatNumber(result.fitPercent, 2)}%`} tone={result.fitPercent >= 70 ? "good" : "warn"} />
        <ResultMetric label="RMSE" value={formatNumber(result.rmse, 5)} />
        <ResultMetric label="样本数" value={String(samples.length)} />
        <div className="identified-equation"><span>辨识模型</span><MathFormula latex={arxLatex(result)} display /></div>
      </section>
      <details className="identification-coefficients"><summary>查看参数向量</summary><div><code>a = [{result.a.map((value) => formatNumber(value, 5)).join(", ")}]</code><code>b = [{result.b.map((value) => formatNumber(value, 5)).join(", ")}]</code></div></details>
    </section>
  </main>;
}

function OrderSelect({ label, value, minimum, onChange }: { label: string; value: number; minimum: number; onChange: (value: number) => void }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))}>{Array.from({ length: 5 - minimum }, (_, index) => index + minimum).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>; }
function ResultMetric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) { return <div><span>{label}</span><strong className={tone}>{value}</strong></div>; }
function arxLatex(result: ArxResult) { const left = ["y(k)", ...result.a.map((value, index) => `${signed(value)}y(k-${index + 1})`)].join(" "); const right = result.b.map((value, index) => `${index ? signed(value) : formatNumber(value, 4)}u(k-${result.nk + index})`).join(" "); return `${left}=${right}`; }
function signed(value: number) { return `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value), 4)}`; }
