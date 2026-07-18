/**
 * Simple SVG HR vs time chart from Strava streams.
 * @param {{ heartrate?: number[]|null, time?: number[]|null, className?: string }} props
 */
export default function StravaHrChart({ heartrate, time, className = "" }) {
  const hr = Array.isArray(heartrate) ? heartrate.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (hr.length < 2) {
    return (
      <div
        className={`flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 ${className}`}
      >
        <p className="text-[12px] text-slate-400">Data detak jantung belum tersedia.</p>
      </div>
    );
  }

  const times = Array.isArray(time) ? time.map(Number) : [];
  const useTime = times.length === hr.length;
  const xs = useTime
    ? times
    : hr.map((_, i) => i);
  const minX = xs[0];
  const maxX = xs[xs.length - 1] || 1;
  const minY = Math.min(...hr);
  const maxY = Math.max(...hr);
  const padY = Math.max(5, (maxY - minY) * 0.08);
  const y0 = minY - padY;
  const y1 = maxY + padY;
  const w = 320;
  const h = 120;
  const left = 36;
  const right = 8;
  const top = 10;
  const bottom = 18;
  const innerW = w - left - right;
  const innerH = h - top - bottom;

  const points = hr
    .map((v, i) => {
      const x = left + ((xs[i] - minX) / Math.max(1, maxX - minX)) * innerW;
      const y = top + (1 - (v - y0) / Math.max(1, y1 - y0)) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const avg = Math.round(hr.reduce((a, b) => a + b, 0) / hr.length);

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-3 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[12px] font-bold text-slate-800">Detak jantung</p>
        <p className="text-[11px] text-slate-500">
          avg {avg} · max {Math.round(maxY)} bpm
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Grafik detak jantung">
        <line x1={left} y1={top} x2={left} y2={h - bottom} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={left} y1={h - bottom} x2={w - right} y2={h - bottom} stroke="#e2e8f0" strokeWidth="1" />
        <text x={4} y={top + 4} className="fill-slate-400" style={{ fontSize: 9 }}>
          {Math.round(maxY)}
        </text>
        <text x={4} y={h - bottom} className="fill-slate-400" style={{ fontSize: 9 }}>
          {Math.round(minY)}
        </text>
        <polyline fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" points={points} />
      </svg>
    </div>
  );
}
