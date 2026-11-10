import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

const STEPS = [
  { title: "Choose your oils", text: "Pick your favourites and the bottle sizes that suit your kitchen." },
  { title: "Review your cart", text: "Add as many oils as you like and check your order in one place." },
  { title: "Send on WhatsApp", text: "Your order is sent to us on WhatsApp — we confirm availability, delivery and payment with you personally." },
];

export function OrderSteps() {
  return (
    <section className="relative overflow-hidden bg-earth-700 py-24 text-ivory sm:py-28 grain">
      <div className="container-luxe relative">
        <div className="grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="eyebrow text-accent-300">How to order</p>
            <h2 className="display mt-4 text-5xl sm:text-6xl">
              Simple, personal <span className="italic text-accent-300">ordering.</span>
            </h2>
            <Link href="/oils" className="btn btn-accent mt-10">
              Start your order <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <ol className="grid gap-10 sm:grid-cols-3 lg:col-span-8 lg:gap-8">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={0.1 * i} className="border-t border-ivory/20 pt-6">
                <span className="flex items-center gap-3 font-serif text-5xl text-accent-300">
                  {String(i + 1).padStart(2, "0")}
                  {i === 2 && <WhatsAppIcon className="h-6 w-6 text-ivory/70" />}
                </span>
                <h3 className="mt-6 font-serif text-3xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ivory/70">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
