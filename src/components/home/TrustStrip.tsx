import { Droplets, Leaf, MessageCircle, Truck } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

const ITEMS = [
  { Icon: Droplets, title: "Traditionally cold-pressed", text: "Slow pressing, natural settling" },
  { Icon: Leaf, title: "Pure · Natural · Traditional", text: "Oils and ghee for the Indian kitchen" },
  { Icon: MessageCircle, title: "Order on WhatsApp", text: "Personal, human confirmation" },
  { Icon: Truck, title: "Clear delivery charges", text: "Confirmed before you pay" },
];

export function TrustStrip() {
  return (
    <section aria-label="Why shop with VARAM" className="border-b border-line bg-ivory">
      <div className="container-luxe grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4 lg:py-12">
        {ITEMS.map(({ Icon, title, text }, i) => (
          <Reveal key={title} delay={i * 0.06} className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-brand">
              <Icon className="h-5 w-5" strokeWidth={1.4} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink sm:text-sm">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
