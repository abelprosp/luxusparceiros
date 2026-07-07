import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@luxus/utils';
import { spacing, typography } from '@/theme';

interface ChartDataPoint {
  date?: string;
  month?: string;
  value: number;
  label?: string;
}

interface SalesChartProps {
  data: ChartDataPoint[];
  height?: number;
  type?: 'line' | 'bar';
  labelKey?: 'date' | 'month' | 'label';
}

const CHART_WIDTH = Dimensions.get('window').width - spacing.md * 4;

export function SalesChart({
  data,
  height = 160,
  type = 'line',
  labelKey = 'date',
}: SalesChartProps) {
  const { colors } = useTheme();

  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: colors.textSecondary }}>Sem dados para exibir</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const chartWidth = CHART_WIDTH - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;
    return { x, y, value: d.value, label: d[labelKey] ?? '' };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {type === 'line' ? (
          <>
            <Path d={areaPath} fill="url(#gradient)" />
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.primary} />
            ))}
          </>
        ) : (
          points.map((p, i) => {
            const barWidth = chartWidth / data.length - 8;
            const barHeight = ((p.value - minValue) / range) * chartHeight;
            return (
              <Path
                key={i}
                d={`M ${p.x - barWidth / 2} ${padding.top + chartHeight} L ${p.x - barWidth / 2} ${padding.top + chartHeight - barHeight} L ${p.x + barWidth / 2} ${padding.top + chartHeight - barHeight} L ${p.x + barWidth / 2} ${padding.top + chartHeight} Z`}
                fill={colors.primaryLight}
              />
            );
          })
        )}
      </Svg>

      <View style={styles.labels}>
        {points.filter((_, i) => i === 0 || i === points.length - 1 || points.length <= 5).map((p, i) => (
          <Text key={i} style={[styles.label, { color: colors.textSecondary }]}>
            {p.label}
          </Text>
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {formatCurrency(values.reduce((a, b) => a + b, 0))}
        </Text>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total no período</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typography.caption,
  },
  summary: {
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    ...typography.h3,
  },
  summaryLabel: {
    ...typography.caption,
  },
});
