interface TrendPoint {
  label: string
  primary: number
  secondary: number
}

interface Props {
  title: string
  description: string
  points: TrendPoint[]
  primaryLabel: string
  secondaryLabel: string
}

function buildPolyline(points: number[], chartHeight: number, maxValue: number, stepX: number): string {
  return points
    .map((value, index) => {
      const x = index * stepX
      const y = chartHeight - (value / maxValue) * chartHeight
      return `${x},${y}`
    })
    .join(' ')
}

export default function ComparisonTrendChart({
  title,
  description,
  points,
  primaryLabel,
  secondaryLabel,
}: Props) {
  const chartHeight = 82
  const chartWidth = 100
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.primary, point.secondary]))
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth
  const primaryPath = buildPolyline(points.map((point) => point.primary), chartHeight, maxValue, stepX)
  const secondaryPath = buildPolyline(points.map((point) => point.secondary), chartHeight, maxValue, stepX)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-[13px] leading-5 text-slate-500">{description}</div>
        </div>
        <div className="space-y-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
            {primaryLabel}
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            {secondaryLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 13}`}
          className="h-32 w-full overflow-visible"
          role="img"
          aria-label={`${title}: ${primaryLabel}와 ${secondaryLabel} 추이`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - chartHeight * ratio
            return (
              <line
                key={ratio}
                x1="0"
                y1={y}
                x2={chartWidth}
                y2={y}
                className="stroke-slate-200"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />
            )
          })}

          <polyline
            fill="none"
            className="stroke-slate-900"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={primaryPath}
          />
          <polyline
            fill="none"
            className="stroke-amber-500"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={secondaryPath}
          />

          {points.map((point, index) => {
            const x = index * stepX
            const primaryY = chartHeight - (point.primary / maxValue) * chartHeight
            const secondaryY = chartHeight - (point.secondary / maxValue) * chartHeight

            return (
              <g key={point.label}>
                <circle cx={x} cy={primaryY} r="1.9" className="fill-slate-900" />
                <circle cx={x} cy={secondaryY} r="1.9" className="fill-amber-500" />
                <text x={x} y={chartHeight + 10} textAnchor="middle" fontSize="4" className="fill-slate-500">
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span>0</span>
          <span>최대 {maxValue}</span>
        </div>
        <table className="sr-only">
          <caption>{title} 데이터</caption>
          <thead>
            <tr>
              <th scope="col">구간</th>
              <th scope="col">{primaryLabel}</th>
              <th scope="col">{secondaryLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`data-${point.label}`}>
                <th scope="row">{point.label}</th>
                <td>{point.primary}</td>
                <td>{point.secondary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
