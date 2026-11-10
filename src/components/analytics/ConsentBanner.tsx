"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useConsent } from "@/store/consent";
import { useHydrated } from "@/lib/useHydrated";

export function ConsentBanner({ enabled }: { enabled: boolean }) {
  const { analytics, bannerOpen, setAnalytics } = useConsent();
  const hydrated = useHydrated();
  const show = enabled && hydrated && (analytics === null || bannerOpen);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
          role="dialog"
          aria-label="Cookie preferences"
          className="fixed inset-x-3 bottom-3 z-[60] sm:right-auto sm:bottom-6 sm:left-6 sm:max-w-md"
        >
          <div className="rounded-2xl border border-line bg-ivory/95 p-5 shadow-[0_30px_60px_-25px_rgba(31,33,23,0.45)] backdrop-blur-xl">
            <p className="font-serif text-xl">A note on cookies</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              With your permission we use Google Analytics to understand how visitors use our website. We never share your
              name, number or order details with it.{" "}
              <Link href="/policies/privacy" className="underline underline-offset-2 hover:text-ink">
                Privacy policy
              </Link>
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setAnalytics("granted")} className="btn btn-primary min-h-10 flex-1 px-4 py-2">
                Accept
              </button>
              <button onClick={() => setAnalytics("denied")} className="btn btn-outline min-h-10 flex-1 px-4 py-2">
                Decline
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  const openBanner = useConsent((s) => s.openBanner);
  return (
    <button onClick={openBanner} className={className}>
      Cookie preferences
    </button>
  );
}
