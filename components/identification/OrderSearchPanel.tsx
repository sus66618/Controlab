import { useRef, useState } from "react";
import type { IdentificationDataset } from "@/lib/identificationData";
import type { SearchCandidate, SearchCriterion } from "@/lib/identification/search";
import type { IdentificationConfig } from "@/lib/identification/types";
import type { IdentificationWorkerResponse } from "@/lib/identification/workerProtocol";

export function OrderSearchPanel({ dataset, config, onApply }: { dataset: IdentificationDataset; config: IdentificationConfig; onApply: (candidate: SearchCandidate) => void }) {
  const worker = useRef<Worker | null>(null);
  const [criterion, setCriterion] = useState<SearchCriterion>("validation-fit");
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [message, setMessage] = useState("");
  const start = () => {
    worker.current?.terminate();
    const next = new Worker(new URL("./identification.worker.ts", import.meta.url), { type: "module" });
    worker.current = next; setCandidates([]); setMessage(""); setProgress({ completed: 0, total: 1 });
    next.onmessage = (event: MessageEvent<IdentificationWorkerResponse>) => {
      if (event.data.type === "progress") setProgress(event.data);
      if (event.data.type === "complete") { setCandidates(event.data.result.ranked); setProgress(null); next.terminate(); }
      if (event.data.type === "cancelled") { setMessage("搜索已取消"); setProgress(null); next.terminate(); }
      if (event.data.type === "error") { setMessage(event.data.message); setProgress(null); next.terminate(); }
    };
    next.postMessage({ type: "start", dataset, config, criterion, range: { na: [1, 4], nb: [1, 4], nk: [0, 2], nc: [1, 2], nf: [1, 4] } });
  };
  const cancel = () => worker.current?.postMessage({ type: "cancel" });
  return <details className="identification-search"><summary>自动选择阶次</summary><div className="identification-search-controls"><select value={criterion} onChange={(event) => setCriterion(event.target.value as SearchCriterion)}><option value="validation-fit">验证仿真拟合度</option><option value="aic">AIC</option><option value="bic">BIC</option></select>{progress ? <button onClick={cancel}>取消 {progress.completed}/{progress.total}</button> : <button onClick={start}>开始搜索</button>}</div>{message && <p>{message}</p>}{candidates.map((candidate, index) => <button className="search-candidate" key={`${candidate.config.na}-${candidate.config.nb}-${candidate.config.nk}-${index}`} onClick={() => onApply(candidate)}><b>#{index + 1}</b><span>{candidate.config.method === "oe" ? `nf ${candidate.config.nf}` : `na ${candidate.config.na}`} · nb {candidate.config.nb} · nk {candidate.config.nk}</span><strong>{criterion === "validation-fit" ? `${candidate.score.toFixed(1)}%` : candidate.score.toFixed(1)}</strong></button>)}</details>;
}
