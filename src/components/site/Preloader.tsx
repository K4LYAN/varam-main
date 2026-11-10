"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useIntro } from "@/store/intro";

const SESSION_KEY = "varam-loaded";
const MIN_MS = 1500;
const MAX_MS = 3000;

/**
 * Branded loading screen, shown once per browser session.
 * - Repeat page views in the same session skip it (an inline script in the
 *   root layout adds `vl-done` to <html> before paint, so there is no flash).
 * - A CSS fail-safe hides it after a few seconds even if JavaScript fails.
 */
export function Preloader() {
  const setReady = useIntro((s) => s.setReady);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("vl-done")) {
      // Already shown this session: CSS keeps it hidden; just start the page.
      setReady();
      return;
    }
    root.style.overflow = "hidden";
    const start = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      setTimeout(() => setVisible(false), wait);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    const cap = setTimeout(finish, MAX_MS);
    return () => {
      clearTimeout(cap);
      window.removeEventListener("load", finish);
    };
  }, [setReady]);

  const onExited = () => {
    document.documentElement.style.overflow = "";
    document.documentElement.classList.add("vl-done");
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode — ignore */
    }
    setReady();
  };

  return (
    <AnimatePresence onExitComplete={onExited}>
      {visible && (
        <motion.div
          id="varam-preloader"
          key="preloader"
          role="status"
          aria-label="Loading VARAM"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ivory"
          style={{ clipPath: "inset(0 0 0% 0)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-52 w-52 sm:h-64 sm:w-64"
          >
            <Image src="/brand/varam-logo.jpg" alt="VARAM Organic Oil" fill priority sizes="256px" className="object-contain mix-blend-multiply" />
          </motion.div>
          <div className="mt-8 h-px w-44 overflow-hidden bg-line">
            <motion.div
              className="h-full origin-left bg-accent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: MIN_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
            />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-5 text-[10px] font-semibold tracking-[0.4em] text-earth uppercase"
          >
            Pure · Natural · Traditional
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
