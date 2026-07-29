import type { IdentificationDataset } from "../identificationData.ts";
import type { OrderRange, SearchCriterion } from "./search.ts";
import type { IdentificationConfig } from "./types.ts";

export type IdentificationWorkerRequest =
  | { type: "start"; dataset: IdentificationDataset; config: IdentificationConfig; range: OrderRange; criterion: SearchCriterion }
  | { type: "cancel" };

export type IdentificationWorkerResponse =
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; result: Awaited<ReturnType<typeof import("./search.ts")["searchOrders"]>> }
  | { type: "cancelled" }
  | { type: "error"; message: string };
