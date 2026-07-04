import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Optional footer area (e.g. action buttons). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Bottom-sheet style modal overlay optimized for mobile.
 * Slides up from the bottom, traps scroll, closes on backdrop / Escape.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Dialog"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Sheet */}
      <div
        className={clsx(
          "relative bg-card border-t border-border rounded-t-2xl shadow-2xl",
          "animate-[modalSlideUp_220ms_ease-standard]",
          "pb-safe",
          className,
        )}
      >
        {/* Grabber handle */}
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {(title || true) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-muted">
            <h2 className="text-base font-bold text-text-strong truncate">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card-hover transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="px-4 py-4 max-h-[70dvh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-4 py-3 border-t border-border-muted">{footer}</div>
        )}
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(100%); opacity: 0.4; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default Modal;