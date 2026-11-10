"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { isOptimizable } from "@/components/product/ProductImage";
import { useIntro } from "@/store/intro";

const ease = [0.22, 1, 0.36, 1] as const;

function splitHeadline(text: string): [string, string] {
  const parts = text.split(/(?<=\.)\s+/);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
  return [text, ""];
}

export function Hero({
  eyebrow,
  headline,
  subtext,
  image,
  imageAlt,
}: {
  eyebrow: string;
  headline: string;
  subtext: string;
  image: string;
  imageAlt: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [line1, line2] = splitHeadline(headline);
  const ready = useIntro((s) => s.ready);

  const words = (line: string, offset: number, italic = false) =>
    line.split(" ").map((w, i) => (
      <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
        <motion.span
          className={italic ? "inline-block italic text-accent-300" : "inline-block"}
          initial={{ y: "110%" }}
          animate={ready ? { y: "0%" } : { y: "110%" }}
          transition={{ duration: 1.25, ease, delay: 0.15 + (offset + i) * 0.07 }}
        >
          {w}
          {" "}
        </motion.span>
      </span>
    ));

  return (
    <section ref={ref} className="relative isolate h-[100svh] min-h-[640px] overflow-hidden bg-brand-950 text-ivory">
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10 origin-center">
        <motion.div
          initial={{ scale: 1.12, opacity: 0 }}
          animate={ready ? { scale: 1, opacity: 1 } : { scale: 1.12, opacity: 0 }}
          transition={{ duration: 2.4, ease }}
          className="absolute inset-0"
        >
          {image && (
            <Image
              src={image}
              alt={imageAlt}
              fill
              priority
              sizes="100vw"
              unoptimized={!isOptimizable(image)}
              className="object-cover object-center"
            />
          )}
        </motion.div>
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(28,14,5,0.5)_0%,rgba(28,14,5,0.12)_35%,rgba(28,14,5,0.35)_65%,rgba(28,14,5,0.9)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_80%,rgba(28,14,5,0.55),transparent_60%)]" />

      <motion.div style={{ opacity: fade }} className="container-luxe flex h-full flex-col justify-end pb-24 sm:pb-20 lg:pb-24">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 1, ease, delay: 0.2 }}
          className="eyebrow text-accent-300"
        >
          {eyebrow}
        </motion.p>
        <h1 className="display mt-5 max-w-5xl text-[3.4rem] xs:text-[4rem] sm:text-[5.5rem] lg:text-[7.5rem] xl:text-[8.5rem]">
          <span className="block">{words(line1, 0)}</span>
          {line2 && <span className="block">{words(line2, line1.split(" ").length, true)}</span>}
        </h1>
        <div className="mt-8 flex flex-col gap-8">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.1, ease, delay: 0.8 }}
            className="max-w-md text-[15px] leading-relaxed text-ivory/80 sm:text-base"
          >
            {subtext}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 1.1, ease, delay: 0.95 }}
            className="flex flex-col gap-3 xs:flex-row"
          >
            <Link href="/oils" className="btn btn-accent">
              Explore Our Oils <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/our-story" className="btn btn-ghost-light">
              Discover Our Story
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-ivory/60 uppercase lg:flex"
        aria-hidden="true"
      >
        Scroll
        <span className="relative h-12 w-px overflow-hidden bg-ivory/20">
          <motion.span
            className="absolute inset-x-0 top-0 h-1/2 bg-accent-300"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </motion.div>
    </section>
  );
}
