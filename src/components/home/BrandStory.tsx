import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, RevealImage } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";
import type { SiteSettings } from "@/lib/types";

export function BrandStory({ story }: { story: SiteSettings["story"] }) {
  return (
    <section className="relative overflow-hidden bg-cream py-24 sm:py-32 lg:py-40">
      <div className="container-luxe grid items-center gap-16 lg:grid-cols-12">
        <div className="relative lg:col-span-6">
          <RevealImage className="relative aspect-[4/5] w-[82%] overflow-hidden rounded-[1.5rem]">
            {story.image && (
              <Image src={story.image} alt="" fill sizes="(min-width:1024px) 40vw, 80vw" unoptimized={!isOptimizable(story.image)} className="object-cover" />
            )}
          </RevealImage>
          {story.secondaryImage && (
            <RevealImage delay={0.25} className="absolute right-0 -bottom-10 aspect-square w-[46%] overflow-hidden rounded-[1.25rem] border-[6px] border-cream shadow-2xl sm:-bottom-14">
              <Image src={story.secondaryImage} alt="" fill sizes="(min-width:1024px) 22vw, 45vw" unoptimized={!isOptimizable(story.secondaryImage)} className="object-cover" />
            </RevealImage>
          )}
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <Reveal>
            <p className="eyebrow">{story.eyebrow}</p>
            <h2 className="display mt-5 text-5xl sm:text-6xl">{story.title}</h2>
            <p className="mt-8 text-lg leading-relaxed text-ink/80">{story.intro}</p>
          </Reveal>
          {story.quote && (
            <Reveal delay={0.1}>
              <blockquote className="mt-10 border-l-2 border-accent pl-6 font-serif text-3xl leading-snug text-brand italic">
                “{story.quote}”
              </blockquote>
            </Reveal>
          )}
          <Reveal delay={0.2}>
            <Link href="/our-story" className="btn btn-outline mt-12 text-brand">
              Read our story <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
