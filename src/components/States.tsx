import type { ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";

/** Centered spinner with optional label. */
export function Loading({ label = "Laden…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted">
      <Loader2 size={24} className="animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Error block with a retry button. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-4">
      <AlertCircle size={28} className="text-danger" aria-hidden="true" />
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

/** Friendly empty-state. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-6">
      <p className="text-sm font-semibold text-text">{title}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}