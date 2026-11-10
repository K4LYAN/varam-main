"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { analytics } from "@/lib/analytics";
import { GENERAL_ENQUIRY_MESSAGE } from "@/lib/whatsapp";
import { useCart } from "@/store/cart";
import { useWhatsApp } from "./SiteProvider";

export function FloatingWhatsApp() {
  const cartOpen = useCart((s) => s.isOpen);
  const pathname = usePathname();
  const { open } = useWhatsApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Product pages have their own sticky purchase bar (with a WhatsApp button) on mobile
  const onProductPage = pathname.startsWith("/oils/");

  return (
    <AnimatePresence>
      {visible && !cartOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          onClick={() => {
            analytics.whatsappContactClick("floating_button");
            open(GENERAL_ENQUIRY_MESSAGE);
          }}
          className={
            "group fixed right-4 z-40 flex h-14 items-center gap-0 rounded-full bg-[#1f7a4d] pr-[18px] pl-[17px] text-white shadow-[0_18px_40px_-12px_rgba(23,99,62,0.65)] transition-[gap,padding] duration-500 hover:gap-2.5 sm:right-6 " +
            (onProductPage ? "bottom-6 max-lg:hidden" : "bottom-5 sm:bottom-6")
          }
          aria-label="Chat with VARAM on WhatsApp"
        >
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#1f7a4d]/30 [animation-duration:2.8s]" />
          <WhatsAppIcon className="h-6 w-6" />
          <span className="max-w-0 overflow-hidden text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap uppercase transition-[max-width] duration-500 group-hover:max-w-40">
            Chat with us
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
