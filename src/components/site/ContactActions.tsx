"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { analytics } from "@/lib/analytics";
import { useWhatsApp } from "./SiteProvider";

const TOPICS = [
  { id: "order", label: "Place an order", text: "Hello VARAM Team! I would like to place an order." },
  { id: "product", label: "Product question", text: "Hello VARAM Team! I have a question about one of your oils." },
  { id: "bulk", label: "Bulk / gifting", text: "Hello VARAM Team! I'd like to enquire about bulk or gifting orders." },
  { id: "delivery", label: "Delivery", text: "Hello VARAM Team! I have a question about delivery to my area." },
  { id: "other", label: "Something else", text: "Hello VARAM Team! " },
];

export function ContactActions() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const { open, configured } = useWhatsApp();
  return (
    <div className="rounded-[1.75rem] bg-brand-900 p-7 text-ivory sm:p-10">
      <p className="eyebrow text-accent-300">Message us on WhatsApp</p>
      <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">How can we help?</h2>
      <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={topic.id === t.id}
            onClick={() => setTopic(t)}
            className={clsx(
              "min-h-10 rounded-full border px-4 text-[12px] font-medium transition",
              topic.id === t.id ? "border-accent bg-accent text-brand-950" : "border-ivory/20 text-ivory/80 hover:border-ivory/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-6 rounded-xl bg-ivory/5 p-4 text-sm text-ivory/70 italic">“{topic.text.trim()}”</p>
      <button
        onClick={() => {
          analytics.whatsappContactClick(`contact_page_${topic.id}`);
          open(topic.text);
        }}
        className="btn btn-whatsapp mt-6 w-full sm:w-auto"
      >
        <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp
      </button>
      {!configured && process.env.NODE_ENV !== "production" && (
        <p className="mt-3 text-xs text-accent-300">Dev note: set the WhatsApp business number in Admin → Content.</p>
      )}
    </div>
  );
}
