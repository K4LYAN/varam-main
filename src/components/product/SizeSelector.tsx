"use client";

import { clsx } from "clsx";
import type { Variant } from "@/lib/types";

export function SizeSelector({
  variants,
  value,
  onChange,
  size = "sm",
  name,
}: {
  variants: Variant[];
  value: string;
  onChange: (id: string) => void;
  size?: "sm" | "lg";
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={`Bottle size for ${name}`} className="flex flex-wrap gap-1.5">
      {variants.map((v) => {
        const selected = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!v.available}
            onClick={() => onChange(v.id)}
            className={clsx(
              "rounded-full border font-semibold tracking-[0.06em] transition duration-300",
              size === "lg" ? "min-h-11 px-5 text-[13px]" : "min-h-8 px-3 text-[11px]",
              selected
                ? "border-brand bg-brand text-ivory"
                : "border-line bg-transparent text-ink/75 hover:border-brand/50 hover:text-ink",
              !v.available && "cursor-not-allowed line-through opacity-40",
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
