export function downloadCharts(ids: string | string[], format: "svg" | "png") {
  const names = Array.isArray(ids) ? ids : [ids];
  const sources = names
    .map((id) => document.getElementById(id) as SVGSVGElement | null)
    .filter((source): source is SVGSVGElement => Boolean(source));
  if (!sources.length) return;
  const heights = sources.map((source) => source.viewBox.baseVal.height);
  const totalHeight = heights.reduce((sum, height) => sum + height, 0);
  let offset = 0;
  const children = sources.map((source, index) => {
    const content = `<svg x="0" y="${offset}" width="960" height="${heights[index]}" viewBox="0 0 960 ${heights[index]}">${source.innerHTML}</svg>`;
    offset += heights[index];
    return content;
  }).join("");
  const payload = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${totalHeight}" viewBox="0 0 960 ${totalHeight}">${children}</svg>`;
  const blob = new Blob([payload], { type: "image/svg+xml;charset=utf-8" });
  const fileName = names.length > 1 ? "controlab-bode" : names[0];
  if (format === "svg") {
    triggerDownload(URL.createObjectURL(blob), `${fileName}.svg`);
    return;
  }
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = Math.round((2400 * totalHeight) / 960);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((png) => { if (png) triggerDownload(URL.createObjectURL(png), `${fileName}@2x.png`); }, "image/png");
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(blob);
}

function triggerDownload(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
