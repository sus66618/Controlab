import type { IdentificationMethod } from "@/lib/identification/types";

const METHODS: { id: IdentificationMethod; label: string; note: string }[] = [
  { id: "arx", label: "ARX", note: "快速基线，支持多变量" },
  { id: "fir", label: "FIR", note: "只估计输入响应" },
  { id: "ridge-arx", label: "正则化 ARX", note: "高阶模型更稳健" },
  { id: "armax", label: "ARMAX", note: "同时描述相关噪声" },
  { id: "oe", label: "OE", note: "直接优化自由仿真" },
];

export function MethodSelector({ value, oeDisabled, onChange }: { value: IdentificationMethod; oeDisabled: boolean; onChange: (method: IdentificationMethod) => void }) {
  return <div className="identification-methods">{METHODS.map((method) => <button key={method.id} className={value === method.id ? "active" : ""} disabled={method.id === "oe" && oeDisabled} title={method.id === "oe" && oeDisabled ? "OE 首版仅支持单输入单输出数据" : method.note} onClick={() => onChange(method.id)}><strong>{method.label}</strong><small>{method.note}</small></button>)}</div>;
}
export function methodDescription(method: IdentificationMethod, multipleOutputs: boolean) {
  if (method === "fir") return "用有限个输入历史解释输出，结构直观且不会递归发散。";
  if (method === "ridge-arx") return "在 ARX 上增加岭约束，适合高阶或通道相关的数据。";
  if (method === "armax") return multipleOutputs ? "VARMAX：系统动态完整耦合，各输出采用独立的对角噪声模型。" : "ARMAX：在系统动态之外估计有色噪声。";
  if (method === "oe") return "OE 首版仅支持单输入单输出，直接降低模型自由运行时的误差。";
  return "ARX：最小二乘基线，适合先判断阶次与延迟。";
}
