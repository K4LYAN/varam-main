import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.defaultTitle,
    template: "%s | VARAM Cold-Pressed Oils",
  },
  description: siteConfig.defaultDescription,
  applicationName: "VARAM",
  openGraph: {
    type: "website",
    siteName: "VARAM",
    locale: siteConfig.locale,
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fffaf1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${cormorant.variable} ${manrope.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Skip the loading screen on repeat page views in this session (runs before paint) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(sessionStorage.getItem('varam-loaded'))document.documentElement.classList.add('vl-done')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh bg-ivory text-ink">
        {children}
        {/* Vercel Web Analytics — cookieless page-view stats, only active when deployed on Vercel */}
        <Analytics />
      </body>
    </html>
  );
}
