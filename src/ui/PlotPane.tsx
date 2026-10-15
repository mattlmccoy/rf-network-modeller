import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { type Complex, isFiniteC } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { gammaFromZ } from '../io/sweep.ts';
import type { PaneMode } from '../app/state.ts';
import { type RectQuantity, type XY, rectValue, rxExtent, smithXY, spanIndices, windowOutline, dbRange } from '../app/plotmath.ts';

/** `clamped[i]`: the measured branch is read outside its sweep at f[i]; drawn faint and dashed (spec §4). */
export interface Trace { key: string; label: string; color: string; f: number[]; z: Complex[]; role: 'primary' | 'variant' | 'measured'; clamped?: boolean[] }
export interface Dot { key: string; z: Complex; color: string }
type Span = 'zoom' | 'full';
interface Area { x: number; y: number; w: number; h: number }
interface DrawInput { mode: PaneMode; traces: Trace[]; dots: Dot[]; aitWindow: Window; dark: boolean; span: Span }

const ZOOM: [number, number] = [10e6, 17e6];
const F0 = 13.56e6;
const CYAN = '#009d9a';
const RED = '#d7191c';
const LABELS: Record<PaneMode, string> = { smith: 'Smith chart (S11)', s11db: '|S11| (dB)', rx: 'R and X (Ω), chosen cable assumption', vswr: 'VSWR' };
const order = (t: Trace): number => (t.role === 'variant' ? 0 : t.role === 'measured' ? 1 : 2);
const widthOf = (t: Trace): number => (t.role === 'primary' ? 2 : 1.2);
/** Legend order: the chosen variant first (it must never be the entry clipped at the edge), then the others, then the measurement. */
const legendRank = (t: Trace): number => (t.role === 'primary' ? 0 : t.role === 'variant' ? 1 : 2);
/** Split a trace's points into its normal part and its clamped part (plus neighbours, so the two parts join). */
const isClamped = (t: Trace, i: number): boolean => Boolean(t.clamped?.[i]);
const nearClamped = (t: Trace, i: number): boolean => isClamped(t, i) || isClamped(t, i - 1) || isClamped(t, i + 1);
const hasClamped = (t: Trace): boolean => Boolean(t.clamped?.some(Boolean));
/** True when no point of the trace inside the span is a finite impedance (an open or invalid network). */
const allOpen = (t: Trace, lo: number, hi: number): boolean => spanIndices(t.f, lo, hi).every((i) => !isFiniteC(t.z[i]));

function strokePath(ctx: CanvasRenderingContext2D, pts: XY[], color: string, width: number, dashed: boolean, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([5, 3]);
  ctx.beginPath();
  let on = false;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      on = false;
      continue;
    }
    if (on) ctx.lineTo(p.x, p.y);
    else {
      ctx.moveTo(p.x, p.y);
      on = true;
    }
  }
  ctx.stroke();
  ctx.restore();
}

function legend(ctx: CanvasRenderingContext2D, items: { label: string; color: string; dashed: boolean }[], x0: number, text: string, width: number): void {
  let x = x0;
  for (const it of items) {
    strokePath(ctx, [{ x, y: 8 }, { x: x + 14, y: 8 }], it.color, 2, it.dashed);
    ctx.fillStyle = text;
    ctx.fillText(it.label, x + 18, 11);
    x += 26 + ctx.measureText(it.label).width;
    if (x > width - 40) break;
  }
}

function drawSmith(ctx: CanvasRenderingContext2D, p: DrawInput, traces: Trace[], lo: number, hi: number, area: Area, grid: string): void {
  const radius = Math.min(area.w, area.h) * 0.48;
  const cx0 = area.x + area.w / 2;
  const cy0 = area.y + area.h / 2;
  ctx.strokeStyle = p.dark ? '#5f6268' : '#a7a7a7';
  ctx.beginPath(); ctx.arc(cx0, cy0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx0 - radius, cy0); ctx.lineTo(cx0 + radius, cy0); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx0, cy0, radius, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = grid;
  for (const r of [0.2, 0.5, 1, 2, 5]) { ctx.beginPath(); ctx.arc(cx0 + (radius * r) / (1 + r), cy0, radius / (1 + r), 0, Math.PI * 2); ctx.stroke(); }
  for (const x of [0.2, 0.5, 1, 2, 5]) for (const sign of [1, -1]) { ctx.beginPath(); ctx.arc(cx0 + radius, cy0 + (sign * radius) / x, radius / x, 0, Math.PI * 2); ctx.stroke(); }
  const win = windowOutline(p.aitWindow).map((g) => smithXY(g, cx0, cy0, radius));
  ctx.beginPath();
  win.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(241,213,28,0.30)';
  ctx.fill();
  ctx.strokeStyle = '#aa9710';
  ctx.stroke();
  const nan: XY = { x: Number.NaN, y: Number.NaN };
  for (const t of traces) {
    const idx = spanIndices(t.f, lo, hi);
    strokePath(ctx, idx.map((i) => (isClamped(t, i) ? nan : smithXY(gammaFromZ(t.z[i]), cx0, cy0, radius))), t.color, widthOf(t), t.role === 'measured');
    if (hasClamped(t)) strokePath(ctx, idx.map((i) => (nearClamped(t, i) ? smithXY(gammaFromZ(t.z[i]), cx0, cy0, radius) : nan)), t.color, 1, true, 0.45);
  }
  for (const d of p.dots) {
    const q = smithXY(gammaFromZ(d.z), cx0, cy0, radius);
    ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = p.dark ? '#17181a' : '#ffffff'; ctx.stroke();
  }
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, p: DrawInput, traces: Trace[], lo: number, hi: number, area: Area, grid: string, text: string, W: number, H: number): void {
  type Line = { pts: { f: number; v: number }[]; color: string; width: number; dashed: boolean; alpha: number };
  const lines: Line[] = [];
  let min = -40;
  let max = 0;
  let unit = 'dB';
  const push = (t: Trace, q: RectQuantity, color: string): void => {
    const idx = spanIndices(t.f, lo, hi);
    const value = (i: number): number => rectValue(q, t.z[i]);
    lines.push({ pts: idx.map((i) => ({ f: t.f[i], v: isClamped(t, i) ? Number.NaN : value(i) })), color, width: widthOf(t), dashed: t.role === 'measured', alpha: 1 });
    if (hasClamped(t)) lines.push({ pts: idx.map((i) => ({ f: t.f[i], v: nearClamped(t, i) ? value(i) : Number.NaN })), color, width: 1, dashed: true, alpha: 0.45 });
  };
  if (p.mode === 's11db' || p.mode === 'vswr') {
    if (p.mode === 'vswr') { min = 1; max = 10; unit = 'VSWR'; }
    for (const t of traces) push(t, p.mode, t.color);
    if (p.mode === 's11db') [min, max] = dbRange(lines.flatMap((l) => l.pts.map((q) => q.v)));
  } else {
    unit = 'Ω';
    for (const t of traces.filter((x) => x.role !== 'variant')) {
      push(t, 'r', CYAN);
      push(t, 'x', RED);
    }
    const ext = rxExtent(lines.flatMap((l) => l.pts.map((q) => q.v)));
    min = -ext;
    max = ext;
  }
  const X = (f: number): number => area.x + (area.w * (f - lo)) / Math.max(1, hi - lo);
  const Y = (v: number): number => area.y + (area.h * (max - Math.max(min, Math.min(max, v)))) / (max - min);
  ctx.strokeStyle = grid;
  ctx.fillStyle = text;
  for (let i = 0; i <= 5; i += 1) {
    const y = area.y + (area.h * i) / 5;
    ctx.beginPath(); ctx.moveTo(area.x, y); ctx.lineTo(area.x + area.w, y); ctx.stroke();
    const v = max - ((max - min) * i) / 5;
    ctx.fillText(v.toFixed(Math.abs(max - min) < 20 ? 1 : 0), 4, y + 3);
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = area.x + (area.w * i) / 5;
    ctx.beginPath(); ctx.moveTo(x, area.y); ctx.lineTo(x, area.y + area.h); ctx.stroke();
    ctx.fillText(`${((lo + ((hi - lo) * i) / 5) / 1e6).toFixed(1)} MHz`, Math.min(W - 52, x - 18), H - 8);
  }
  if (F0 >= lo && F0 <= hi) {
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#aa9710';
    ctx.beginPath(); ctx.moveTo(X(F0), area.y); ctx.lineTo(X(F0), area.y + area.h); ctx.stroke(); ctx.restore();
  }
  for (const l of lines) strokePath(ctx, l.pts.map((q) => ({ x: X(q.f), y: Y(q.v) })), l.color, l.width, l.dashed, l.alpha);
  if (p.mode !== 'rx') {
    for (const d of p.dots) {
      const v = rectValue(p.mode === 's11db' ? 's11db' : 'vswr', d.z);
      if (!Number.isFinite(v)) continue;
      ctx.beginPath(); ctx.arc(X(F0), Y(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = d.color; ctx.fill();
    }
  }
  ctx.fillStyle = text;
  ctx.fillText(unit, 4, area.y - 6);
}

function draw(canvas: HTMLCanvasElement, p: DrawInput): void {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.floor(box.width * ratio);
  canvas.height = Math.floor(box.height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  const W = box.width;
  const H = box.height;
  const grid = p.dark ? '#4a4c50' : '#c8c8c8';
  const text = p.dark ? '#d9d9d5' : '#333333';
  ctx.fillStyle = p.dark ? '#17181a' : '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '10px Arial, sans-serif';
  ctx.lineWidth = 1;
  if (!p.traces.length) {
    ctx.fillStyle = text;
    ctx.fillText('No prediction: see the message above the plots.', 12, 24);
    return;
  }
  const lo = p.span === 'zoom' ? ZOOM[0] : Math.min(...p.traces.map((t) => t.f[0]));
  const hi = p.span === 'zoom' ? ZOOM[1] : Math.max(...p.traces.map((t) => t.f[t.f.length - 1]));
  const traces = [...p.traces].sort((a, b) => order(a) - order(b));
  const area: Area = { x: 46, y: 20, w: W - 60, h: H - 48 };
  if (p.mode === 'smith') drawSmith(ctx, p, traces, lo, hi, area, grid);
  else drawRect(ctx, p, traces, lo, hi, area, grid, text, W, H);
  const items = p.mode === 'rx'
    ? [{ label: 'R', color: CYAN, dashed: false }, { label: 'X', color: RED, dashed: false }, ...(traces.some((t) => t.role === 'measured') ? [{ label: 'measured', color: text, dashed: true }] : []),
      ...(traces.some((t) => t.role === 'primary' && allOpen(t, lo, hi)) ? [{ label: 'open: no finite R or X', color: text, dashed: false }] : [])]
    : [...traces].sort((a, b) => legendRank(a) - legendRank(b)).map((t) => ({ label: `${t.label}${allOpen(t, lo, hi) ? ' (open)' : ''}`, color: t.color, dashed: t.role === 'measured' }));
  legend(ctx, items, p.mode === 'smith' ? 8 : 46, text, W);
}

export function PlotPane({ mode, traces, dots, aitWindow, theme, onMode }: { mode: PaneMode; traces: Trace[]; dots: Dot[]; aitWindow: Window; theme: 'light' | 'dark'; onMode: (m: PaneMode) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [span, setSpan] = useState<Span>('zoom');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const o = new ResizeObserver(() => setTick((t) => t + 1));
    o.observe(c);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (ref.current) draw(ref.current, { mode, traces, dots, aitWindow, dark: theme === 'dark', span });
  }, [mode, traces, dots, aitWindow, theme, span, tick]);
  return (
    <section className="chart-panel" style={{ '--chart-height': '330px' } as CSSProperties}>
      <div className="chart-titlebar">
        <select value={mode} onChange={(e) => onMode(e.target.value as PaneMode)} aria-label="Plot">
          {(Object.keys(LABELS) as PaneMode[]).map((m) => <option key={m} value={m}>{LABELS[m]}</option>)}
        </select>
        <select value={span} onChange={(e) => setSpan(e.target.value as Span)} aria-label="Frequency span">
          <option value="zoom">10–17 MHz</option>
          <option value="full">Full span</option>
        </select>
      </div>
      <div className="chart-plot"><canvas className="trace-canvas" ref={ref} aria-label={LABELS[mode]} /></div>
    </section>
  );
}
