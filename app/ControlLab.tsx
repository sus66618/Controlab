"use client";

import { useMemo, useState } from "react";
import {
  Complex,
  Model,
  formatPolynomial,
  frequencyResponse,
  nyquist,
  parseCoefficients,
  rootLocus,
  simulateResponse,
  stabilityMargins,
  systemSummary,
} from "@/lib/control";

type Tab = "response" | "bode" | "root" | "nyquist";
type Point = { x: number; y: number };

const PRESETS = [
  { name: "经典二阶", hint: "欠阻尼 · 有超调", numerator: "25", denominator: "1, 4, 25" },
  { name: "惯性环节", hint: "平稳 · 易入门", numerator: "1", denominator: "1, 1" },
  { name: "三阶系统", hint: "相位裕度观察", numerator: "10", denominator: "1, 3, 2, 0" },
  { name: "含零点系统", hint: "观察曲线转折", numerator: "1, 3", denominator: "1, 2, 5" },
];

const TAB_META: Record<Tab, { label: string; eyebrow: string; title: string }> = {
  response: { label: "响应", eyebrow: "TIME DOMAIN", title: "时域响应" },
  bode: { label: "Bode", eyebrow: "FREQUENCY DOMAIN", title: "Bode 图" },
  root: { label: "根轨迹", eyebrow: "CLOSED-LOOP POLES", title: "根轨迹" },
  nyquist: { label: "Nyquist", eyebrow: "ENCIRCLEMENT", title: "奈奎斯特图" },
};

function niceNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1000 || (absolute > 0 && absolute < 0.01)) return value.toExponential(1);
  return Number(value.toFixed(2)).toString();
}

function complexText(value: Complex) {
  const real = Math.abs(value.re) < 1e-7 ? 0 : value.re;
  const imaginary = Math.abs(value.im) < 1e-7 ? 0 : value.im;
  if (!imaginary) return niceNumber(real);
  if (!real) return `${niceNumber(imaginary)}j`;
  return `${niceNumber(real)} ${imaginary >= 0 ? "+" : "−"} ${niceNumber(Math.abs(imaginary))}j`;
}

function paddedDomain(values: number[], includeZero = false): [number, number] {
  const filtered = values.filter(Number.isFinite);
  let minimum = Math.min(...filtered);
  let maximum = Math.max(...filtered);
  const nonNegative = minimum >= 0;
  const nonPositive = maximum <= 0;
  if (includeZero) {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (Math.abs(maximum - minimum) < 1e-9) {
    minimum -= 1;
    maximum += 1;
  }
  const pad = (maximum - minimum) * 0.09;
  return [includeZero && nonNegative ? 0 : minimum - pad, includeZero && nonPositive ? 0 : maximum + pad];
}

function Plot({
  id,
  series,
  xLabel,
  yLabel,
  logX = false,
  height = 410,
  square = false,
  markers = [],
}: {
  id: string;
  series: { points: Point[]; color: string; name: string; dashed?: boolean }[];
  xLabel: string;
  yLabel: string;
  logX?: boolean;
  height?: number;
  square?: boolean;
  markers?: { point: Point; color: string; label?: string; shape?: "cross" | "circle" }[];
}) {
  const width = 900;
  const margin = { left: 72, right: 32, top: 24, bottom: 54 };
  const allPoints = series.flatMap((item) => item.points).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const transformedX = allPoints.map((point) => (logX ? Math.log10(Math.max(point.x, 1e-12)) : point.x));
  let xDomain = paddedDomain(transformedX, !logX);
  let yDomain = paddedDomain(allPoints.map((point) => point.y), true);
  if (square) {
    const extent = Math.max(Math.abs(xDomain[0]), Math.abs(xDomain[1]), Math.abs(yDomain[0]), Math.abs(yDomain[1]));
    xDomain = [-extent, extent];
    yDomain = [-extent, extent];
  }
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const sx = (value: number) => margin.left + (((logX ? Math.log10(Math.max(value, 1e-12)) : value) - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const sy = (value: number) => margin.top + ((yDomain[1] - value) / (yDomain[1] - yDomain[0])) * plotHeight;
  const xTicks = Array.from({ length: 6 }, (_, index) => xDomain[0] + ((xDomain[1] - xDomain[0]) * index) / 5);
  const yTicks = Array.from({ length: 6 }, (_, index) => yDomain[0] + ((yDomain[1] - yDomain[0]) * index) / 5);
  const makePath = (points: Point[]) => points.map((point, index) => `${index ? "L" : "M"}${sx(point.x).toFixed(2)},${sy(point.y).toFixed(2)}`).join(" ");

  return (
    <svg id={id} className="plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} 关于 ${xLabel} 的曲线`}>
      <rect width={width} height={height} rx="18" fill="#0c1110" />
      <defs>
        <clipPath id={`${id}-clip`}><rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} /></clipPath>
      </defs>
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} stroke="#26302d" strokeWidth="1" />
          <text x={margin.left - 12} y={sy(tick) + 4} textAnchor="end" className="axis-text">{niceNumber(tick)}</text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={sx(logX ? 10 ** tick : tick)} x2={sx(logX ? 10 ** tick : tick)} y1={margin.top} y2={height - margin.bottom} stroke="#202a27" strokeWidth="1" />
          <text x={sx(logX ? 10 ** tick : tick)} y={height - margin.bottom + 24} textAnchor="middle" className="axis-text">
            {logX ? `10^${niceNumber(tick)}` : niceNumber(tick)}
          </text>
        </g>
      ))}
      {!logX && xDomain[0] <= 0 && xDomain[1] >= 0 && <line x1={sx(0)} x2={sx(0)} y1={margin.top} y2={height - margin.bottom} stroke="#53605c" />}
      {yDomain[0] <= 0 && yDomain[1] >= 0 && <line x1={margin.left} x2={width - margin.right} y1={sy(0)} y2={sy(0)} stroke="#53605c" />}
      <g clipPath={`url(#${id}-clip)`}>
        {series.map((item) => (
          <path key={item.name} d={makePath(item.points)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={item.dashed ? "8 8" : undefined} />
        ))}
        {markers.map((marker, index) => marker.shape === "circle" ? (
          <circle key={index} cx={sx(marker.point.x)} cy={sy(marker.point.y)} r="6" fill="#0c1110" stroke={marker.color} strokeWidth="3" />
        ) : (
          <g key={index} stroke={marker.color} strokeWidth="3">
            <line x1={sx(marker.point.x) - 6} x2={sx(marker.point.x) + 6} y1={sy(marker.point.y) - 6} y2={sy(marker.point.y) + 6} />
            <line x1={sx(marker.point.x) - 6} x2={sx(marker.point.x) + 6} y1={sy(marker.point.y) + 6} y2={sy(marker.point.y) - 6} />
          </g>
        ))}
      </g>
      <text x={width / 2} y={height - 10} textAnchor="middle" className="axis-label">{xLabel}</text>
      <text x="18" y={height / 2} textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`} className="axis-label">{yLabel}</text>
      <g transform={`translate(${width - margin.right - 170},${margin.top + 4})`}>
        {series.slice(0, 3).map((item, index) => (
          <g key={item.name} transform={`translate(0,${index * 24})`}>
            <line x1="0" x2="26" y1="0" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? "6 5" : undefined} />
            <text x="36" y="4" className="legend-text">{item.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function downloadChart(ids: string | string[], format: "svg" | "png") {
  const names = Array.isArray(ids) ? ids : [ids];
  const sources = names.map((id) => document.getElementById(id) as SVGSVGElement | null).filter((source): source is SVGSVGElement => Boolean(source));
  if (!sources.length) return;
  const heights = sources.map((source) => source.viewBox.baseVal.height);
  const totalHeight = heights.reduce((sum, height) => sum + height, 0);
  let offset = 0;
  const children = sources.map((source, index) => {
    const result = `<svg x="0" y="${offset}" width="900" height="${heights[index]}" viewBox="0 0 900 ${heights[index]}">${source.innerHTML}</svg>`;
    offset += heights[index];
    return result;
  }).join("");
  const payload = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${totalHeight}" viewBox="0 0 900 ${totalHeight}">${children}</svg>`;
  const svgBlob = new Blob([payload], { type: "image/svg+xml;charset=utf-8" });
  const fileName = names.length > 1 ? "controlab-bode" : names[0];
  if (format === "svg") {
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = Math.round((2400 * totalHeight) / 900);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}@2x.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(svgBlob);
}

function KnowledgePanel({ tab, stable, phaseMargin, gainMargin }: { tab: Tab; stable: boolean; phaseMargin: number | null; gainMargin: number | null }) {
  const content: Record<Tab, { lead: string; insight: string; experiment: string }> = {
    response: {
      lead: "时域响应回答：系统收到输入后，多久到、会不会冲过头、最终差多少。",
      insight: stable ? "当前极点都在左半平面，响应最终能够收敛。" : "当前存在非负实部极点，响应不会渐近收敛。",
      experiment: "把分母一次项减小一半，观察振荡与超调如何变化。",
    },
    bode: {
      lead: "Bode 图把幅值与相位随频率的变化拆开，是看稳定裕度与带宽的放大镜。",
      insight: phaseMargin === null ? "当前频段内没有 0 dB 穿越，无法给出有限相位裕度。" : `当前相位裕度约 ${niceNumber(phaseMargin)}°，${phaseMargin > 45 ? "通常具有较从容的相对稳定性" : "闭环鲁棒性可能偏紧"}。`,
      experiment: "给分子增加一个左半平面零点，观察相位抬升发生在哪个频段。",
    },
    root: {
      lead: "根轨迹展示单位负反馈下，闭环极点随增益 K 变化的路线。",
      insight: "× 是开环极点，○ 是开环零点；轨迹进入右半平面时，对应增益会使闭环不稳定。",
      experiment: "尝试“含零点系统”，观察零点如何像磁铁一样牵引轨迹。",
    },
    nyquist: {
      lead: "奈奎斯特图把频率响应画在复平面中，用对 −1 点的环绕判断闭环稳定性。",
      insight: gainMargin === null ? "当前曲线未出现明确的 −180° 穿越，增益裕度可能为无穷或超出显示频段。" : `按当前采样估计，增益裕度约 ${niceNumber(gainMargin)} dB。`,
      experiment: "选择三阶系统，观察曲线靠近 −1 点时稳定裕度如何变得敏感。",
    },
  };
  const item = content[tab];
  return (
    <aside className="knowledge-card">
      <div className="knowledge-heading"><span>读图指南</span><strong>不是只画给你看</strong></div>
      <p className="knowledge-lead">{item.lead}</p>
      <div className="knowledge-block"><small>结合当前模型</small><p>{item.insight}</p></div>
      <div className="knowledge-block experiment"><small>30 秒小实验</small><p>{item.experiment}</p></div>
    </aside>
  );
}

export default function ControlLab() {
  const [numeratorText, setNumeratorText] = useState("25");
  const [denominatorText, setDenominatorText] = useState("1, 4, 25");
  const [activeTab, setActiveTab] = useState<Tab>("response");
  const [inputType, setInputType] = useState<"step" | "ramp" | "sine">("step");
  const [duration, setDuration] = useState(12);
  const parsedModel = useMemo<{ value: Model | null; error: string }>(() => {
    try {
      const value = { numerator: parseCoefficients(numeratorText), denominator: parseCoefficients(denominatorText) };
      if (value.numerator.length > value.denominator.length) throw new Error("分子阶次不能高于分母阶次");
      return { value, error: "" };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : "模型格式有误" };
    }
  }, [numeratorText, denominatorText]);
  const model = parsedModel.value;

  const computed = useMemo(() => {
    if (!model) return { value: null, error: "" };
    try {
      const summary = systemSummary(model);
      const margins = stabilityMargins(model);
      const frequency = frequencyResponse(model);
      const response = simulateResponse(model, inputType, duration);
      return { value: { summary, margins, frequency, response, locus: rootLocus(model), nyquist: nyquist(model) }, error: "" };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : "计算失败" };
    }
  }, [model, inputType, duration]);
  const analysis = computed.value;
  const error = parsedModel.error || computed.error;

  const currentId = activeTab === "bode" ? ["controlab-bode-magnitude", "controlab-bode-phase"] : `controlab-${activeTab}`;
  const choosePreset = (preset: typeof PRESETS[number]) => {
    setNumeratorText(preset.numerator);
    setDenominatorText(preset.denominator);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Controlab 首页"><span className="brand-mark">C</span><span>Controlab</span><em>控制实验室</em></a>
        <nav aria-label="主导航"><a className="active" href="#workspace">工作台</a><a href="#knowledge">知识库</a><a href="#about">关于</a></nav>
        <div className="top-note"><span className="status-dot" />全部计算在本机完成</div>
      </header>

      <section className="intro" id="top">
        <div><span className="kicker">CONTROL SYSTEMS, MADE VISIBLE</span><h1>让每一个公式，<br /><i>都能被看见。</i></h1></div>
        <p>输入传递函数，立即观察时域与频域特性。图像、指标与解释来自同一份计算结果。</p>
      </section>

      <section className="workspace" id="workspace">
        <aside className="model-panel">
          <div className="panel-title"><span>01</span><div><small>SYSTEM MODEL</small><h2>系统模型</h2></div></div>
          <label>分子系数 <span>按降幂排列</span><input value={numeratorText} onChange={(event) => setNumeratorText(event.target.value)} spellCheck={false} /></label>
          <div className="fraction-line" />
          <label>分母系数 <span>按降幂排列</span><input value={denominatorText} onChange={(event) => setDenominatorText(event.target.value)} spellCheck={false} /></label>
          {error && <p className="error-text">{error}</p>}
          {model && <div className="formula"><small>当前传递函数</small><div><span>{formatPolynomial(model.numerator)}</span><hr /><span>{formatPolynomial(model.denominator)}</span></div></div>}

          <div className="preset-heading"><span>快速示例</span><small>点击载入</small></div>
          <div className="preset-list">
            {PRESETS.map((preset) => <button key={preset.name} onClick={() => choosePreset(preset)}><span>{preset.name}<small>{preset.hint}</small></span><b>→</b></button>)}
          </div>

          {analysis && <div className="pole-list"><small>开环极点</small><p>{analysis.summary.poles.map(complexText).join(" · ") || "无"}</p></div>}
        </aside>

        <div className="analysis-panel">
          <div className="analysis-header">
            <div><small>{TAB_META[activeTab].eyebrow}</small><h2>{TAB_META[activeTab].title}</h2></div>
            <div className="export-group"><button onClick={() => downloadChart(currentId, "svg")}>SVG</button><button onClick={() => downloadChart(currentId, "png")}>PNG 2×</button></div>
          </div>
          <div className="tabs" role="tablist">
            {(Object.keys(TAB_META) as Tab[]).map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{TAB_META[tab].label}</button>)}
          </div>

          {analysis && (
            <div className="chart-area">
              {activeTab === "response" && <>
                <div className="chart-toolbar"><div className="segmented">{(["step", "ramp", "sine"] as const).map((type) => <button key={type} className={inputType === type ? "active" : ""} onClick={() => setInputType(type)}>{{ step: "阶跃", ramp: "斜坡", sine: "正弦" }[type]}</button>)}</div><label>时长 <input type="range" min="4" max="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />{duration}s</label></div>
                <Plot id="controlab-response" series={[{ name: "输出 y(t)", color: "#d8ff52", points: analysis.response.map((point) => ({ x: point.t, y: point.output })) }, { name: "输入 r(t)", color: "#8b9994", dashed: true, points: analysis.response.map((point) => ({ x: point.t, y: point.input })) }]} xLabel="时间 t / s" yLabel="幅值" />
              </>}
              {activeTab === "bode" && <div className="bode-stack">
                <Plot id="controlab-bode-magnitude" height={270} logX series={[{ name: "幅值", color: "#d8ff52", points: analysis.frequency.map((point) => ({ x: point.omega, y: point.magnitude })) }]} xLabel="角频率 ω / rad·s⁻¹" yLabel="幅值 / dB" />
                <Plot id="controlab-bode-phase" height={270} logX series={[{ name: "相位", color: "#7ee4c4", points: analysis.frequency.map((point) => ({ x: point.omega, y: point.phase })) }]} xLabel="角频率 ω / rad·s⁻¹" yLabel="相位 / °" />
              </div>}
              {activeTab === "root" && <Plot id="controlab-root" square series={analysis.locus.map((branch, index) => ({ name: `分支 ${index + 1}`, color: index % 2 ? "#7ee4c4" : "#d8ff52", points: branch.map((point) => ({ x: point.re, y: point.im })) }))} markers={[...analysis.summary.poles.map((point) => ({ point: { x: point.re, y: point.im }, color: "#ff8066", shape: "cross" as const })), ...analysis.summary.zeros.map((point) => ({ point: { x: point.re, y: point.im }, color: "#f5f1e8", shape: "circle" as const }))]} xLabel="实轴 Re" yLabel="虚轴 Im" />}
              {activeTab === "nyquist" && <Plot id="controlab-nyquist" square series={[{ name: "G(jω)", color: "#d8ff52", points: analysis.nyquist.map((point) => ({ x: point.re, y: point.im })) }]} markers={[{ point: { x: -1, y: 0 }, color: "#ff8066", shape: "cross" }]} xLabel="实部 Re" yLabel="虚部 Im" />}
            </div>
          )}

          {analysis && <div className="metric-row">
            <div><small>开环稳定性</small><strong className={analysis.summary.stable ? "good" : "warn"}>{analysis.summary.stable ? "稳定" : analysis.summary.marginal ? "临界" : "不稳定"}</strong></div>
            <div><small>相位裕度</small><strong>{analysis.margins.phaseMargin === null ? "—" : `${niceNumber(analysis.margins.phaseMargin)}°`}</strong></div>
            <div><small>增益裕度</small><strong>{analysis.margins.gainMargin === null ? "∞ / —" : `${niceNumber(analysis.margins.gainMargin)} dB`}</strong></div>
            <div><small>系统阶次</small><strong>{model ? model.denominator.length - 1 : "—"}</strong></div>
          </div>}
        </div>
      </section>

      {analysis && <section id="knowledge" className="knowledge-section"><div className="section-index">02 / KNOWLEDGE IN CONTEXT</div><KnowledgePanel tab={activeTab} stable={analysis.summary.stable} phaseMargin={analysis.margins.phaseMargin} gainMargin={analysis.margins.gainMargin} /></section>}

      <footer id="about"><span>Controlab · 第一版实验工作台</span><p>计算结果用于学习与理解，不替代安全关键工程验证。</p></footer>
    </main>
  );
}
