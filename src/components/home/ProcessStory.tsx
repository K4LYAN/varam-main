"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clsx } from "clsx";
import { isOptimizable } from "@/components/product/ProductImage";

type Step = { title: string; text: string; image: string };

/**
 * Scroll-driven process story (GSAP ScrollTrigger).
 * Desktop: the image column stays pinned while each step scrolls past and
 * cross-fades the matching photograph; a progress rule fills as you read.
 * Mobile: steps stack with their own images.
 */
export function ProcessStory({ steps, heading }: { steps: Step[]; heading?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-step]");
      items.forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => self.isActive && setActive(i),
        });
        if (!reduce) {
          gsap.fromTo(
            el.querySelectorAll("[data-animate]"),
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 1.1,
              ease: "power3.out",
              stagger: 0.08,
              scrollTrigger: { trigger: el, start: "top 80%" },
            },
          );
        }
      });
      if (progress.current) {
        gsap.fromTo(
          progress.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: "[data-steps]", start: "top 55%", end: "bottom 55%", scrub: true },
          },
        );
      }
    }, root);
    return () => ctx.revert();
  }, [steps.length]);

  if (!steps.length) return null;

  return (
    <div ref={root} className="grid gap-16 lg:grid-cols-2 lg:gap-24">
      <div className="hidden lg:block">
        <div className="sticky top-28 aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-brand-900">
          {steps.map((s, i) => (
            <div
              key={`${s.title}-${i}`}
              className={clsx(
                "absolute inset-0 transition-[opacity,transform] duration-[1.4s] ease-[var(--ease-luxe)]",
                i === active ? "scale-100 opacity-100" : "scale-[1.06] opacity-0",
              )}
            >
              {s.image && (
                <Image src={s.image} alt={s.title} fill sizes="45vw" unoptimized={!isOptimizable(s.image)} className="object-cover" />
              )}
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 font-serif text-ivory">
            <span className="text-7xl leading-none tabular-nums">{String(active + 1).padStart(2, "0")}</span>
            <span className="ml-2 text-xl text-ivory/60">/ {String(steps.length).padStart(2, "0")}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        {heading && <div className="mb-16 lg:mb-24">{heading}</div>}
        <div data-steps className="relative pl-10 sm:pl-14">
          <span className="absolute top-0 bottom-0 left-[7px] w-px bg-line" aria-hidden="true" />
          <span ref={progress} className="absolute top-0 bottom-0 left-[7px] w-px origin-top bg-accent" aria-hidden="true" />
          {steps.map((s, i) => (
            <div key={`${s.title}-${i}`} data-step className="relative pb-20 last:pb-0 lg:min-h-[52vh]">
              <span
                className={clsx(
                  "absolute top-2 -left-10 h-[15px] w-[15px] rounded-full border-2 transition-colors duration-700 sm:-left-14",
                  i <= active ? "border-accent bg-accent" : "border-line bg-ivory",
                )}
                aria-hidden="true"
              />
              <p data-animate className="eyebrow">
                Step {String(i + 1).padStart(2, "0")}
              </p>
              <h3 data-animate className="display mt-4 text-4xl sm:text-5xl">
                {s.title}
              </h3>
              <p data-animate className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                {s.text}
              </p>
              {s.image && (
                <div data-animate className="relative mt-8 aspect-[4/3] overflow-hidden rounded-2xl lg:hidden">
                  <Image src={s.image} alt={s.title} fill sizes="100vw" unoptimized={!isOptimizable(s.image)} className="object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
