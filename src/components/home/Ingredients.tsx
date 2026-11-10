import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";
import { SectionHeading } from "./SectionHeading";

export function Ingredients({ items }: { items: { name: string; text: string; image: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="py-24 sm:py-32 lg:py-40">
      <div className="container-luxe">
        <SectionHeading
          eyebrow="Our ingredients"
          title={
            <>
              It all begins <span className="italic text-brand">with the seed.</span>
            </>
          }
          intro="Good oil cannot be made from ordinary ingredients. These are the seeds and nuts behind our range."
        />
      </div>
      <div className="scrollbar-none mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:px-8 lg:mt-20 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible container-luxe">
        {items.map((it, i) => (
          <Reveal
            key={`${it.name}-${i}`}
            delay={i * 0.08}
            className="group relative aspect-[3/4.4] w-[78vw] shrink-0 snap-start overflow-hidden rounded-[1.5rem] bg-brand-900 xs:w-[60vw] sm:w-[42vw] lg:w-auto"
          >
            {it.image && (
              <Image
                src={it.image}
                alt={it.name}
                fill
                sizes="(min-width:1024px) 25vw, 80vw"
                unoptimized={!isOptimizable(it.image)}
                className="object-cover transition-transform duration-[1.6s] ease-[var(--ease-luxe)] group-hover:scale-110"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-ivory sm:p-7">
              <span className="font-serif text-sm text-accent-300">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 font-serif text-4xl">{it.name}</h3>
              <p className="mt-2 max-w-[22ch] text-sm leading-relaxed text-ivory/75">{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
