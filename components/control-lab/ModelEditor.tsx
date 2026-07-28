"use client";

import { formatPolynomial } from "@/lib/control";
import type { TransferModel } from "@/lib/control";
import type { ModelInputMode } from "@/hooks/useControlModel";

const MODES: Array<{ key: ModelInputMode; label: string }> = [
  { key: "coefficients", label: "系数" },
  { key: "expression", label: "表达式" },
  { key: "zpk", label: "零极点" },
];

const PRESETS = [
  { name: "经典二阶", model: { numerator: [25], denominator: [1, 4, 25] } },
  { name: "一阶惯性", model: { numerator: [1], denominator: [1, 1] } },
  { name: "含积分环节", model: { numerator: [10], denominator: [1, 3, 2, 0] } },
  { name: "含左半平面零点", model: { numerator: [1, 3], denominator: [1, 2, 5] } },
];

export function ModelEditor({
  model,
  mode,
  setMode,
  drafts,
  error,
  updateCoefficients,
  updateExpression,
  updateZpk,
  loadModel,
}: {
  model: TransferModel;
  mode: ModelInputMode;
  setMode: (mode: ModelInputMode) => void;
  drafts: { numerator: string; denominator: string; expression: string; gain: string; zeros: string; poles: string };
  error: string;
  updateCoefficients: (field: "numerator" | "denominator", value: string) => void;
  updateExpression: (value: string) => void;
  updateZpk: (field: "gain" | "zeros" | "poles", value: string) => void;
  loadModel: (model: TransferModel) => void;
}) {
  return <aside className="model-editor">
    <div className="editor-heading"><div><span className="section-label">MODEL</span><h2>系统模型</h2></div><span className="live-badge">LIVE</span></div>
    <div className="mode-switch" role="tablist">
      {MODES.map((item) => <button key={item.key} className={mode === item.key ? "active" : ""} onClick={() => setMode(item.key)}>{item.label}</button>)}
    </div>

    <div className="editor-fields">
      {mode === "coefficients" && <>
        <Field label="分子系数" hint="降幂排列"><input value={drafts.numerator} onChange={(event) => updateCoefficients("numerator", event.target.value)} spellCheck={false} /></Field>
        <Field label="分母系数" hint="降幂排列"><input value={drafts.denominator} onChange={(event) => updateCoefficients("denominator", event.target.value)} spellCheck={false} /></Field>
      </>}
      {mode === "expression" && <Field label="G(s)" hint="支持隐式乘法"><textarea value={drafts.expression} onChange={(event) => updateExpression(event.target.value)} spellCheck={false} rows={4} /><small className="field-example">例：25 / (s^2 + 4s + 25)</small></Field>}
      {mode === "zpk" && <>
        <Field label="增益 K"><input value={drafts.gain} onChange={(event) => updateZpk("gain", event.target.value)} spellCheck={false} /></Field>
        <Field label="零点" hint="逗号分隔"><textarea value={drafts.zeros} onChange={(event) => updateZpk("zeros", event.target.value)} spellCheck={false} rows={2} placeholder="-1, -2+3j" /></Field>
        <Field label="极点" hint="逗号分隔"><textarea value={drafts.poles} onChange={(event) => updateZpk("poles", event.target.value)} spellCheck={false} rows={2} placeholder="-2+4j, -2-4j" /></Field>
      </>}
    </div>
    <div className={`editor-message ${error ? "error" : ""}`}>{error || "模型有效，所有图像已同步"}</div>

    <div className="transfer-card">
      <span>G(s)</span>
      <div><b>{formatPolynomial(model.numerator)}</b><i /><b>{formatPolynomial(model.denominator)}</b></div>
    </div>

    <div className="preset-grid">
      {PRESETS.map((preset) => <button key={preset.name} onClick={() => loadModel(preset.model)}>{preset.name}<span>→</span></button>)}
    </div>
  </aside>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}
