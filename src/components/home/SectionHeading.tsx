import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import { Reveal } from "@/components/ui/Reveal";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  link,
  align = "left",
  tone = "dark",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  link?: { href: string; label: string };
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-6",
        align === "center" ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <Reveal className={clsx(align === "center" ? "max-w-3xl" : "max-w-2xl")}>
        <p className={clsx("eyebrow", tone === "light" && "text-accent-300")}>{eyebrow}</p>
        <h2 className={clsx("display mt-4 text-[2.75rem] sm:text-6xl lg:text-7xl", tone === "light" ? "text-ivory" : "text-ink")}>{title}</h2>
        {intro && <p className={clsx("mt-5 text-[15px] leading-relaxed", tone === "light" ? "text-ivory/70" : "text-muted")}>{intro}</p>}
      </Reveal>
      {link && (
        <Reveal delay={0.1}>
          <Link
            href={link.href}
            className={clsx(
              "group inline-flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] uppercase",
              tone === "light" ? "text-ivory" : "text-brand",
            )}
          >
            <span className="link-underline pb-1">{link.label}</span>
            <span className="grid h-10 w-10 place-items-center rounded-full border border-current transition duration-500 group-hover:bg-brand group-hover:text-ivory">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </Reveal>
      )}
    </div>
  );
}
