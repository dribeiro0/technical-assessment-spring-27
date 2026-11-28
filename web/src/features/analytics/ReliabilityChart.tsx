import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DAY_TYPE_TEXT,
  dateRangeText,
  reliabilityByHour,
  serviceOrder,
  serviceSlot,
  type DayType,
} from '../../domain/baselines'
import { LINES } from '../../domain/lines'
import { useBaselines } from '../../hooks/useHistoryStatus'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** "5a", "12p", "1a": short hour labels for the axis. */
function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'a' : 'p'}`
}

/**
 * How reliable each line is by hour (Sprint 7, B5): the share of gaps between trains no
 * more than 2 minutes longer than scheduled, EnRoute's own measure, from MBTA LAMP data
 * and always labelled with that source and its dates (B6).
 */
export function ReliabilityChart() {
  const { data: baselines, isPending, isError } = useBaselines()
  const reducedMotion = useReducedMotion()
  const [dayType, setDayType] = useState<DayType>(() => serviceSlot(Date.now()).dayType)

  const series = LINES.map((line) => ({
    line,
    rows: baselines ? reliabilityByHour(baselines, line.id, dayType) : [],
  }))
  const hours = [...new Set(series.flatMap((s) => s.rows.map((r) => r.hour)))].sort(
    (a, b) => serviceOrder(a) - serviceOrder(b),
  )
  const data = hours.map((hour) => {
    const point: Record<string, number | string> = { hour, label: hourLabel(hour) }
    for (const s of series) {
      const row = s.rows.find((r) => r.hour === hour)
      if (row) point[s.line.id] = Math.round(row.share * 100)
    }
    return point
  })

  return (
    <section
      aria-labelledby="reliability-title"
      className="border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_3px_rgb(29_43_68_/0.08)]"
    >
      <header className="border-border flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="reliability-title" className="text-fg text-sm font-semibold">
            How reliable is each line, by hour?
          </h2>
          <p className="text-fg-muted mt-0.5 text-xs">
            Share of gaps between trains no more than 2 minutes longer than scheduled (EnRoute’s
            measure).
            {baselines &&
              ` MBTA LAMP data, ${dateRangeText(baselines.source.fromDate, baselines.source.toDate)}, ${DAY_TYPE_TEXT[dayType]}.`}
          </p>
        </div>
        <div role="group" aria-label="Day type" className="flex gap-1">
          {(['weekday', 'saturday', 'sunday'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dayType === d}
              onClick={() => setDayType(d)}
              className={`h-7 rounded-md border px-2.5 text-xs ${
                dayType === d
                  ? 'border-chrome bg-chrome text-chrome-fg font-semibold'
                  : 'border-control text-fg'
              }`}
            >
              {d === 'weekday' ? 'Weekdays' : d === 'saturday' ? 'Saturdays' : 'Sundays'}
            </button>
          ))}
        </div>
      </header>

      {isPending ? (
        <p className="text-fg-muted p-4 text-xs">Loading history…</p>
      ) : isError ? (
        <p className="text-warn p-4 text-xs font-semibold">
          Reliability history is unavailable right now. Live data is not affected.
        </p>
      ) : !baselines || data.length === 0 ? (
        <p className="text-fg-muted p-4 text-xs">No reliability history has been imported yet.</p>
      ) : (
        <>
          <div className="h-72 w-full px-2 py-4 md:px-4" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                  interval={1}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {LINES.map((line) => (
                  <Line
                    key={line.id}
                    type="monotone"
                    dataKey={line.id}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={!reducedMotion}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* The same figures as a table, for screen readers. */}
          <table className="sr-only">
            <caption>
              Reliability by hour on {DAY_TYPE_TEXT[dayType]}, percent of gaps within 2 minutes of
              schedule
            </caption>
            <thead>
              <tr>
                <th scope="col">Hour</th>
                {LINES.map((l) => (
                  <th key={l.id} scope="col">
                    {l.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.hour}>
                  <th scope="row">{row.label}</th>
                  {LINES.map((l) => (
                    <td key={l.id}>{row[l.id] === undefined ? 'no data' : `${row[l.id]}%`}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
