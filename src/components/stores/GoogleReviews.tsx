/* eslint-disable @next/next/no-img-element -- Google profile photos are served from many Google hosts */
import { ExternalLink, PenLine } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { getGoogleReviews, type GoogleReview } from "@/lib/googleReviews";
import type { SiteSettings, Testimonial } from "@/lib/types";
import { getPublishedTestimonials } from "@/lib/data";

function fromSaved(t: Testimonial): GoogleReview {
  return { author: t.name, authorUrl: null, photo: null, rating: t.rating, text: t.quote, relativeTime: t.date || t.location };
}

export function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className={className} aria-hidden="true">
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#fbbc04" />
                <stop offset={`${fill * 100}%`} stopColor="#e3d6c3" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#star-${i}-${Math.round(fill * 100)})`}
              d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L10 14.8l-5.4 2.9 1.2-5.9L1.4 7.7l6-.7L10 1.5z"
            />
          </svg>
        );
      })}
    </span>
  );
}

/**
 * Google reviews: live reviews from the Google Places API when configured,
 * otherwise the saved rating summary with links to Google.
 */
export async function GoogleReviews({ settings, className }: { settings: SiteSettings; className?: string }) {
  const [live, saved] = await Promise.all([getGoogleReviews(), getPublishedTestimonials()]);
  const rating = live?.rating ?? settings.reviews.rating;
  const count = live?.count ?? settings.reviews.count;
  const url = live?.mapsUrl || settings.reviews.url;
  const writeUrl = live?.writeUrl || settings.reviews.writeUrl;
  // Live reviews from the Google Places API, or Google reviews added in the admin
  const reviews = live?.reviews.length ? live.reviews : saved.filter((t) => t.source === "google").map(fromSaved);
  if (!rating && !reviews.length) return null;

  return (
    <section className={className} aria-labelledby="google-reviews-title">
      <div className="container-luxe">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-6">
            <p className="eyebrow">Reviews from Google</p>
            <h2 id="google-reviews-title" className="display mt-4 text-5xl sm:text-6xl">
              Loved in <span className="italic text-brand">Vijayawada.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6 lg:justify-self-end">
            <div className="flex flex-wrap items-center gap-5 rounded-[1.5rem] border border-line bg-white/70 p-5 sm:p-6">
              <GoogleG className="h-12 w-12" />
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-5xl leading-none">{rating.toFixed(1)}</span>
                  <Stars value={rating} className="h-5 w-5" />
                </div>
                <p className="mt-1 text-sm text-muted">Based on {count} Google review{count === 1 ? "" : "s"}</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline min-h-10 px-4 py-2 text-[10.5px]">
                    Read on Google <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {(writeUrl || url) && (
                  <a href={writeUrl || url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-10 px-4 py-2 text-[10.5px]">
                    <PenLine className="h-3.5 w-3.5" /> Write a review
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        {reviews.length > 0 && (
          <div className="scrollbar-none -mx-4 mt-12 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
            {reviews.map((r, i) => (
              <Reveal
                key={`${r.author}-${i}`}
                delay={i * 0.06}
                className="flex w-[82vw] shrink-0 snap-start flex-col rounded-[1.5rem] border border-line bg-white p-6 xs:w-[60vw] sm:w-[44vw] lg:w-auto"
              >
                <div className="flex items-center gap-3">
                  {r.photo ? (
                    <img src={r.photo} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-cream font-semibold text-brand">{r.author.charAt(0)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    {r.authorUrl ? (
                      <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold hover:underline">
                        {r.author}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-semibold">{r.author}</p>
                    )}
                    <p className="text-xs text-muted">{r.relativeTime}</p>
                  </div>
                  <GoogleG className="h-5 w-5" />
                </div>
                <Stars value={r.rating} className="mt-4 h-4 w-4" />
                <p className="mt-3 line-clamp-6 text-[15px] leading-relaxed text-ink/80">{r.text}</p>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
