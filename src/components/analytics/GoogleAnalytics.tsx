"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useConsent } from "@/store/consent";
import { useHydrated } from "@/lib/useHydrated";

/**
 * Loads GA4 (gtag.js) only after the visitor has accepted analytics.
 *
 * Page views: GA4 "Enhanced measurement → Page changes based on browser
 * history events" (on by default) records client-side navigations, so we do
 * not send page_view manually — that would double count.
 */
export function GoogleAnalytics({ measurementId, debug }: { measurementId: string; debug: boolean }) {
  const consent = useConsent((s) => s.analytics);
  const hydrated = useHydrated();

  // Respect a later "Decline": switch off collection for the rest of the visit.
  useEffect(() => {
    if (consent === null || typeof window === "undefined") return;
    const denied = consent === "denied";
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = denied;
    window.gtag?.("consent", "update", { analytics_storage: denied ? "denied" : "granted" });
  }, [consent, measurementId]);

  if (!hydrated || consent !== "granted" || !/^G-[A-Z0-9]+$/.test(measurementId)) return null;

  const config = JSON.stringify({
    ...(debug ? { debug_mode: true } : {}),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  return (
    <>
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());gtag('config','${measurementId}',${config});`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
    </>
  );
}
