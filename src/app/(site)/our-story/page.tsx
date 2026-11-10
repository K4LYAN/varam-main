import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Pillars } from "@/components/home/Pillars";
import { Reveal, RevealImage } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";
import { Markdown } from "@/lib/markdown";
import { getSettings } from "@/lib/data";
import { PLACEHOLDER_IMAGES } from "@/lib/defaults";

export const metadata: Metadata = {
  title: "Our Story",
  description: "The philosophy, heritage and craftsmanship behind VARAM cold-pressed oils.",
  alternates: { canonical: "/our-story" },
};

export default async function StoryPage() {
  const { story, pillars } = await getSettings();
  return (
    <>
      <PageHeader eyebrow={story.eyebrow} title={story.title} intro={story.intro} image={story.image} />

      <section className="py-24 sm:py-32 lg:py-40">
        <div className="container-luxe grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            {story.secondaryImage && (
              <RevealImage className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] lg:sticky lg:top-32">
                <Image src={story.secondaryImage} alt="" fill sizes="(min-width:1024px) 40vw, 100vw" unoptimized={!isOptimizable(story.secondaryImage)} className="object-cover" />
              </RevealImage>
            )}
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal>
              <Markdown source={story.body} className="prose-varam text-lg [&_p]:text-[1.15rem] [&_p:first-child]:font-serif [&_p:first-child]:text-3xl [&_p:first-child]:leading-snug [&_p:first-child]:text-ink" />
            </Reveal>
            {story.quote && (
              <Reveal delay={0.1}>
                <blockquote className="mt-14 border-t border-line pt-10 font-serif text-4xl leading-tight text-brand italic sm:text-5xl">
                  “{story.quote}”
                </blockquote>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <Pillars pillars={pillars} image={PLACEHOLDER_IMAGES.goldenBowl} />

      <section className="py-24 text-center sm:py-32">
        <Reveal className="container-luxe flex flex-col items-center">
          <p className="eyebrow">Taste the difference</p>
          <h2 className="display mt-5 max-w-3xl text-5xl sm:text-7xl">
            Bring VARAM <span className="italic text-brand">into your kitchen.</span>
          </h2>
          <div className="mt-10 flex flex-col gap-3 xs:flex-row">
            <Link href="/oils" className="btn btn-primary">
              Explore our oils <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/our-process" className="btn btn-outline">
              See our process
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
