"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/control";

export type PlotPoint = { x: number; y: number };
export type PlotSeries = { points: PlotPoint[]; color: string; name: string; dashed?: boolean };
export type PlotMarker = { point: PlotPoint; color: string; shape?: "cross" | "circle" };

function paddedDomain(values: number[], includeZero = false): [number, number] {
  const filtered = values.filter(Number.isFinite);
  if (!filtered.length) return [-1, 1];
  let minimum = Math.min(...filtered);
  let maximum = Math.max(...filtered);
  const nonNegative = minimum >= 0;
  const nonPositive = maximum <= 0;
  if (includeZero) {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (Math.abs(maximum - minimum) < 1e-9) {
    minimum -= 1;
    maximum += 1;
  }
  const padding = (maximum - minimum) * 0.08;
  return [includeZero && nonNegative ? 0 : minimum - padding, includeZero && nonPositive ? 0 : maximum + padding];
}

export function Plot({
  id,
  series,
  xLabel,
  yLabel,
  logX = false,
  height = 420,
  square = false,
  robustFrame = false,
  markers = [],
  legendLimit = 3,
}: {
  id: string;
  series: PlotSeries[];
  xLabel: string;
  yLabel: string;
  logX?: boolean;
  height?: number;
  square?: boolean;
  robustFrame?: boolean;
  markers?: PlotMarker[];
  legendLimit?: number;
}) {
  const width = 960;
  const margin = { left: 68, right: 28, top: 24, bottom: 50 };
  const [hover, setHover] = useState<{ point: PlotPoint; name: string; px: number; py: number } | null>(null);
  const geometry = useMemo(() => {
    const seriesPoints = series.flatMap((item) => item.points).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    const markerPoints = markers.map((marker) => marker.point).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    let points = [...seriesPoints, ...markerPoints];
    if (robustFrame && square && seriesPoints.length) {
      const radii = seriesPoints.map((point) => Math.hypot(point.x, point.y)).sort((a, b) => a - b);
      const markerRadius = Math.max(1, ...markerPoints.map((point) => Math.hypot(point.x, point.y)));
      const cutoff = Math.min(radii[Math.floor((radii.length - 1) * 0.9)], markerRadius * 4);
      // 根轨迹的少量末端会趋向无穷；自动裁掉尾部，保留可读的主要轨迹。
      points = [...seriesPoints.filter((point) => Math.hypot(point.x, point.y) <= cutoff), ...markerPoints];
    }
    const transformedX = points.map((point) => logX ? Math.log10(Math.max(point.x, 1e-12)) : point.x);
    let xDomain = paddedDomain(transformedX, !logX);
    let yDomain = paddedDomain(points.map((point) => point.y), true);
    if (square) {
      const extent = Math.max(Math.abs(xDomain[0]), Math.abs(xDomain[1]), Math.abs(yDomain[0]), Math.abs(yDomain[1]));
      xDomain = [-extent, extent];
      yDomain = [-extent, extent];
    }
    return { xDomain, yDomain };
  }, [logX, markers, robustFrame, series, square]);

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const sx = (value: number) => margin.left + (((logX ? Math.log10(Math.max(value, 1e-12)) : value) - geometry.xDomain[0]) / (geometry.xDomain[1] - geometry.xDomain[0])) * plotWidth;
  const sy = (value: number) => margin.top + ((geometry.yDomain[1] - value) / (geometry.yDomain[1] - geometry.yDomain[0])) * plotHeight;
  const xTicks = Array.from({ length: 6 }, (_, index) => geometry.xDomain[0] + ((geometry.xDomain[1] - geometry.xDomain[0]) * index) / 5);
  const yTicks = Array.from({ length: 6 }, (_, index) => geometry.yDomain[0] + ((geometry.yDomain[1] - geometry.yDomain[0]) * index) / 5);
  const makePath = (points: PlotPoint[]) => points.map((point, index) => `${index ? "L" : "M"}${sx(point.x).toFixed(2)},${sy(point.y).toFixed(2)}`).join(" ");

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * height;
    if (pointerX < margin.left || pointerX > width - margin.right || pointerY < margin.top || pointerY > height - margin.bottom) {
      setHover(null);
      return;
    }
    let nearest: { point: PlotPoint; name: string; px: number; py: number; distance: number } | null = null;
    series.forEach((item) => item.points.forEach((point) => {
      const px = sx(point.x);
      const py = sy(point.y);
      const distance = Math.hypot(px - pointerX, py - pointerY);
      if (!nearest || distance < nearest.distance) nearest = { point, name: item.name, px, py, distance };
    }));
    if (nearest) setHover(nearest);
  };

  const tooltipX = hover ? Math.min(width - 190, Math.max(margin.left + 8, hover.px + 14)) : 0;
  const tooltipY = hover ? Math.min(height - margin.bottom - 62, Math.max(margin.top + 8, hover.py - 54)) : 0;

  return (
    <svg
      id={id}
      className="plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${yLabel} 关于 ${xLabel} 的曲线`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
    >
      <rect width={width} height={height} rx="12" className="plot-background" />
      <defs><clipPath id={`${id}-clip`}><rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} /></clipPath></defs>
      {yTicks.map((tick) => <g key={`y-${tick}`}>
        <line x1={margin.left} x2={width - margin.right} y1={sy(tick)} y2={sy(tick)} className="grid-line" />
        <text x={margin.left - 11} y={sy(tick) + 4} textAnchor="end" className="axis-text">{formatNumber(tick, 2)}</text>
      </g>)}
      {xTicks.map((tick) => {
        const value = logX ? 10 ** tick : tick;
        return <g key={`x-${tick}`}>
          <line x1={sx(value)} x2={sx(value)} y1={margin.top} y2={height - margin.bottom} className="grid-line" />
          <text x={sx(value)} y={height - margin.bottom + 23} textAnchor="middle" className="axis-text">{logX ? `10^${formatNumber(tick, 1)}` : formatNumber(tick, 2)}</text>
        </g>;
      })}
      {!logX && geometry.xDomain[0] <= 0 && geometry.xDomain[1] >= 0 && <line x1={sx(0)} x2={sx(0)} y1={margin.top} y2={height - margin.bottom} className="zero-axis" />}
      {geometry.yDomain[0] <= 0 && geometry.yDomain[1] >= 0 && <line x1={margin.left} x2={width - margin.right} y1={sy(0)} y2={sy(0)} className="zero-axis" />}
      <g clipPath={`url(#${id}-clip)`}>
        {series.map((item) => <path key={item.name} d={makePath(item.points)} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={item.dashed ? "7 7" : undefined} />)}
        {markers.map((marker, index) => marker.shape === "circle" ? (
          <circle key={index} cx={sx(marker.point.x)} cy={sy(marker.point.y)} r="5.5" className="marker-circle" stroke={marker.color} />
        ) : (
          <g key={index} stroke={marker.color} strokeWidth="2.6">
            <line x1={sx(marker.point.x) - 5} x2={sx(marker.point.x) + 5} y1={sy(marker.point.y) - 5} y2={sy(marker.point.y) + 5} />
            <line x1={sx(marker.point.x) - 5} x2={sx(marker.point.x) + 5} y1={sy(marker.point.y) + 5} y2={sy(marker.point.y) - 5} />
          </g>
        ))}
        {hover && <>
          <line x1={hover.px} x2={hover.px} y1={margin.top} y2={height - margin.bottom} className="hover-line" />
          <line x1={margin.left} x2={width - margin.right} y1={hover.py} y2={hover.py} className="hover-line" />
          <circle cx={hover.px} cy={hover.py} r="4.5" className="hover-point" />
        </>}
      </g>
      <text x={width / 2} y={height - 9} textAnchor="middle" className="axis-label">{xLabel}</text>
      <text x="17" y={height / 2} textAnchor="middle" transform={`rotate(-90 17 ${height / 2})`} className="axis-label">{yLabel}</text>
      <g transform={`translate(${width - margin.right - 150},${margin.top + 3})`}>
        {series.slice(0, legendLimit).map((item, index) => <g key={item.name} transform={`translate(0,${index * 21})`}>
          <line x1="0" x2="23" y1="0" y2="0" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? "6 5" : undefined} />
          <text x="32" y="4" className="legend-text">{item.name}</text>
        </g>)}
      </g>
      {hover && <g transform={`translate(${tooltipX},${tooltipY})`} className="plot-tooltip">
        <rect width="172" height="54" rx="7" />
        <text x="11" y="19" className="tooltip-name">{hover.name}</text>
        <text x="11" y="39" className="tooltip-value">x {formatNumber(hover.point.x, 4)}　y {formatNumber(hover.point.y, 4)}</text>
      </g>}
    </svg>
  );
}
