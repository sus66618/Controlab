/// <reference lib="webworker" />
import { searchOrders } from "@/lib/identification/search";
import type { IdentificationWorkerRequest, IdentificationWorkerResponse } from "@/lib/identification/workerProtocol";

let controller: AbortController | null = null;

self.onmessage = async (event: MessageEvent<IdentificationWorkerRequest>) => {
  if (event.data.type === "cancel") { controller?.abort(); return; }
  controller = new AbortController();
  try {
    const result = await searchOrders(event.data.dataset, event.data.config, event.data.range, event.data.criterion, (completed, total) => post({ type: "progress", completed, total }), controller.signal);
    post({ type: "complete", result });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") post({ type: "cancelled" });
    else post({ type: "error", message: error instanceof Error ? error.message : "自动搜索失败" });
  }
};

function post(message: IdentificationWorkerResponse) { self.postMessage(message); }
