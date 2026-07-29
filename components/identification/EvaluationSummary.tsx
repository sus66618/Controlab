import { formatNumber } from "@/lib/control";
import type { FitMetrics, IdentificationResult } from "@/lib/identification/types";

export function EvaluationSummary({ result, metrics }: { result: IdentificationResult; metrics: FitMetrics }) {
  return <div className="identification-metrics">
    <Metric label="拟合度" value={`${formatNumber(metrics.fitPercent, 1)}%`} tone={metrics.fitPercent >= 70 ? "good" : "warn"} />
    <Metric label="RMSE" value={formatNumber(metrics.rmse, 5)} />
    <Metric label="AIC" value={formatNumber(metrics.aic, 1)} />
    <Metric label="BIC" value={formatNumber(metrics.bic, 1)} />
    <Metric label="计算状态" value={["armax", "oe"].includes(result.method) ? `${result.iterations} 次 · ${result.converged ? "已收敛" : "未收敛"}` : "解析求解"} tone={result.converged ? "good" : "warn"} />
  </div>;
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <div><span>{label}</span><strong className={tone}>{value}</strong></div>; }
