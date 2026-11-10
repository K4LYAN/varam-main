import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Google reviews via the official Google Places API (New).
 *
 * Configure (server-side only):
 *   GOOGLE_PLACES_API_KEY  — API key with "Places API (New)" enabled
 *   GOOGLE_PLACE_ID        — optional; if missing the place is found by GOOGLE_PLACE_QUERY
 *   GOOGLE_PLACE_QUERY     — optional; defaults to "VARAM ORGANIC OIL Vijayawada"
 *
 * Results are cached for 12 hours, so the API is called at most a few times a day.
 * Google returns up to 5 reviews. Without a key, the site shows the rating summary
 * saved in Admin → Website content → Google reviews.
 */

export type GoogleReview = {
  author: string;
  authorUrl: string | null;
  photo: string | null;
  rating: number;
  text: string;
  relativeTime: string;
};

export type GoogleReviewsResult = {
  rating: number | null;
  count: number | null;
  mapsUrl: string | null;
  writeUrl: string | null;
  reviews: GoogleReview[];
};

type ApiPlace = {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
};

const FIELDS = ["id", "rating", "userRatingCount", "googleMapsUri", "reviews"];

async function fetchPlace(): Promise<GoogleReviewsResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const headers = { "X-Goog-Api-Key": key, "Content-Type": "application/json" };

  try {
    let place: ApiPlace | undefined;
    if (placeId) {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
        headers: { ...headers, "X-Goog-FieldMask": FIELDS.join(",") },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Places API ${res.status}`);
      place = (await res.json()) as ApiPlace;
    } else {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": FIELDS.map((f) => `places.${f}`).join(",") },
        body: JSON.stringify({ textQuery: process.env.GOOGLE_PLACE_QUERY || "VARAM ORGANIC OIL Vijayawada", languageCode: "en" }),
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Places API ${res.status}`);
      place = ((await res.json()) as { places?: ApiPlace[] }).places?.[0];
    }
    if (!place) return null;

    return {
      rating: place.rating ?? null,
      count: place.userRatingCount ?? null,
      mapsUrl: place.googleMapsUri ?? null,
      writeUrl: place.id ? `https://search.google.com/local/writereview?placeid=${place.id}` : null,
      reviews: (place.reviews ?? [])
        .map((r) => ({
          author: r.authorAttribution?.displayName ?? "Google user",
          authorUrl: r.authorAttribution?.uri ?? null,
          photo: r.authorAttribution?.photoUri ?? null,
          rating: r.rating ?? 0,
          text: (r.text?.text || r.originalText?.text || "").trim(),
          relativeTime: r.relativePublishTimeDescription ?? "",
        }))
        .filter((r) => r.text),
    };
  } catch (err) {
    console.error("[google-reviews]", (err as Error).message);
    return null;
  }
}

export const getGoogleReviews = unstable_cache(fetchPlace, ["google-reviews-v1"], {
  revalidate: 60 * 60 * 12,
  tags: ["google-reviews"],
});
