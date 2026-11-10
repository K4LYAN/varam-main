"use client";

import { createContext, useCallback, useContext } from "react";
import type { PublicSettings } from "@/lib/types";
import { buildWhatsAppUrl, isWhatsAppNumberConfigured } from "@/lib/whatsapp";

const SiteContext = createContext<PublicSettings | null>(null);

export function SiteProvider({ value, children }: { value: PublicSettings; children: React.ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): PublicSettings {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>");
  return ctx;
}

/**
 * Returns a function that opens WhatsApp Click-to-Chat with a message.
 * Opens a new tab (WhatsApp Web / desktop) and falls back to same-tab
 * navigation if a popup blocker prevents it (common on mobile in-app browsers).
 */
export function useWhatsApp() {
  const { whatsappNumber } = useSite();
  const configured = isWhatsAppNumberConfigured(whatsappNumber);
  const open = useCallback(
    (message: string) => {
      const url = buildWhatsAppUrl(whatsappNumber, message);
      const win = window.open(url, "_blank");
      if (win) {
        try {
          win.opener = null;
        } catch {
          /* cross-origin — ignore */
        }
      } else {
        // Popup blocked: open in the same tab. The cart is persisted in
        // localStorage, so it is still there when the customer returns.
        window.location.href = url;
      }
      return url;
    },
    [whatsappNumber],
  );
  return { open, configured, number: whatsappNumber };
}
