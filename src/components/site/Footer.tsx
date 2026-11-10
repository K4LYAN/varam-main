import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { FacebookIcon, InstagramIcon, YouTubeIcon } from "@/components/ui/BrandIcons";
import { CookiePreferencesButton } from "@/components/analytics/ConsentBanner";
import type { Category, SiteSettings } from "@/lib/types";
import { FooterWhatsApp } from "./FooterWhatsApp";

export function Footer({ settings, categories }: { settings: SiteSettings; categories: Category[] }) {
  const { contact, social, brand } = settings;
  const year = new Date().getFullYear();
  const socials = [
    { href: social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: social.youtube, label: "YouTube", Icon: YouTubeIcon },
  ].filter((s) => s.href);

  return (
    <footer className="relative overflow-hidden bg-brand-900 text-ivory/80">
      <div className="container-luxe relative pt-20 pb-10 lg:pt-28">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="relative h-36 w-36 overflow-hidden rounded-full bg-ivory p-1 ring-1 ring-accent/40">
              <Image src="/brand/varam-logo.jpg" alt="VARAM Organic Oil logo" fill sizes="144px" className="scale-[1.08] object-cover" />
            </div>
            <Wordmark tone="light" subtitle="Organic Oil" className="mt-6" showMark={false} />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ivory/65">{brand.description}</p>
            <p className="mt-6 font-serif text-2xl text-accent-300 italic">{brand.tagline}</p>
            {socials.length > 0 && (
              <div className="mt-8 flex gap-3">
                {socials.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-11 w-11 place-items-center rounded-full border border-ivory/20 transition hover:border-accent hover:text-accent-300"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
            <FooterCol title="Explore">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/oils">Our Oils</FooterLink>
              <FooterLink href="/our-story">Our Story</FooterLink>
              <FooterLink href="/our-process">Our Process</FooterLink>
              <FooterLink href="/stores">Our Stores</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </FooterCol>
            <FooterCol title="Our Oils">
              {categories.map((c) => (
                <FooterLink key={c.id} href={`/oils?category=${c.slug}`}>
                  {c.name}
                </FooterLink>
              ))}
            </FooterCol>
            <FooterCol title="Get in touch" className="col-span-2 sm:col-span-1">
              <li>
                <FooterWhatsApp />
              </li>
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="hover:text-ivory">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="break-all hover:text-ivory">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.address && <li className="leading-relaxed whitespace-pre-line text-ivory/60">{contact.address}</li>}
              {contact.hours && <li className="text-ivory/60">{contact.hours}</li>}
            </FooterCol>
          </div>
        </div>

        <div className="mt-20 font-serif text-[22vw] leading-[0.8] tracking-[0.12em] text-ivory/[0.05] select-none lg:text-[17vw]" aria-hidden="true">
          VARAM
        </div>

        <div className="mt-6 flex flex-col gap-6 border-t border-ivory/10 pt-8 text-xs text-ivory/50 lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} VARAM. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            <li>
              <Link href="/policies/privacy" className="hover:text-ivory">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/policies/terms" className="hover:text-ivory">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/policies/shipping" className="hover:text-ivory">
                Shipping Policy
              </Link>
            </li>
            <li>
              <Link href="/policies/returns" className="hover:text-ivory">
                Cancellation &amp; Returns
              </Link>
            </li>
            <li>
              <CookiePreferencesButton className="hover:text-ivory" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="eyebrow text-accent-300">{title}</p>
      <ul className="mt-6 space-y-3 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="transition hover:text-ivory">
        {children}
      </Link>
    </li>
  );
}
