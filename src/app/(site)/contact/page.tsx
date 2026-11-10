import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { ContactActions } from "@/components/site/ContactActions";
import { Reveal } from "@/components/ui/Reveal";
import { InstagramIcon } from "@/components/ui/BrandIcons";
import { getSettings } from "@/lib/data";
import { Faq } from "@/components/home/Faq";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with VARAM on WhatsApp for orders, product questions and delivery enquiries.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const { contact, social } = await getSettings();
  const rows = [
    contact.phone && { Icon: Phone, label: "Phone", value: contact.phone, href: `tel:${contact.phone.replace(/[^+\d]/g, "")}` },
    contact.email && { Icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    contact.address && { Icon: MapPin, label: "Address", value: contact.address },
    contact.hours && { Icon: Clock, label: "Hours", value: contact.hours },
    social.instagram && { Icon: InstagramIcon, label: "Instagram", value: social.instagramHandle ? `@${social.instagramHandle.replace(/^@/, "")}` : "Follow us", href: social.instagram },
  ].filter(Boolean) as { Icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string }[];

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title={
          <>
            We&apos;d love to <span className="italic text-brand">hear from you.</span>
          </>
        }
        intro="The quickest way to reach us is WhatsApp — for orders, product questions, or anything else."
      />
      <section className="pb-24 sm:pb-32">
        <div className="container-luxe grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <ContactActions />
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4 lg:col-start-9">
            {rows.length > 0 ? (
              <dl className="divide-y divide-line border-y border-line">
                {rows.map(({ Icon, label, value, href }) => (
                  <div key={label} className="flex gap-5 py-6">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-accent" />
                    <div>
                      <dt className="label">{label}</dt>
                      <dd className="text-[15px] leading-relaxed whitespace-pre-line">
                        {href ? (
                          <a href={href} className="hover:text-brand" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                            {value}
                          </a>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">Contact details coming soon.</p>
            )}
          </Reveal>
        </div>
      </section>
      <div className="border-t border-line">
        <Faq />
      </div>
    </>
  );
}
