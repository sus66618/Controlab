"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/control-lab/AppHeader";
import { ModuleNav } from "@/components/control-lab/ModuleNav";
import { Plot } from "@/components/control-lab/Plot";
import { MathFormula } from "@/components/math/MathFormula";
import { formatNumber } from "@/lib/control";
import { arxPolynomialsLatex, fitArx, IDENTIFICATION_EXAMPLES, parseIdentificationCsv, samplesToCsv } from "@/lib/systemIdentification";
import type { ControlModuleId } from "@/lib/moduleCatalog";
import type { ArxOrders, ArxResult, IdentificationSample } from "@/lib/systemIdentification";

type IdentificationView = "data" | "fit" | "residual";

export function SystemIdentificationLab({ onHome, onNavigate }: {
  onHome: () => void;
  onNavigate: (module: ControlModuleId) => void;
}) {
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
      setView("fit");
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
    setView("fit");
  };

  const series = useMemo(() => {
    if (view === "data") return [
      { name: "施加的输入 u", color: "#f3ac58", points: samples.map((sample) => ({ x: sample.t, y: sample.u })) },
      { name: "测得的输出 y", color: "#55d6be", points: samples.map((sample) => ({ x: sample.t, y: sample.y })) },
    ];
    if (view === "residual") return [{ name: "未解释误差 e", color: "#ff7e72", points: samples.map((sample, index) => ({ x: sample.t, y: result.residuals[index] ?? 0 })) }];
    return [
      { name: "真实测量", color: "#55d6be", points: samples.map((sample) => ({ x: sample.t, y: sample.y })) },
      { name: "模型预测", color: "#b7ff4a", dashed: true, points: samples.map((sample, index) => ({ x: sample.t, y: result.estimated[index] ?? 0 })) },
    ];
  }, [result, samples, view]);

  const equations = arxPolynomialsLatex(result);

  return <main className="controlab-app identification-page">
    <AppHeader title="系统辨识 / System Identification" onHome={onHome} trailing={<ModuleNav current="identification" onNavigate={onNavigate} />} />
    <section className="identification-studio">
      <header className="identification-toolbar">
        <div><span className="section-label">INPUT / OUTPUT → MODEL</span><h1>从数据辨认系统</h1></div>
        <div className="identification-flow" aria-label="系统辨识流程"><span><b>01</b>准备数据</span><i>→</i><span><b>02</b>选择结构</span><i>→</i><span><b>03</b>验证模型</span></div>
      </header>

      <div className="identification-main">
        <aside className="identification-config">
          <section className="identification-step">
            <StepHeading index="01" title="准备实验数据" note="给系统输入 u，记录随时间变化的输出 y。" />
            <div className="identification-examples">{IDENTIFICATION_EXAMPLES.map((example) => <button key={example.id} className={exampleId === example.id ? "active" : ""} onClick={() => loadExample(example.id)}>{example.name}</button>)}</div>
            <div className="identification-signal-key"><span><b>t</b>采样时刻</span><span><b>u</b>系统输入</span><span><b>y</b>测量输出</span></div>
            <details className="csv-details"><summary>查看或粘贴 CSV 数据</summary><label className="csv-editor"><textarea aria-label="辨识 CSV 数据" value={csv} onChange={(event) => { setCsv(event.target.value); setExampleId("custom"); }} spellCheck={false} /></label></details>
          </section>

          <section className="identification-step">
            <StepHeading index="02" title="选择模型结构" note="阶次越高越灵活，也越可能把噪声当成规律。" />
            <MathFormula className="identification-structure-formula" latex="A(q^{-1})y(k)=q^{-n_k}B(q^{-1})u(k)+e(k)" display />
            <div className="order-controls">
              <OrderSelect label="na" description="输出记忆" value={orders.na} minimum={1} onChange={(value) => setOrders((current) => ({ ...current, na: value }))} />
              <OrderSelect label="nb" description="输入记忆" value={orders.nb} minimum={1} onChange={(value) => setOrders((current) => ({ ...current, nb: value }))} />
              <OrderSelect label="nk" description="纯延迟" value={orders.nk} minimum={0} onChange={(value) => setOrders((current) => ({ ...current, nk: value }))} />
            </div>
            <button className="identify-action" onClick={identify}>用当前数据重新辨识</button>
            {error && <p className="identification-message error">{error}</p>}
          </section>
        </aside>

        <section className="identification-result">
          <div className="identification-result-head"><StepHeading index="03" title="验证模型" note={viewNote(view)} /><div className="identification-summary"><span>采样点<strong>{samples.length}</strong></span><span>拟合度<strong className={result.fitPercent >= 70 ? "good" : "warn"}>{formatNumber(result.fitPercent, 1)}%</strong></span></div></div>
          <div className="modern-result-tabs">{([['data', '输入与输出'], ['fit', '测量 vs 预测'], ['residual', '剩余误差']] as const).map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>
          <div className="primary-plot identification-plot"><Plot id={`identification-${view}`} height={410} legendLimit={3} series={series} xLabel="时间 t / s" yLabel={view === "data" ? "信号幅值" : view === "fit" ? "输出 y" : "误差 e"} /></div>

          <div className="identification-verdict"><span className={result.fitPercent >= 70 ? "good" : "warn"}>{formatNumber(result.fitPercent, 1)}%</span><div><strong>{fitVerdict(result.fitPercent)}</strong><p>RMSE = {formatNumber(result.rmse, 5)}。拟合曲线越重合、残差越小，模型越可信。</p></div></div>

          <section className="identified-model-card">
            <header><span>辨识得到的离散模型</span><small>na {result.na} · nb {result.nb} · nk {result.nk}</small></header>
            <div className="identified-equations"><MathFormula latex={equations.a} display /><MathFormula latex={equations.b} display /><MathFormula className="identified-model-relation" latex={equations.model} display /></div>
            <details className="identification-coefficients"><summary>查看参数向量</summary><div><code>a = [{result.a.map((value) => formatNumber(value, 5)).join(", ")}]</code><code>b = [{result.b.map((value) => formatNumber(value, 5)).join(", ")}]</code></div></details>
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

function viewNote(view: IdentificationView) {
  if (view === "data") return "先确认输入真正激励了系统，输出也包含可辨认的变化。";
  if (view === "residual") return "理想残差应围绕零散开，不应保留明显趋势或振荡。";
  return "绿色预测线越贴近青色测量线，模型越能复现真实系统。";
}

function fitVerdict(fit: number) {
  if (fit >= 90) return "当前模型能很好地复现这组数据";
  if (fit >= 70) return "模型已经抓住主要动态";
  return "当前结构还没有充分解释数据";
}
