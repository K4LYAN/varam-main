/**
 * Central application configuration.
 * Every value comes from environment variables so that nothing business-
 * specific is hard-coded across the codebase. The WhatsApp number can also
 * be changed from the admin dashboard (Content → Contact), which overrides
 * the environment fallback below.
 */

export const siteConfig = {
  name: "VARAM",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  defaultTitle: "VARAM Organic Oil — Cold-Pressed Oils & Ghee | Nature's Purity. Pressed with Tradition.",
  defaultDescription:
    "Discover VARAM Organic Oil — traditionally extracted cold-pressed groundnut, sesame, coconut, mustard, sunflower and castor oils, and pure ghee. Order easily on WhatsApp.",
  currency: "INR" as const,
  locale: "en_IN",
};

/** Fallback WhatsApp business number (digits only, with country code). */
export const envWhatsAppNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

export const analyticsConfig = {
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  /**
   * Analytics only runs in production builds unless explicitly enabled, which
   * keeps development traffic out of the production GA4 property.
   */
  enabled:
    process.env.NEXT_PUBLIC_GA_ENABLED === "true" ||
    (process.env.NEXT_PUBLIC_GA_ENABLED !== "false" && process.env.NODE_ENV === "production"),
  debug: process.env.NEXT_PUBLIC_GA_DEBUG === "true",
};
