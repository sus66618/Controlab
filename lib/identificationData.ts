export type IdentificationDataset = {
  time: number[];
  inputs: number[][];
  outputs: number[][];
  inputNames: string[];
  outputNames: string[];
};

type TableCell = string | number | boolean | Date | null | undefined;

export function parseIdentificationCsvDataset(text: string) {
  return parseIdentificationTable(parseDelimitedRows(text));
}

export function parseIdentificationTable(sourceRows: TableCell[][]): IdentificationDataset {
  const rows = sourceRows.filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
  if (rows.length < 3) throw new Error("至少需要 3 行有效数据");

  const firstRowIsNumeric = rows[0].slice(0, 3).every((cell) => Number.isFinite(Number(cell)));
  if (firstRowIsNumeric) {
    return buildDataset(["t", "u", "y"], rows, { time: 0, inputs: [1], outputs: [2] }, 1);
  }
  if (rows.length < 4) throw new Error("至少需要表头和 3 行有效数据");

  const headers = rows[0].map((cell) => String(cell ?? "").trim());
  const columns = classifyColumns(headers);
  return buildDataset(headers, rows.slice(1), columns, 2);
}

function parseDelimitedRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => { row.push(field.trim()); field = ""; };
  const pushRow = () => { pushField(); if (row.some((cell) => cell !== "")) rows.push(row); row = []; };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && /[,;\t，]/.test(character)) pushField();
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
    } else field += character;
  }
  if (quoted) throw new Error("CSV 引号没有闭合");
  if (field || row.length) pushRow();
  return rows;
}

function classifyColumns(headers: string[]) {
  let time = -1;
  const inputs: number[] = [];
  const outputs: number[] = [];
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().replace(/[\s_-]/g, "");
    if (["t", "time", "时间", "时刻"].includes(normalized)) time = index;
    else if (/^(u\d*|input\d*|输入\d*)$/.test(normalized)) inputs.push(index);
    else if (/^(y\d*|output\d*|输出\d*)$/.test(normalized)) outputs.push(index);
  });
  if (time < 0) throw new Error("未找到时间列，请使用 t、time 或 时间");
  if (!inputs.length) throw new Error("未找到输入列，请使用 u1、input1 或 输入1");
  if (!outputs.length) throw new Error("未找到输出列，请使用 y1、output1 或 输出1");
  if (inputs.length + outputs.length > 16) throw new Error("输入与输出通道总数不能超过 16");
  return { time, inputs, outputs };
}

function buildDataset(headers: string[], rows: TableCell[][], columns: { time: number; inputs: number[]; outputs: number[] }, firstLine: number) {
  if (rows.length > 50_000) throw new Error("采样点不能超过 50000");
  const required = [columns.time, ...columns.inputs, ...columns.outputs];
  const numericRows = rows.map((row, index) => {
    const values = required.map((column) => {
      const cell = row[column];
      if (cell === null || cell === undefined || typeof cell === "boolean" || cell instanceof Date || String(cell).trim() === "") return Number.NaN;
      return Number(cell);
    });
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`第 ${index + firstLine} 行包含空值或非数字`);
    return values;
  });
  if (numericRows.length < 3) throw new Error("至少需要 3 行有效数据");
  const time = numericRows.map((row) => row[0]);
  for (let index = 1; index < time.length; index += 1) if (time[index] <= time[index - 1]) throw new Error("时间列必须严格递增");
  const inputCount = columns.inputs.length;
  return {
    time,
    inputs: numericRows.map((row) => row.slice(1, 1 + inputCount)),
    outputs: numericRows.map((row) => row.slice(1 + inputCount)),
    inputNames: columns.inputs.map((column) => headers[column] || `u${column + 1}`),
    outputNames: columns.outputs.map((column) => headers[column] || `y${column + 1}`),
  };
}
