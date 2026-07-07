'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

interface SalesChartProps {
  data: { date: string; value: number }[];
  title?: string;
  className?: string;
}

export function SalesChart({ data, title = 'Vendas', className }: SalesChartProps) {
  return (
    <div className={cn('bento-card p-5 sm:p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Evolução do período selecionado</p>
        </div>
      </div>
      <div className="h-[280px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0057FF" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0057FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                background: '#ffffff',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0057FF"
              strokeWidth={2.5}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
