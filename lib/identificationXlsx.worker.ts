import readWorkbook from "read-excel-file/web-worker";
import { parseIdentificationTable } from "./identificationData";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const sheets = await readWorkbook(event.data);
    let lastError: unknown = new Error("Excel 中没有可辨识的数据表");
    for (const sheet of sheets) {
      try {
        self.postMessage({ ok: true, dataset: parseIdentificationTable(sheet.data) });
        return;
      } catch (reason) {
        lastError = reason;
      }
    }
    throw lastError;
  } catch (reason) {
    self.postMessage({ ok: false, error: reason instanceof Error ? reason.message : "Excel 读取失败" });
  }
};
