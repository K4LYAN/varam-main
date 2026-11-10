import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";

export function PageHeader({
  eyebrow,
  title,
  intro,
  image,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  image?: string;
}) {
  if (image) {
    return (
      <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-brand-950 text-ivory">
        <Image src={image} alt="" fill priority sizes="100vw" unoptimized={!isOptimizable(image)} className="-z-10 object-cover opacity-80" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-950/90 via-brand-950/30 to-brand-950/50" />
        <div className="container-luxe pt-24 pb-14 sm:pb-20">
          <Reveal>
            <p className="eyebrow text-accent-300">{eyebrow}</p>
            <h1 className="display mt-5 max-w-4xl text-[3.25rem] sm:text-7xl lg:text-8xl">{title}</h1>
            {intro && <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/80">{intro}</p>}
          </Reveal>
        </div>
      </section>
    );
  }
  return (
    <section className="pt-16 pb-12 sm:pt-24 sm:pb-16">
      <div className="container-luxe">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-5 max-w-4xl text-[3.25rem] sm:text-7xl lg:text-8xl">{title}</h1>
          {intro && <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">{intro}</p>}
        </Reveal>
      </div>
    </section>
  );
}
