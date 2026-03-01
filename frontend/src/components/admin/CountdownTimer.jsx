/**
 * Professional circular countdown timer (Days / Hours / Minutes or Hours / Minutes / Seconds).
 * Gradient progress arcs, dotted rings, large numbers. Use on admin pages for "Next ETL run" etc.
 */
import React from 'react';

const SEGMENT_COLORS = {
  primary: 'url(#countdown-gradient-primary)',
  secondary: 'url(#countdown-gradient-secondary)',
};

const CircleSegment = ({ value, max, label, size = 'md', strokeWidth = 8 }) => {
  const safeMax = Math.max(1, Number(max) || 1);
  const v = Math.max(0, Number(value) || 0);
  const progress = Math.min(1, v / safeMax);
  const radius = size === 'sm' ? 28 : size === 'lg' ? 52 : 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={radius * 2 + strokeWidth * 2}
          height={radius * 2 + strokeWidth * 2}
          className="transform -rotate-90"
          aria-hidden
        >
          <defs>
            <linearGradient id="countdown-gradient-primary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(199, 89%, 48%)" />
              <stop offset="100%" stopColor="hsl(262, 83%, 58%)" />
            </linearGradient>
            <linearGradient id="countdown-gradient-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(199, 89%, 48%)" />
              <stop offset="100%" stopColor="hsl(262, 83%, 58%)" />
            </linearGradient>
          </defs>
          {/* Dotted circle (track) */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${strokeWidth * 0.8} ${strokeWidth * 1.2}`}
            className="text-border opacity-80"
          />
          {/* Progress arc */}
          {progress > 0 && (
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke={SEGMENT_COLORS.primary}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          )}
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-foreground font-bold tabular-nums"
          style={{
            fontSize: size === 'sm' ? '0.95rem' : size === 'lg' ? '1.75rem' : '1.35rem',
          }}
        >
          {String(Math.floor(v)).padStart(2, '0')}
        </span>
      </div>
      <span
        className="text-muted-foreground font-medium capitalize"
        style={{ fontSize: size === 'sm' ? '0.65rem' : size === 'lg' ? '0.9rem' : '0.75rem' }}
      >
        {label}
      </span>
    </div>
  );
};

/**
 * @param {number} seconds - Total seconds remaining (can be 0 or null)
 * @param {string} [title] - Optional title above the circles (e.g. "Countdown Timer", "Next ETL run")
 * @param {'sm'|'md'|'lg'} [size] - Ring size
 * @param {boolean} [compact] - If true, single row, no title; for sidebar
 */
const CountdownTimer = ({ seconds, title = 'Countdown Timer', size = 'md', compact = false }) => {
  const sec = seconds != null ? Math.max(0, Math.floor(Number(seconds))) : 0;

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  const showDays = days > 0;
  const strokeWidth = size === 'sm' ? 5 : size === 'lg' ? 10 : 8;

  if (compact) {
    if (sec <= 0) {
      return (
        <div className="py-2 text-center">
          <span className="text-sm font-medium text-muted-foreground">Running soon…</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
        {showDays ? (
          <>
            <CircleSegment value={days} max={99} label="Days" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={hours} max={23} label="Hours" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={minutes} max={59} label="Min" size={size} strokeWidth={strokeWidth} />
          </>
        ) : (
          <>
            <CircleSegment value={hours} max={23} label="Hours" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={minutes} max={59} label="Min" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={secs} max={59} label="Sec" size={size} strokeWidth={strokeWidth} />
          </>
        )}
      </div>
    );
  }

  if (sec <= 0) {
    return (
      <div className="rounded-xl border border-border bg-card/95 p-4 sm:p-5 shadow-sm">
        {title && (
          <h3 className="text-center text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
            {title}
          </h3>
        )}
        <p className="text-center text-muted-foreground font-medium">Running soon…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/95 p-4 sm:p-5 shadow-sm">
      {title && (
        <h3 className="text-center text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
          {title}
        </h3>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        {showDays ? (
          <>
            <CircleSegment value={days} max={99} label="Days" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={hours} max={23} label="Hours" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={minutes} max={59} label="Minutes" size={size} strokeWidth={strokeWidth} />
          </>
        ) : (
          <>
            <CircleSegment value={hours} max={23} label="Hours" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={minutes} max={59} label="Minutes" size={size} strokeWidth={strokeWidth} />
            <CircleSegment value={secs} max={59} label="Seconds" size={size} strokeWidth={strokeWidth} />
          </>
        )}
      </div>
    </div>
  );
};

export default CountdownTimer;
