"use client";

import { useMemo, useState } from "react";
import { formatComplex } from "@/lib/control";
import type { Complex, ZpkModel } from "@/lib/control";

type RootGroup = { root: Complex; label: string; size: number };

function groupRoots(values: Complex[]): RootGroup[] {
  const used = new Set<number>();
  const groups: RootGroup[] = [];
  values.forEach((root, index) => {
    if (used.has(index)) return;
    used.add(index);
    if (Math.abs(root.im) < 1e-7) {
      groups.push({ root, label: formatComplex(root), size: 1 });
      return;
    }
    const pairIndex = values.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && Math.abs(candidate.re - root.re) < 1e-6 && Math.abs(candidate.im + root.im) < 1e-6);
    if (pairIndex >= 0) used.add(pairIndex);
    const positive = root.im > 0 ? root : { re: root.re, im: -root.im };
    groups.push({ root: positive, label: `${formatComplex({ re: positive.re, im: 0 })} ± ${Math.abs(positive.im).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}j`, size: pairIndex >= 0 ? 2 : 1 });
  });
  return groups;
}

export function RootEditor({ zpk, addRoot, removeRoot }: {
  zpk: ZpkModel;
  addRoot: (kind: "zero" | "pole", root: Complex) => void;
  removeRoot: (kind: "zero" | "pole", root: Complex) => void;
}) {
  const [kind, setKind] = useState<"zero" | "pole">("pole");
  const [real, setReal] = useState("-1");
  const [imaginary, setImaginary] = useState("0");
  const [message, setMessage] = useState("");
  const zeros = useMemo(() => groupRoots(zpk.zeros), [zpk.zeros]);
  const poles = useMemo(() => groupRoots(zpk.poles), [zpk.poles]);

  const add = () => {
    const root = { re: Number(real), im: Number(imaginary) };
    if (!Number.isFinite(root.re) || !Number.isFinite(root.im)) {
      setMessage("请输入有效坐标");
      return;
    }
    addRoot(kind, root);
    setMessage(Math.abs(root.im) > 1e-8 ? "已自动加入共轭点" : "已加入实轴点");
  };

  return <section className="root-editor">
    <div className="root-editor-title"><div><span className="section-label">ROOT EDITOR</span><strong>直接修改零极点</strong></div><small>修改会同步到传函与全部图像</small></div>
    <div className="root-add-row">
      <div className="mini-switch"><button className={kind === "pole" ? "active" : ""} onClick={() => setKind("pole")}>极点 ×</button><button className={kind === "zero" ? "active" : ""} onClick={() => setKind("zero")}>零点 ○</button></div>
      <label>Re<input value={real} onChange={(event) => setReal(event.target.value)} inputMode="decimal" /></label>
      <label>Im<input value={imaginary} onChange={(event) => setImaginary(event.target.value)} inputMode="decimal" /></label>
      <button className="add-root" onClick={add}>添加</button>
      <span className="root-message">{message}</span>
    </div>
    <div className="root-lists">
      <RootList label="极点" groups={poles} kind="pole" onRemove={removeRoot} minimum={1} />
      <RootList label="零点" groups={zeros} kind="zero" onRemove={removeRoot} minimum={0} />
    </div>
  </section>;
}

function RootList({ label, groups, kind, onRemove, minimum }: {
  label: string;
  groups: RootGroup[];
  kind: "zero" | "pole";
  onRemove: (kind: "zero" | "pole", root: Complex) => void;
  minimum: number;
}) {
  const total = groups.reduce((sum, group) => sum + group.size, 0);
  return <div className="root-list"><span>{label}</span><div>{groups.length ? groups.map((group, index) => <div className="root-chip" key={`${group.label}-${index}`}><code>{group.label}</code><button disabled={total - group.size < minimum} title={total - group.size < minimum ? "系统至少保留一个极点" : `删除${label}`} onClick={() => onRemove(kind, group.root)}>×</button></div>) : <em>无</em>}</div></div>;
}
