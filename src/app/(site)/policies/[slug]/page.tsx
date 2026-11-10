import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/lib/markdown";
import { getSettings } from "@/lib/data";
import type { SiteSettings } from "@/lib/types";

const POLICIES: Record<string, { key: keyof SiteSettings["policies"]; title: string }> = {
  privacy: { key: "privacy", title: "Privacy Policy" },
  terms: { key: "terms", title: "Terms & Conditions" },
  shipping: { key: "shipping", title: "Shipping Policy" },
  returns: { key: "returns", title: "Cancellation & Return Policy" },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES[slug];
  return p ? { title: p.title, alternates: { canonical: `/policies/${slug}` } } : { title: "Not found" };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();
  const { policies } = await getSettings();

  return (
    <div className="container-luxe grid gap-12 py-16 sm:py-24 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <p className="eyebrow">Policies</p>
        <ul className="mt-6 space-y-3 text-sm">
          {Object.entries(POLICIES).map(([s, p]) => (
            <li key={s}>
              <Link href={`/policies/${s}`} aria-current={s === slug ? "page" : undefined} className={s === slug ? "font-semibold text-brand" : "text-muted hover:text-ink"}>
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <article className="lg:col-span-8 lg:col-start-5">
        <Markdown source={policies[policy.key]} className="prose-varam [&_h2]:text-5xl" />
      </article>
    </div>
  );
}
