import type { TestAttempt } from '../types';

interface GrowthChartProps {
  attempts: TestAttempt[];
}

export function GrowthChart({ attempts }: GrowthChartProps) {
  const ordered = [...attempts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (ordered.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
        Hali grafik uchun test natijalari yoʻq
      </div>
    );
  }

  const width = 640;
  const height = 210;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = ordered.map((att, index) => {
    const x =
      ordered.length === 1
        ? padLeft + plotW / 2
        : padLeft + (index / (ordered.length - 1)) * plotW;
    const y = padTop + plotH - (att.percentage / 100) * plotH;
    return { x, y, att };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[360px] h-52 select-none"
        role="img"
        aria-label="Test natijalari oʻsish grafigi"
      >
        <defs>
          <linearGradient id="growthAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padTop + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeDasharray={tick === 0 ? undefined : '4 4'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[11px] tabular-nums"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Area & Line */}
        {areaPath && <path d={areaPath} fill="url(#growthAreaGrad)" />}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((p, idx) => (
          <g key={p.att.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4.5}
              className="fill-white dark:fill-slate-900 stroke-sky-600"
              strokeWidth="2.5"
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              className="fill-slate-700 dark:fill-slate-200 text-[11px] font-semibold tabular-nums"
            >
              {p.att.percentage}%
            </text>
            {(ordered.length <= 12 || idx === 0 || idx === ordered.length - 1 || idx % 2 === 0) && (
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] tabular-nums"
              >
                U{p.att.unitId}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
