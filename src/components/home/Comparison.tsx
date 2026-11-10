import { Check, Minus } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

const ROWS: [string, string, string][] = [
  ["How oil is drawn", "Seeds are pressed slowly by mechanical pressure", "Usually extracted with high heat and chemical solvents"],
  ["Temperature", "Kept low throughout pressing", "High temperatures during extraction and processing"],
  ["After extraction", "Left to settle naturally, then filtered", "Bleached and deodorised to strip colour and smell"],
  ["Colour & aroma", "Natural colour and aroma of the seed", "Pale, neutral and largely odourless"],
  ["Sediment", "Natural sediment may appear — a sign it is unrefined", "Fully clarified"],
];

export function Comparison() {
  return (
    <section className="bg-cream/60 py-24 sm:py-32">
      <div className="container-luxe">
        <SectionHeading
          align="center"
          eyebrow="Cold-pressed vs refined"
          title={
            <>
              Know what&apos;s <span className="italic text-brand">in your kitchen.</span>
            </>
          }
          intro="Most supermarket oils are refined. Here is how traditional cold-pressing is different."
        />
        <Reveal className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-[1.5rem] border border-line bg-ivory">
          <div className="grid grid-cols-[1fr_1fr] text-[11px] font-semibold tracking-[0.18em] uppercase sm:grid-cols-[0.8fr_1fr_1fr]">
            <div className="hidden px-6 py-5 text-muted sm:block" />
            <div className="bg-brand px-5 py-5 text-ivory sm:px-6">VARAM cold-pressed</div>
            <div className="px-5 py-5 text-muted sm:px-6">Typical refined oil</div>
          </div>
          {ROWS.map(([label, ours, theirs]) => (
            <div key={label} className="grid grid-cols-[1fr_1fr] border-t border-line sm:grid-cols-[0.8fr_1fr_1fr]">
              <div className="col-span-2 px-5 pt-4 font-serif text-xl sm:col-span-1 sm:px-6 sm:py-5">{label}</div>
              <div className="flex gap-2.5 bg-brand/[0.04] px-5 py-4 text-sm leading-relaxed text-ink sm:px-6 sm:py-5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                {ours}
              </div>
              <div className="flex gap-2.5 px-5 py-4 text-sm leading-relaxed text-muted sm:px-6 sm:py-5">
                <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                {theirs}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
