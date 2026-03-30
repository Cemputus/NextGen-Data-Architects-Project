
import React, { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import {
  defaultGrid,
  defaultTooltip,
  defaultTextStyle,
  UCU_COLORS,
} from '../../lib/chartTheme';
import { chartEmptyStateClass } from '../../lib/analytics-ui';
import { cn } from '../../lib/utils';

function barColorForScore(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return UCU_COLORS.navy;
  if (s >= 80) return UCU_COLORS.green;
  if (s >= 70) return UCU_COLORS.cyan;
  if (s >= 60) return UCU_COLORS.gold;
  return UCU_COLORS.maroon;
}

export function StudentGradesByCourseChart({ rows = [], className }) {
  const { option, count } = useMemo(() => {
    const list = (rows || [])
      .map((r) => {
        const code = String(r.course_code ?? '').trim() || '—';
        const name = String(r.course_name ?? '').trim();
        const semName = String(r.semester_name ?? '').trim();
        const semId = r.semester_id;
        const semPart =
          semName ||
          (semId != null && semId !== '' ? `Semester ${semId}` : 'Semester —');
        const label = `${code} · ${semPart}`;
        const avg = Number(r.avg_grade);
        const avgSafe = Number.isFinite(avg) ? Math.min(100, Math.max(0, avg)) : null;
        return {
          label,
          shortLabel: label.length > 42 ? `${label.slice(0, 39)}…` : label,
          avg_grade: avgSafe,
          letter_grade: r.letter_grade != null ? String(r.letter_grade) : '',
          course_name: name,
          completed_exams: Number(r.completed_exams) || 0,
          total_attempts: Number(r.total_attempts) || 0,
        };
      })
      .filter((r) => r.avg_grade != null);

    const labels = list.map((r) => r.shortLabel);
    const values = list.map((r) => r.avg_grade);

    const tooltipRows = list;

    return {
      count: list.length,
      option: {
        grid: { ...defaultGrid, left: 8, right: 24, top: 16, bottom: 24, containLabel: true },
        tooltip: {
          ...defaultTooltip,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const arr = Array.isArray(params) ? params : [params];
            const p0 = arr[0];
            const idx = p0?.dataIndex ?? 0;
            const row = tooltipRows[idx];
            if (!row) return '';
            const title = row.label;
            const lines = [
              row.course_name ? `<div style="opacity:.9">${row.course_name}</div>` : '',
              `Avg score: <strong>${row.avg_grade?.toFixed(2) ?? '—'}</strong>`,
              row.letter_grade ? `Letter: <strong>${row.letter_grade}</strong>` : '',
              `Completed attempts: ${row.completed_exams}`,
            ].filter(Boolean);
            return `<div style="max-width:280px">${title}<br/>${lines.join('<br/>')}</div>`;
          },
        },
        xAxis: {
          type: 'value',
          name: 'Avg score',
          min: 0,
          max: 100,
          nameTextStyle: defaultTextStyle,
          axisLabel: defaultTextStyle,
          splitLine: { lineStyle: { type: 'dashed', opacity: 0.35 } },
        },
        yAxis: {
          type: 'category',
          data: labels,
          inverse: true,
          axisLabel: {
            ...defaultTextStyle,
            width: 200,
            overflow: 'truncate',
            ellipsis: '…',
          },
          axisTick: { alignWithLabel: true },
        },
        series: [
          {
            name: 'Avg grade',
            type: 'bar',
            data: values,
            barMaxWidth: 22,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: (params) => barColorForScore(params.value),
            },
            label: {
              show: list.length <= 20,
              position: 'right',
              ...defaultTextStyle,
              formatter: (p) => (p.value != null ? Number(p.value).toFixed(1) : ''),
            },
          },
        ],
      },
    };
  }, [rows]);

  if (!count) {
    return (
      <div
        className={cn(
          chartEmptyStateClass,
          'min-h-[280px] flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground',
          className
        )}
      >
        <span>No graded courses to show yet.</span>
        <span className="text-xs max-w-md">
          This chart uses <code className="text-[11px] bg-muted px-1 rounded">fact_grade</code> rows with
          completed attempts, grouped by course and semester. Load student analytics to populate it.
        </span>
      </div>
    );
  }

  const minH = Math.min(520, Math.max(280, 48 + count * 36));

  return (
    <BaseChart
      option={option}
      minHeight={minH}
      maxHeight={560}
      className={className}
    />
  );
}
