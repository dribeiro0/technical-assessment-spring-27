import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LineCount } from '../../domain/counts'
import type { LineId } from '../../domain/lines'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface Props {
  counts: LineCount[]
  /** Clicking a bar opens that line on the map. */
  onPickLine: (line: LineId) => void
}

/** "Active vehicles by subway line" (R8), one bar per line in its colour. */
export function VehiclesByLineChart({ counts, onPickLine }: Props) {
  const reducedMotion = useReducedMotion()
  const data = counts.map((c) => ({ ...c, label: c.name.replace(' line', '') }))

  return (
    <div className="h-72 w-full" role="img" aria-label={describe(counts)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#E6DECF" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#3D4A60', fontSize: 12 }}
            axisLine={{ stroke: '#C6B9A1' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#6A6356', fontSize: 11, fontFamily: 'Monaspace Neon, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(29,43,68,0.05)' }}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #E6DECF',
              borderRadius: 8,
              boxShadow: '0 8px 22px rgba(29,43,68,0.15)',
              color: '#1D2B44',
              fontSize: 12,
            }}
            labelStyle={{ color: '#1D2B44' }}
            itemStyle={{ color: '#1D2B44' }}
            formatter={(value) => [`${value} vehicles`, 'Active']}
          />
          <Bar
            dataKey="count"
            isAnimationActive={!reducedMotion}
            cursor="pointer"
            onClick={(entry) => {
              const line = (entry as { payload?: { line?: LineId } }).payload?.line
              if (line) onPickLine(line)
            }}
          >
            {data.map((d) => (
              <Cell key={d.line} fill={d.color} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{ fill: '#1D2B44', fontSize: 12, fontFamily: 'Monaspace Neon, monospace' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function describe(counts: LineCount[]): string {
  return `Bar chart of active vehicles by subway line: ${counts
    .map((c) => `${c.name} ${c.count}`)
    .join(', ')}.`
}
