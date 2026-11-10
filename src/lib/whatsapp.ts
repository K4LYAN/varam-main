import { formatINR, lineTotal, sumMoney } from "./format";

export type OrderLine = {
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
};

/** Keep digits only. A bare 10-digit Indian mobile number gets the 91 prefix. */
export function normalizeWhatsAppNumber(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function isWhatsAppNumberConfigured(input: string): boolean {
  const n = normalizeWhatsAppNumber(input);
  return n.length >= 11 && n.length <= 15;
}

/**
 * Official Click-to-Chat URL. Works with the WhatsApp mobile app and with
 * WhatsApp Web / Desktop. If no number is configured, wa.me lets the
 * customer pick the recipient — the message is never lost.
 */
export function buildWhatsAppUrl(number: string, message: string): string {
  const n = normalizeWhatsAppNumber(number);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

function brandName(name: string): string {
  return /^varam\b/i.test(name.trim()) ? name.trim() : `VARAM ${name.trim()}`;
}

export function buildOrderMessage(lines: OrderLine[]): string {
  const totalItems = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = sumMoney(lines.map((l) => lineTotal(l.unitPrice, l.quantity)));

  const body = lines
    .map((l, i) =>
      [
        `*${i + 1}. ${brandName(l.name)}*`,
        `Size: ${l.size}`,
        `Quantity: ${l.quantity}`,
        `Unit Price: ${formatINR(l.unitPrice)}`,
        `Subtotal: ${formatINR(lineTotal(l.unitPrice, l.quantity))}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "Hello VARAM Team!",
    "",
    "I would like to place an order.",
    "",
    "*MY ORDER DETAILS*",
    "",
    body,
    "",
    "----------------------------",
    "",
    `Total Items: ${totalItems}`,
    `Subtotal: ${formatINR(subtotal)}`,
    "Delivery Charges: To Be Confirmed",
    `Total Product Value: ${formatINR(subtotal)}`,
    "",
    "Please confirm product availability and share the delivery details.",
    "",
    "Thank you!",
  ].join("\n");
}

export function buildProductEnquiryMessage(productName: string, size?: string, url?: string): string {
  return [
    "Hello VARAM Team!",
    "",
    `I have a question about *${brandName(productName)}*${size ? ` (${size})` : ""}.`,
    url ? `\n${url}` : "",
  ]
    .join("\n")
    .trim();
}

export const GENERAL_ENQUIRY_MESSAGE = "Hello VARAM Team! I would like to know more about your cold-pressed oils.";
