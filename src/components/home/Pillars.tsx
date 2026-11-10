import Image from "next/image";
import { Droplets, Hand, Leaf, Package, Sprout, Sun, Wheat } from "lucide-react";
import { Reveal, RevealImage } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";
import { SectionHeading } from "./SectionHeading";

const ICONS = [Droplets, Sprout, Leaf, Hand, Package, Sun, Wheat];

export function Pillars({ pillars, image }: { pillars: { title: string; text: string }[]; image: string }) {
  if (!pillars.length) return null;
  return (
    <section className="relative overflow-hidden bg-brand-900 py-24 text-ivory sm:py-32 lg:py-40">
      <div className="container-luxe">
        <SectionHeading
          tone="light"
          eyebrow="Why choose VARAM"
          title={
            <>
              Made the slow way, <span className="italic text-accent-300">on purpose.</span>
            </>
          }
          intro="Every decision we make — from the seed we choose to the bottle we fill — is guided by one idea: keep the oil honest."
        />

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <RevealImage className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] lg:sticky lg:top-32">
              <Image src={image} alt="" fill sizes="(min-width:1024px) 40vw, 100vw" unoptimized={!isOptimizable(image)} className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/50 to-transparent" />
            </RevealImage>
          </div>
          <ol className="lg:col-span-7">
            {pillars.map((p, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <Reveal as="li" key={p.title} delay={i * 0.05} className="group grid grid-cols-[auto_1fr] gap-6 border-t border-ivory/12 py-8 sm:gap-10 sm:py-10 last:border-b">
                  <div className="flex flex-col items-center gap-4">
                    <span className="font-serif text-sm text-accent-300 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-ivory/15 text-accent-300 transition duration-700 group-hover:border-accent group-hover:bg-accent group-hover:text-brand-950">
                      <Icon className="h-5 w-5" strokeWidth={1.3} />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-serif text-3xl sm:text-4xl">{p.title}</h3>
                    <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ivory/65">{p.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
