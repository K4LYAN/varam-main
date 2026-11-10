import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { ProcessStory } from "@/components/home/ProcessStory";
import { Ingredients } from "@/components/home/Ingredients";
import { Reveal } from "@/components/ui/Reveal";
import { getSettings } from "@/lib/data";
import { PLACEHOLDER_IMAGES } from "@/lib/defaults";

export const metadata: Metadata = {
  title: "Our Process — Traditional Cold-Press Extraction",
  description: "How VARAM cold-pressed oils are made: from selecting the seed to slow pressing, natural settling and bottling.",
  alternates: { canonical: "/our-process" },
};

export default async function ProcessPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        eyebrow="Our process"
        title={
          <>
            The patient art of <span className="italic text-accent-300">cold-pressing.</span>
          </>
        }
        intro="Cold-pressing draws oil from seeds slowly, without the high heat used in refining. It takes longer — and that is the point."
        image={settings.process[1]?.image || PLACEHOLDER_IMAGES.heroPour}
      />
      <section className="py-24 sm:py-32 lg:py-40">
        <div className="container-luxe">
          <ProcessStory steps={settings.process} />
        </div>
      </section>
      <div className="border-t border-line bg-cream/40">
        <Ingredients items={settings.ingredients} />
      </div>
      <section className="py-24 text-center sm:py-32">
        <Reveal className="container-luxe flex flex-col items-center">
          <h2 className="display max-w-3xl text-5xl sm:text-7xl">
            From the press <span className="italic text-brand">to your table.</span>
          </h2>
          <Link href="/oils" className="btn btn-primary mt-10">
            Shop the collection <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
