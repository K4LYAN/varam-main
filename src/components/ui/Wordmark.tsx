import { clsx } from "clsx";

/** VARAM wordmark: a seed-drop monogram with a letter-spaced serif name. */
export function Wordmark({
  className,
  tone = "dark",
  showMark = true,
  subtitle,
}: {
  className?: string;
  tone?: "dark" | "light";
  showMark?: boolean;
  subtitle?: string;
}) {
  const color = tone === "light" ? "text-ivory" : "text-brand";
  return (
    <span className={clsx("inline-flex items-center gap-2.5", color, className)}>
      {showMark && <SeedMark className="h-7 w-7 shrink-0" />}
      <span className="flex flex-col">
        <span className="font-serif text-[1.65rem] leading-none font-medium tracking-[0.32em] pl-[0.32em]">VARAM</span>
        {subtitle && (
          <span className={clsx("mt-1 pl-[0.4em] text-[8.5px] font-semibold tracking-[0.42em] uppercase", tone === "light" ? "text-accent-300" : "text-accent")}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

export function SeedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path
        d="M20 8.5c4.6 6.1 7.2 10.6 7.2 14.6a7.2 7.2 0 0 1-14.4 0c0-4 2.6-8.5 7.2-14.6Z"
        fill="#e0a12b"
      />
      <path d="M20 13.5v15.2" stroke="#faf6ee" strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
      <path d="M20 20.2c-1.9-.4-3.2-1.6-3.6-3.3M20 24.2c1.9-.4 3.2-1.6 3.6-3.3" stroke="#faf6ee" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
