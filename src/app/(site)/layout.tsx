import { MotionProvider } from "@/components/ui/MotionProvider";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CartDrawer } from "@/components/site/CartDrawer";
import { CartSync } from "@/components/site/CartSync";
import { FloatingWhatsApp } from "@/components/site/FloatingWhatsApp";
import { SiteProvider } from "@/components/site/SiteProvider";
import { Toaster } from "@/components/site/Toaster";
import { Preloader } from "@/components/site/Preloader";
import { Assistant } from "@/components/assistant/Assistant";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { getCategories, getProducts, getSettings, toPublicSettings } from "@/lib/data";
import { analyticsConfig } from "@/lib/config";

// Storefront pages read live catalogue data (cached and invalidated on admin edits).
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, products] = await Promise.all([getSettings(), getCategories(), getProducts()]);
  const gaActive = analyticsConfig.enabled && Boolean(analyticsConfig.measurementId);

  return (
    <SiteProvider value={toPublicSettings(settings)}>
      <MotionProvider>
        <Preloader />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer settings={settings} categories={categories} />
        <CartDrawer />
        <CartSync />
        <FloatingWhatsApp />
        <Assistant products={products} />
        <Toaster />
        <ConsentBanner enabled={gaActive} />
        {gaActive && <GoogleAnalytics measurementId={analyticsConfig.measurementId} debug={analyticsConfig.debug} />}
      </MotionProvider>
    </SiteProvider>
  );
}
