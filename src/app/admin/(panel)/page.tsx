import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/data";
import { analyticsConfig, envWhatsAppNumber } from "@/lib/config";
import { isWhatsAppNumberConfigured } from "@/lib/whatsapp";
import { formatINR } from "@/lib/format";
import { AdminTitle, Card } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [products, categories, testimonials, settings] = await Promise.all([
    db.allProducts(),
    db.categories(),
    db.testimonials(),
    db.settings(),
  ]);
  const number = settings.contact.whatsappNumber || envWhatsAppNumber;
  const unavailable = products.filter((p) => !p.available);
  const usesPhotos = products.filter((p) => p.images.length).length;
  const placeholderImages = JSON.stringify(settings).includes("images.unsplash.com");

  const checks = [
    { ok: isWhatsAppNumberConfigured(number), label: "WhatsApp business number", fix: "/admin/content", hint: "Customers' orders are sent to this number." },
    { ok: Boolean(analyticsConfig.measurementId), label: "Google Analytics 4 Measurement ID", fix: "/admin/analytics", hint: "Set NEXT_PUBLIC_GA_MEASUREMENT_ID in hosting environment variables." },
    { ok: Boolean(settings.contact.email || settings.contact.phone), label: "Contact details", fix: "/admin/content", hint: "Phone or email shown in the footer and contact page." },
    { ok: !placeholderImages, label: "Brand photography", fix: "/admin/content", hint: "Placeholder stock photos are still in use — upload VARAM's own photos." },
    { ok: usesPhotos === products.length && products.length > 0, label: "Product photographs", fix: "/admin/products", hint: `${usesPhotos}/${products.length} products have photos. Others show a rendered bottle.` },
    { ok: !/\[[^\]]+\]/.test(Object.values(settings.policies).join(" ")), label: "Policies reviewed", fix: "/admin/content#policies", hint: "Policy templates still contain [placeholders]." },
  ];

  const stats = [
    { label: "Products", value: products.length },
    { label: "Categories", value: categories.length },
    { label: "Out of stock", value: unavailable.length },
    { label: "Testimonials", value: testimonials.filter((t) => t.published).length },
  ];

  return (
    <>
      <AdminTitle title="Welcome back" description="Manage VARAM's catalogue, prices and website content. Changes go live immediately." />

      <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5 text-sm leading-relaxed text-earth-700">
        <strong>Catalogue:</strong> set up from VARAM&apos;s price list — every price is for <em>1 Litre</em>. Add other bottle sizes
        (e.g. 500 ML, 5 Litre) from the product editor whenever their prices are ready.
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="label">{s.label}</p>
            <p className="font-serif text-5xl">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Launch checklist">
          <ul className="divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3 py-3">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-copper" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted">{c.hint}</p>
                </div>
                {!c.ok && (
                  <Link href={c.fix} className="text-xs font-semibold text-brand hover:underline">
                    Fix
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Products" description="Quick view of your catalogue">
          <ul className="divide-y divide-line">
            {products.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/admin/products/${p.id}`} className="truncate hover:text-brand">
                  {p.name}
                </Link>
                <span className="shrink-0 text-muted tabular-nums">
                  {p.variants.length ? `${formatINR(Math.min(...p.variants.map((v) => v.price)))}+` : "—"}
                  {!p.available && <span className="ml-2 text-copper">· Out of stock</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/products" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
            Manage products <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </>
  );
}
