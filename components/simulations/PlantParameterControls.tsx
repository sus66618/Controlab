export function PlantNumberField({ label, value, min, max, step = "any", onChange }: { label: string; value: number; min?: number; max?: number; step?: number | "any"; onChange: (value: number) => void }) {
  return <label className="plant-number"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function finiteNumber(value: number, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
export function positiveNumber(value: number, minimum: number) { return Number.isFinite(value) ? Math.max(minimum, value) : minimum; }
