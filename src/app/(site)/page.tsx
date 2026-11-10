import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { SectionHeading } from "@/components/home/SectionHeading";
import { Pillars } from "@/components/home/Pillars";
import { ProcessStory } from "@/components/home/ProcessStory";
import { Ingredients } from "@/components/home/Ingredients";
import { BrandStory } from "@/components/home/BrandStory";
import { Testimonials } from "@/components/home/Testimonials";
import { Gallery } from "@/components/home/Gallery";
import { OrderSteps } from "@/components/home/OrderSteps";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Comparison } from "@/components/home/Comparison";
import { Faq } from "@/components/home/Faq";
import { StoreCard } from "@/components/stores/StoreCard";
import { GoogleReviews } from "@/components/stores/GoogleReviews";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/site/JsonLd";
import { getCategories, getProducts, getPublishedTestimonials, getSettings } from "@/lib/data";
import { siteConfig } from "@/lib/config";
import { PLACEHOLDER_IMAGES } from "@/lib/defaults";

export default async function HomePage() {
  const [settings, products, categories, testimonials] = await Promise.all([
    getSettings(),
    getProducts(),
    getCategories(),
    getPublishedTestimonials(),
  ]);
  const featured = products.filter((p) => p.featured);
  const showcase = (featured.length >= 8 ? featured : [...featured, ...products.filter((p) => !p.featured)]).slice(0, 8);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "VARAM",
          url: siteConfig.url,
          slogan: settings.brand.tagline,
          description: settings.brand.description,
          ...(settings.contact.email ? { email: settings.contact.email } : {}),
          ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
          sameAs: [settings.social.instagram, settings.social.facebook, settings.social.youtube].filter(Boolean),
        }}
      />
      <Hero {...settings.hero} />
      <TrustStrip />

      <Marquee items={categories.map((c) => c.name.replace(/\s+Oils?$/i, ""))} />

      {/* Intro statement */}
      <section className="py-24 sm:py-32 lg:py-40">
        <div className="container-luxe grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-3">
            <p className="eyebrow">The VARAM way</p>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-9">
            <p className="font-serif text-[2rem] leading-[1.15] text-ink sm:text-5xl lg:text-[3.6rem]">
              {settings.brand.description}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Featured collection */}
      <section className="pb-24 sm:pb-32 lg:pb-40">
        <div className="container-luxe">
          <SectionHeading
            eyebrow="The collection"
            title={
              <>
                Pressed for <span className="italic text-brand">everyday cooking.</span>
              </>
            }
            link={{ href: "/oils", label: "View all oils" }}
          />
          <ProductGrid products={showcase} list={{ id: "home_featured", name: "Home – Featured" }} className="mt-14 lg:mt-20" />
        </div>
      </section>

      <Pillars pillars={settings.pillars} image={settings.story.image || PLACEHOLDER_IMAGES.rusticBottle} />

      <section className="py-24 sm:py-32 lg:py-40">
        <div className="container-luxe">
          <ProcessStory
            steps={settings.process}
            heading={
              <SectionHeading
                eyebrow="Our extraction process"
                title={
                  <>
                    Patience, <span className="italic text-brand">pressed.</span>
                  </>
                }
                intro="Cold-pressing is the slow, traditional way of drawing oil from seeds. Here is how a bottle of VARAM comes to be."
                link={{ href: "/our-process", label: "Explore the process" }}
                className="lg:flex-col lg:items-start"
              />
            }
          />
        </div>
      </section>

      <Comparison />
      <Ingredients items={settings.ingredients} />
      <BrandStory story={settings.story} />
      <GoogleReviews settings={settings} className="py-24 sm:py-32" />
      <Testimonials items={testimonials.filter((t) => t.source !== "google")} />
      <OrderSteps />
      {settings.stores[0] && (
        <section className="pt-24 sm:pt-32">
          <div className="container-luxe">
            <StoreCard store={settings.stores[0]} />
          </div>
        </section>
      )}
      <Faq limit={5} />
      <Gallery images={settings.gallery} social={settings.social} />
    </>
  );
}
