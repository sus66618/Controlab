import katex from "katex";

export function MathFormula({ latex, display = false, className = "" }: { latex: string; display?: boolean; className?: string }) {
  const html = katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    strict: false,
    output: "htmlAndMathml",
  });

  return <span className={`math-formula ${display ? "math-display" : "math-inline"} ${className}`.trim()} aria-label={latex} dangerouslySetInnerHTML={{ __html: html }} />;
}
