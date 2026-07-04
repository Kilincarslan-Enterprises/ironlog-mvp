import type { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  /** Optional header title rendered above the body. */
  title?: ReactNode;
  /** Optional secondary line under the title. */
  subtitle?: ReactNode;
  /** Optional action node rendered on the right of the header (e.g. a button or link). */
  action?: ReactNode;
  /** Card body content. */
  children?: ReactNode;
  /** Extra classes for the outer card surface. */
  className?: string;
  /** Extra classes for the body wrapper. */
  bodyClassName?: string;
  /** Make the whole card pressable (renders a div with hover/active states). */
  interactive?: boolean;
}

/**
 * Reusable surface container.
 * Uses design-system tokens (card / border) and rounded-2xl corners.
 */
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  interactive = false,
}: CardProps) {
  const showHeader = title || subtitle || action;

  return (
    <div
      className={clsx(
        "bg-card rounded-2xl border border-border transition-colors",
        interactive && "hover:bg-card-hover active:scale-[0.98] cursor-pointer",
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-bold text-text-strong truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-muted mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={clsx(showHeader ? "px-4 pb-4" : "p-4", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

export default Card;