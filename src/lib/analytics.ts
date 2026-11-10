"use client";

/**
 * GA4 event helpers.
 *
 * - Events are only sent when gtag has been loaded, which only happens after
 *   the visitor accepts analytics (see ConsentBanner / GoogleAnalytics).
 * - Identical events fired within a short window are dropped to prevent
 *   duplicates (React Strict Mode double effects, double clicks, etc.).
 * - NEVER pass personal data (names, phone numbers, addresses, emails or the
 *   WhatsApp message text) to these functions.
 */

type GtagFn = (command: "event" | "config" | "consent" | "js" | "set", ...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

export type GaItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  item_brand?: string;
  price?: number;
  quantity?: number;
  index?: number;
  item_list_id?: string;
  item_list_name?: string;
};

const CURRENCY = "INR";
const DEDUPE_WINDOW_MS = 1500;
const recent = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  recent.set(key, now);
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
  }
  return last !== undefined && now - last < DEDUPE_WINDOW_MS;
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const key = `${event}:${JSON.stringify(params)}`;
  if (isDuplicate(key)) return;
  window.gtag("event", event, params);
}

const value = (items: GaItem[]) =>
  Math.round(items.reduce((sum, i) => sum + (i.price ?? 0) * 100 * (i.quantity ?? 1), 0)) / 100;

export const analytics = {
  viewItemList(listId: string, listName: string, items: GaItem[]) {
    track("view_item_list", { item_list_id: listId, item_list_name: listName, items });
  },
  selectItem(listId: string, listName: string, item: GaItem) {
    track("select_item", { item_list_id: listId, item_list_name: listName, items: [item] });
  },
  viewItem(item: GaItem) {
    track("view_item", { currency: CURRENCY, value: value([item]), items: [item] });
  },
  addToCart(item: GaItem) {
    track("add_to_cart", { currency: CURRENCY, value: value([item]), items: [item] });
  },
  removeFromCart(item: GaItem) {
    track("remove_from_cart", { currency: CURRENCY, value: value([item]), items: [item] });
  },
  viewCart(items: GaItem[]) {
    track("view_cart", { currency: CURRENCY, value: value(items), items });
  },
  /** Key event: the customer sent their cart to WhatsApp. NOT a purchase. */
  whatsappOrderClick(items: GaItem[], source: string) {
    track("whatsapp_order_click", {
      currency: CURRENCY,
      value: value(items),
      total_items: items.reduce((n, i) => n + (i.quantity ?? 1), 0),
      item_ids: items.map((i) => i.item_id).join(","),
      item_categories: Array.from(new Set(items.map((i) => i.item_category).filter(Boolean))).join(","),
      order_source: source,
      items,
    });
  },
  whatsappProductEnquiry(item: GaItem, source: string) {
    track("whatsapp_product_enquiry", {
      currency: CURRENCY,
      value: value([item]),
      item_id: item.item_id,
      item_name: item.item_name,
      item_category: item.item_category,
      item_variant: item.item_variant,
      enquiry_source: source,
      items: [item],
    });
  },
  whatsappContactClick(source: string) {
    track("whatsapp_contact_click", { contact_source: source });
  },
};
