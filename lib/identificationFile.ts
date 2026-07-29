import { parseIdentificationCsvDataset } from "./identificationData.ts";
import type { IdentificationDataset } from "./identificationData.ts";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type IdentificationFileLike = {
  name: string;
  size: number;
  text: () => Promise<string>;
};

export async function readIdentificationFile(file: IdentificationFileLike): Promise<IdentificationDataset> {
  if (file.size > MAX_FILE_SIZE) throw new Error("文件不能超过 10 MB");
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (extension === "csv") return parseIdentificationCsvDataset(await file.text());
  if (extension !== "xlsx") throw new Error("请选择 CSV 或 XLSX 文件；旧式 XLS 暂不支持");

  return readXlsxInWorker(file as File);
}

function readXlsxInWorker(file: File) {
  return new Promise<IdentificationDataset>((resolve, reject) => {
    const worker = new Worker(new URL("./identificationXlsx.worker.ts", import.meta.url), { type: "module" });
    const finish = (callback: () => void) => { clearTimeout(timeout); worker.terminate(); callback(); };
    const timeout = setTimeout(() => finish(() => reject(new Error("Excel 解析超时，请缩小文件后重试"))), 20_000);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; dataset?: IdentificationDataset; error?: string }>) => {
      if (event.data.ok && event.data.dataset) finish(() => resolve(event.data.dataset!));
      else finish(() => reject(new Error(event.data.error || "Excel 读取失败")));
    };
    worker.onerror = () => finish(() => reject(new Error("Excel 解析器启动失败")));
    worker.postMessage(file);
  });
}
