import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

type AccentTone = "accent" | "success" | "danger" | "warning";

interface QuickActionProps {
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Label shown under / beside the icon. */
  label: string;
  /** Tap handler. */
  onPress: () => void;
  /** Optional secondary description. */
  description?: string;
  /** Color tone for the icon chip. */
  tone?: AccentTone;
  /** Optional trailing node (e.g. a chevron or status badge). */
  trailing?: ReactNode;
  /** Render as a full-width stacked tile (icon on top). Defaults to row layout. */
  stacked?: boolean;
  /** Disable interaction. */
  disabled?: boolean;
  className?: string;
}

const toneChip: Record<AccentTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning/10 text-warning",
};

/**
 * One-tap action button with an icon chip + label.
 * Touch target is at least 44px tall; accessible as a real <button>.
 */
export function QuickAction({
  icon: Icon,
  label,
  onPress,
  description,
  tone = "accent",
  trailing,
  stacked = false,
  disabled = false,
  className,
}: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        "w-full text-left bg-card border border-border rounded-2xl",
        "transition-[background-color,transform,border-color] duration-150 ease-standard",
        "min-h-[44px] active:scale-[0.98]",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-card-hover hover:border-border-muted",
        stacked ? "flex flex-col items-center gap-2 p-4" : "flex items-center gap-3 p-3",
        className,
      )}
    >
      <span
        className={clsx(
          "flex items-center justify-center rounded-xl shrink-0",
          stacked ? "p-3" : "p-2.5",
          toneChip[tone],
        )}
      >
        <Icon size={stacked ? 24 : 20} aria-hidden="true" />
      </span>
      <span className={clsx("min-w-0 flex-1", stacked ? "text-center" : "")}>
        <span className="block font-semibold text-text-strong text-sm truncate">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-muted truncate mt-0.5">
            {description}
          </span>
        )}
      </span>
      {trailing && !stacked && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

export default QuickAction;