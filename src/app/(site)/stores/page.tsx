import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { StoreCard } from "@/components/stores/StoreCard";
import { GoogleReviews } from "@/components/stores/GoogleReviews";
import { JsonLd } from "@/components/site/JsonLd";
import { Reveal } from "@/components/ui/Reveal";
import { getSettings } from "@/lib/data";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Our Stores — Visit VARAM in Vijayawada",
  description:
    "Visit the VARAM Organic Oil (గానుగ నూనె) store on BRTS Road, Lakshmi Nagar, Satyanarayana Puram, Vijayawada. Open every day, 8 AM – 9:30 PM. Directions, phone and Google reviews.",
  alternates: { canonical: "/stores" },
};

export default async function StoresPage() {
  const settings = await getSettings();
  const { stores } = settings;

  return (
    <>
      {stores.map((s) => (
        <JsonLd
          key={s.name}
          data={{
            "@context": "https://schema.org",
            "@type": "Store",
            name: s.name,
            url: `${siteConfig.url}/stores`,
            address: s.address,
            ...(s.phone ? { telephone: s.phone } : {}),
            ...(s.mapsUrl ? { hasMap: s.mapsUrl } : {}),
            image: `${siteConfig.url}/brand/varam-logo.jpg`,
          }}
        />
      ))}
      <PageHeader
        eyebrow="Our stores"
        title={
          <>
            Come say <span className="italic text-brand">namaste.</span>
          </>
        }
        intro="See, smell and taste our oils in person. Our team will help you choose — or order on WhatsApp and we'll arrange delivery."
      />
      <section className="pb-20">
        <div className="container-luxe space-y-8">
          {stores.length ? (
            stores.map((s, i) => (
              <Reveal key={`${s.name}-${i}`}>
                <StoreCard store={s} mapFirst={i % 2 === 0} />
              </Reveal>
            ))
          ) : (
            <p className="text-muted">Store details coming soon.</p>
          )}
        </div>
      </section>
      <GoogleReviews settings={settings} className="border-t border-line bg-cream/50 py-24 sm:py-28" />
    </>
  );
}
