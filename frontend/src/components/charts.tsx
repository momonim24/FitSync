import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { DailyActivity } from '../api/types';
import { shortDate } from '../lib/format';

/** Single-series charts: one lime hue, recessive grid/axes, hover tooltips. */
const MARK = '#a3e635';
const GRID = '#2a2e36';
const AXIS = { fill: '#6f7682', fontSize: 12 };

function ChartTooltip({ active, payload, label, unit, labelFormat }: Partial<TooltipContentProps<number, string>> & { unit: string; labelFormat?: (v: string) => string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-lg shadow-black/40">
      <p className="text-muted">{labelFormat ? labelFormat(String(label)) : String(label)}</p>
      <p className="mt-0.5 font-semibold text-ink">
        {value} {unit}
      </p>
    </div>
  );
}

/** Minutes trained per day (bar per day). */
export function ActivityChart({ data, metric = 'minutes' }: { data: DailyActivity[]; metric?: 'minutes' | 'workouts' }) {
  const total = data.reduce((sum, d) => sum + d[metric], 0);
  return (
    <figure>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit={metric === 'minutes' ? 'min' : 'workouts'} labelFormat={shortDate} />} />
            <Bar dataKey={metric} fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {metric === 'minutes' ? 'Minutes trained' : 'Workouts logged'} per day over the last {data.length} days, {total} in total.
      </figcaption>
    </figure>
  );
}

/** Body-weight trend line. */
export function WeightChart({ data }: { data: { date: string; weightKg: number }[] }) {
  const values = data.map((d) => d.weightKg);
  // Evenly spaced whole-number ticks around the data range.
  const spread = Math.max(...values) - Math.min(...values);
  const step = spread > 12 ? 5 : spread > 5 ? 2 : 1;
  const min = Math.floor((Math.min(...values) - step / 2) / step) * step;
  const max = Math.ceil((Math.max(...values) + step / 2) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  return (
    <figure>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis domain={[min, max]} ticks={ticks} tick={AXIS} axisLine={false} tickLine={false} width={44} />
            <Tooltip cursor={{ stroke: '#3a3f49' }} content={<ChartTooltip unit="kg" labelFormat={shortDate} />} />
            <Line
              type="monotone"
              dataKey="weightKg"
              stroke={MARK}
              strokeWidth={2}
              dot={{ r: 4, fill: MARK, stroke: '#16181c', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: MARK, stroke: '#16181c', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Weight trend from {values[0]} kg to {values[values.length - 1]} kg across {data.length} measurements.
      </figcaption>
    </figure>
  );
}

/** Vertical bars over labelled periods (days or months) — used by reports. */
export function PeriodBarChart({ data, unit, labelFormat }: { data: { label: string; value: number }[]; unit: string; labelFormat?: (v: string) => string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <figure>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickFormatter={labelFormat} tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit={unit} labelFormat={labelFormat} />} />
            <Bar dataKey="value" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {total} {unit} across {data.length} periods.
      </figcaption>
    </figure>
  );
}

/** Horizontal bars for ranked categories (e.g. workouts per category). */
export function RankedBars({ data, labelKey, valueKey, unit }: { data: Record<string, string | number>[]; labelKey: string; valueKey: string; unit: string }) {
  const height = Math.max(160, data.length * 40);
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={labelKey} tick={{ ...AXIS, fill: '#a3a9b5' }} axisLine={false} tickLine={false} width={120} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit={unit} />} />
            <Bar dataKey={valueKey} fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d[labelKey]}: ${d[valueKey]} ${unit}`).join(', ')}
      </figcaption>
    </figure>
  );
}
