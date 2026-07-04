import clsx from "clsx";

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  subLabel?: string;
  colorClass?: string;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({
  value,
  max,
  label,
  subLabel,
  colorClass = "text-accent",
  size = 120,
  strokeWidth = 10,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(value / safeMax, 1);
  const offset = circumference - percent * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={clsx("transition-all duration-1000 ease-out", colorClass)}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-bold text-lg text-text leading-tight">{value}</span>
        {subLabel && <span className="text-xs text-muted leading-tight">/ {max}</span>}
        <span className="text-xs text-muted font-medium mt-1 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}
