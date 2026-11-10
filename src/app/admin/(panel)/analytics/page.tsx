import { CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import { db } from "@/lib/data";
import { analyticsConfig } from "@/lib/config";
import { AdminTitle, Card } from "@/components/admin/ui";
import { AnalyticsLinkForm } from "@/components/admin/AnalyticsLinkForm";

export const metadata = { title: "Analytics" };

const EVENTS = [
  ["view_item_list", "A product list is shown (shop, homepage, related products)"],
  ["select_item", "A product is clicked from a list"],
  ["view_item", "A product page or quick view is opened"],
  ["add_to_cart", "A product is added to the cart (or quantity increased)"],
  ["remove_from_cart", "A product is removed (or quantity decreased)"],
  ["view_cart", "The cart drawer is opened"],
  ["whatsapp_order_click", "★ Key event — customer sends their cart via “Order via WhatsApp”"],
  ["whatsapp_product_enquiry", "Product page “Enquire on WhatsApp” button"],
  ["whatsapp_contact_click", "Floating, header, footer or contact-page WhatsApp buttons"],
];

export default async function AnalyticsPage() {
  const settings = await db.settings();
  const id = analyticsConfig.measurementId;
  return (
    <>
      <AdminTitle title="Analytics" description="VARAM uses Google Analytics 4 to measure visitors, product interest and WhatsApp order enquiries." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Status">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2">
              {id ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <AlertTriangle className="h-4 w-4 text-copper" />}
              Measurement ID: <code className="rounded bg-cream px-1.5">{id || "not set"}</code>
            </li>
            <li className="flex items-center gap-2">
              {analyticsConfig.enabled ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <AlertTriangle className="h-4 w-4 text-copper" />}
              Tracking {analyticsConfig.enabled ? "enabled in this environment" : "disabled in this environment (development)"}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand" /> Consent banner: visitors must accept before GA4 loads
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            The Measurement ID is set by your developer in the hosting environment variable <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code>.
            Use a separate GA4 property (or data stream) for testing so production reports stay clean.
          </p>
        </Card>

        <Card title="Open your reports">
          <p className="text-sm text-muted">Save the link to your GA4 property for quick access.</p>
          {settings.analytics.reportUrl && (
            <a href={settings.analytics.reportUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 min-h-11">
              Open Google Analytics <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <div className="mt-5">
            <AnalyticsLinkForm settings={settings} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            To give someone access: GA4 → Admin → Property access management → “+” → Add users → enter their Google account email and choose a role
            (Viewer or Analyst for reporting; Administrator for the business owner).
          </p>
        </Card>
      </div>

      <Card title="Events this website sends" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <tbody className="divide-y divide-line">
              {EVENTS.map(([name, desc]) => (
                <tr key={name}>
                  <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap text-brand">{name}</td>
                  <td className="py-2.5 text-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          WhatsApp clicks are <strong>enquiries</strong>, not confirmed purchases — no <code>purchase</code> event is sent. No names, phone numbers,
          addresses, emails or message text are ever sent to Google Analytics.
        </p>
      </Card>

      <Card title="Recommended reports" className="mt-6">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink/80">
          <li>
            <strong>Mark the key event:</strong> Admin → Data display → Events → find <code>whatsapp_order_click</code> → toggle “Mark as key event”.
          </li>
          <li>
            <strong>Register custom dimensions</strong> (Admin → Custom definitions): <code>order_source</code>, <code>enquiry_source</code>,{" "}
            <code>contact_source</code> (event-scoped) and the metric <code>total_items</code>.
          </li>
          <li>
            <strong>Enquiry funnel:</strong> Explore → Funnel exploration with steps <code>view_item</code> → <code>add_to_cart</code> →{" "}
            <code>view_cart</code> → <code>whatsapp_order_click</code>. Break down by device category or session source.
          </li>
          <li>
            <strong>Most viewed / added products:</strong> Reports → Monetisation → E-commerce purchases shows item views and add-to-carts by item name.
          </li>
          <li>
            <strong>Traffic sources generating enquiries:</strong> Reports → Acquisition → Traffic acquisition, then select the key event{" "}
            <code>whatsapp_order_click</code> in the key events column.
          </li>
        </ol>
      </Card>
    </>
  );
}
