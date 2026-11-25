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
          <CartesianGrid stroke="#333333" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#B5B5B5', fontSize: 12 }}
            axisLine={{ stroke: '#444444' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#8A8A8A', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: '#161616',
              border: '1px solid #444444',
              borderRadius: 2,
              color: '#DADADA',
              fontSize: 12,
            }}
            labelStyle={{ color: '#DADADA' }}
            itemStyle={{ color: '#DADADA' }}
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
              style={{ fill: '#DADADA', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
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
