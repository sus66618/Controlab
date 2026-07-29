export function solveLeastSquares(rows: number[][], target: number[], lambda = 0, unpenalized = new Set<number>()) {
  if (!rows.length || !rows[0]?.length) throw new Error("回归矩阵不能为空");
  const augmentedRows = rows.map((row) => [...row]);
  const augmentedTarget = [...target];
  if (lambda > 0) {
    const scale = Math.sqrt(lambda);
    for (let column = 0; column < rows[0].length; column += 1) {
      if (unpenalized.has(column)) continue;
      const regularizer = Array(rows[0].length).fill(0);
      regularizer[column] = scale;
      augmentedRows.push(regularizer);
      augmentedTarget.push(0);
    }
  }
  return qrSolve(qrDecompose(augmentedRows), augmentedTarget);
}
type QrDecomposition = { q: number[][]; r: number[][] };

function qrDecompose(rows: number[][]): QrDecomposition {
  const columns = rows[0].length;
  const q: number[][] = [];
  const r = Array.from({ length: columns }, () => Array(columns).fill(0));
  const scale = Math.max(1, ...Array.from({ length: columns }, (_, column) => Math.hypot(...rows.map((row) => row[column]))));
  for (let column = 0; column < columns; column += 1) {
    const vector = rows.map((row) => row[column]);
    for (let previous = 0; previous < column; previous += 1) {
      r[previous][column] = q[previous].reduce((sum, value, row) => sum + value * vector[row], 0);
      for (let row = 0; row < vector.length; row += 1) vector[row] -= r[previous][column] * q[previous][row];
    }
    const norm = Math.hypot(...vector);
    if (norm <= scale * 1e-10) throw new Error("数据激励不足或通道高度共线，无法唯一辨识参数");
    r[column][column] = norm;
    q.push(vector.map((value) => value / norm));
  }
  return { q, r };
}

function qrSolve({ q, r }: QrDecomposition, target: number[]) {
  const transformed = q.map((column) => column.reduce((sum, value, row) => sum + value * target[row], 0));
  const solution = Array(transformed.length).fill(0);
  for (let row = transformed.length - 1; row >= 0; row -= 1) {
    const known = r[row].reduce((sum, value, column) => column > row ? sum + value * solution[column] : sum, 0);
    solution[row] = (transformed[row] - known) / r[row][row];
  }
  return solution;
}
