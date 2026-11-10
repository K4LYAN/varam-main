"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Info, X } from "lucide-react";
import { useToast } from "@/store/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-[80] flex flex-col items-center gap-2 px-4 sm:top-24"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-ivory/95 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(31,33,23,0.35)] backdrop-blur"
            role="status"
          >
            <span
              className={
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full " +
                (t.tone === "warning" ? "bg-copper/15 text-copper" : "bg-brand text-ivory")
              }
            >
              {t.tone === "warning" ? <Info className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.description}</p>}
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 text-[11px] font-semibold tracking-[0.16em] text-brand uppercase underline-offset-4 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
