"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Testimonial } from "@/lib/types";

/** Shows only genuine testimonials added by the business in the admin dashboard. */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n, paused]);

  if (!n) return null;
  const t = items[i];

  return (
    <section
      className="py-24 sm:py-32 lg:py-40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      <div className="container-luxe text-center">
        <p className="eyebrow">Kind words</p>
        <div className="relative mx-auto mt-10 min-h-[260px] max-w-4xl sm:min-h-[240px]">
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 font-serif text-[9rem] leading-none text-accent/25 select-none" aria-hidden="true">
            “
          </span>
          <AnimatePresence mode="wait">
            <motion.figure
              key={t.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="font-serif text-3xl leading-snug text-ink sm:text-[2.6rem]">{t.quote}</blockquote>
              <figcaption className="mt-8 text-[12px] font-semibold tracking-[0.2em] text-muted uppercase">
                {t.name}
                {t.location && <span className="text-accent"> · {t.location}</span>}
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
        {n > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button onClick={() => setI((v) => (v - 1 + n) % n)} className="grid h-11 w-11 place-items-center rounded-full border border-line hover:border-brand" aria-label="Previous testimonial">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-2">
              {items.map((x, idx) => (
                <button
                  key={x.id}
                  onClick={() => setI(idx)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${idx === i ? "w-8 bg-brand" : "w-1.5 bg-line"}`}
                  aria-label={`Show testimonial ${idx + 1}`}
                  aria-current={idx === i}
                />
              ))}
            </div>
            <button onClick={() => setI((v) => (v + 1) % n)} className="grid h-11 w-11 place-items-center rounded-full border border-line hover:border-brand" aria-label="Next testimonial">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
