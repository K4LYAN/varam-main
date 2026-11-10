import { JsonLd } from "@/components/site/JsonLd";
import { SectionHeading } from "./SectionHeading";
import { FaqList } from "./FaqList";

export const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I place an order?",
    a: "Add the oils you want to your cart, choose sizes and quantities, then tap “Order via WhatsApp”. Your order is sent to our team as a WhatsApp message, and we confirm everything with you personally.",
  },
  {
    q: "How do I pay?",
    a: "There is no online payment on this website. Once we confirm availability and delivery charges on WhatsApp, our team shares the payment details with you there.",
  },
  {
    q: "What are the delivery charges?",
    a: "Delivery charges depend on your location and order size. We confirm them on WhatsApp before your order is final, so there are no surprises.",
  },
  {
    q: "Can I order in bulk or set up a monthly supply?",
    a: "Yes. Use the VARAM assistant (the ✦ button) to share your requirements, or message us on WhatsApp with the oils and quantities you need.",
  },
  {
    q: "Why is there sediment at the bottom of the bottle?",
    a: "Cold-pressed oils are unrefined, so a little natural sediment can settle over time. This is normal. Simply store the bottle upright and pour gently.",
  },
  {
    q: "My coconut oil or ghee has turned solid. Is that okay?",
    a: "Yes — coconut oil and ghee naturally solidify in cooler weather. Keep the bottle or jar in a warm place for a while and it will turn liquid again.",
  },
  {
    q: "How should I store the oils?",
    a: "Keep them in a cool, dry place away from direct sunlight, and close the cap tightly after use. The shelf life is printed on every pack.",
  },
];

export function Faq({ limit, heading = true }: { limit?: number; heading?: boolean }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;
  return (
    <section className="py-24 sm:py-32">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <div className="container-luxe grid gap-12 lg:grid-cols-12">
        {heading && (
          <div className="lg:col-span-4">
            <SectionHeading
              eyebrow="Questions & answers"
              title={
                <>
                  Good to <span className="italic text-brand">know.</span>
                </>
              }
              intro="Everything about ordering, delivery and caring for your oils. Can't find your answer? Ask our assistant or message us on WhatsApp."
            />
          </div>
        )}
        <div className={heading ? "lg:col-span-7 lg:col-start-6" : "lg:col-span-12"}>
          <FaqList items={items} />
        </div>
      </div>
    </section>
  );
}
