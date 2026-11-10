"use client";

import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { analytics } from "@/lib/analytics";
import { GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";
import { useWhatsApp } from "./SiteProvider";

export function FooterWhatsApp() {
  const { open } = useWhatsApp();
  return (
    <button
      onClick={() => {
        analytics.whatsappContactClick("footer");
        open(GENERAL_ENQUIRY_MESSAGE);
      }}
      className="inline-flex items-center gap-2 text-ivory hover:text-accent-300"
    >
      <WhatsAppIcon className="h-4 w-4" /> Chat on WhatsApp
    </button>
  );
}
