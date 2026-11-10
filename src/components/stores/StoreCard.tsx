import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { clsx } from "clsx";
import type { Store } from "@/lib/types";

export const directionsUrl = (s: Store) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.mapQuery || s.address)}`;

export const embedUrl = (s: Store) =>
  `https://www.google.com/maps?q=${encodeURIComponent(s.mapQuery || s.address)}&z=16&output=embed`;

/** A store with an embedded Google Map, address, hours and quick actions. */
export function StoreCard({ store, className, mapFirst = true }: { store: Store; className?: string; mapFirst?: boolean }) {
  const tel = store.phone.replace(/[^+\d]/g, "");
  return (
    <article className={clsx("grid overflow-hidden rounded-[1.75rem] border border-line bg-white lg:grid-cols-2", className)}>
      <div className={clsx("relative min-h-[300px] bg-cream lg:min-h-[440px]", !mapFirst && "lg:order-2")}>
        <iframe
          title={`Map showing ${store.name}`}
          src={embedUrl(store)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0 [filter:sepia(0.25)_saturate(0.9)]"
          allowFullScreen
        />
      </div>
      <div className="flex flex-col p-7 sm:p-10">
        <p className="eyebrow">Visit our store</p>
        <h3 className="mt-4 font-serif text-4xl leading-tight">{store.name}</h3>
        <dl className="mt-8 space-y-5 text-[15px]">
          <div className="flex gap-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <dt className="sr-only">Address</dt>
              <dd className="leading-relaxed">{store.address}</dd>
            </div>
          </div>
          {store.hours && (
            <div className="flex gap-4">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt className="sr-only">Opening hours</dt>
                <dd>{store.hours}</dd>
              </div>
            </div>
          )}
          {store.phone && (
            <div className="flex gap-4">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <dt className="sr-only">Phone</dt>
                <dd>
                  <a href={`tel:${tel}`} className="hover:text-brand">
                    {store.phone}
                  </a>
                </dd>
              </div>
            </div>
          )}
        </dl>
        <div className="mt-auto flex flex-wrap gap-3 pt-10">
          <a href={directionsUrl(store)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <Navigation className="h-4 w-4" /> Get directions
          </a>
          {store.phone && (
            <a href={`tel:${tel}`} className="btn btn-outline">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
          {store.mapsUrl && (
            <a href={store.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              Google Maps
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
