"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Plus, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import type { Product } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { track, analytics } from "@/lib/analytics";
import { useCart } from "@/store/cart";
import { useWhatsApp } from "@/components/site/SiteProvider";
import { ProductImage } from "@/components/product/ProductImage";
import { defaultVariant, useAddToCart } from "@/components/product/useAddToCart";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Option = { label: string; action: string; selected?: boolean };
type Msg = {
  id: number;
  from: "bot" | "user";
  text?: string;
  lines?: string[];
  productIds?: string[];
  options?: Option[];
  whatsapp?: { label: string; message: string };
  link?: { href: string; label: string };
};

type Step = "idle" | "req-products" | "req-qty" | "req-location" | "req-notes" | "req-review";
type Req = { productIds: string[]; quantity: string; location: string; notes: string };

const EMPTY_REQ: Req = { productIds: [], quantity: "", location: "", notes: "" };

const MENU: Option[] = [
  { label: "Help me choose an oil", action: "choose" },
  { label: "See prices", action: "prices" },
  { label: "Share my requirements", action: "req-start" },
  { label: "Delivery & payment", action: "delivery" },
  { label: "Talk to our team", action: "human" },
];

const USES: { label: string; key: string; slugs: string[]; note: string }[] = [
  { label: "Everyday cooking", key: "everyday", slugs: ["cold-pressed-groundnut-oil", "cold-pressed-sunflower-oil"], note: "For everyday cooking, most families pick groundnut oil for its nutty flavour, or sunflower oil if they prefer something mild." },
  { label: "South Indian cooking", key: "south", slugs: ["cold-pressed-white-sesame-oil", "cold-pressed-groundnut-oil", "cold-pressed-coconut-oil"], note: "Sesame (gingelly), groundnut and coconut oil are the classic trio of South Indian kitchens." },
  { label: "North Indian & pickles", key: "north", slugs: ["cold-pressed-mustard-oil", "cold-pressed-white-sesame-oil"], note: "Mustard oil gives pickles and North & East Indian dishes their signature pungency. Sesame oil is a favourite for South Indian pickles." },
  { label: "Frying snacks", key: "frying", slugs: ["cold-pressed-groundnut-oil"], note: "Groundnut oil is the traditional choice for frying snacks at home." },
  { label: "Sweets & festivals", key: "sweets", slugs: ["pure-ghee", "cold-pressed-coconut-oil"], note: "Ghee is a must for sweets, halwa and pooja; coconut oil is used in many traditional sweets too." },
  { label: "Hair & skin care", key: "care", slugs: ["cold-pressed-coconut-oil", "cold-pressed-castor-oil", "cold-pressed-black-sesame-oil"], note: "Coconut, castor and black sesame oil are traditionally used in hair and skin care routines." },
];

const QUANTITIES = ["1–2 litres", "3–5 litres", "5–10 litres", "More than 10 litres", "Monthly supply"];

/* ------------------------------------------------------------------ */

export function Assistant({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [req, setReq] = useState<Req>(EMPTY_REQ);
  const [nudge, setNudge] = useState(false);
  const idRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cartOpen = useCart((s) => s.isOpen);
  const onProductPage = usePathname().startsWith("/oils/");
  const { open: openWhatsApp } = useWhatsApp();

  const byId = useCallback((id: string) => products.find((p) => p.id === id), [products]);
  const bySlug = useCallback((slug: string) => products.find((p) => p.slug === slug), [products]);
  const available = products.filter((p) => p.available);

  /* ---------- message helpers ---------- */

  const push = useCallback((m: Omit<Msg, "id">) => {
    setMsgs((cur) => [...cur, { ...m, id: ++idRef.current }]);
  }, []);

  const bot = useCallback(
    (m: Omit<Msg, "id" | "from">, delay = 550) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        push({ ...m, from: "bot" });
      }, delay);
    },
    [push],
  );

  const greet = useCallback(() => {
    bot(
      {
        text: "Namaste! 🙏 I'm the VARAM assistant. I can help you choose an oil, check prices, or pass your requirements to our team on WhatsApp.",
        options: MENU,
      },
      400,
    );
  }, [bot]);

  /* ---------- open / close ---------- */

  useEffect(() => {
    // Desktop only: auto-focusing on phones pops the keyboard and shifts the viewport
    if (open && window.matchMedia("(min-width: 640px)").matches) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  // Gentle one-time nudge per session
  useEffect(() => {
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem("varam-assistant-nudge"));
    } catch {}
    if (seen) return;
    const t = setTimeout(() => {
      setNudge(true);
      try {
        sessionStorage.setItem("varam-assistant-nudge", "1");
      } catch {}
    }, 9000);
    return () => clearTimeout(t);
  }, []);

  // Other parts of the site can open the assistant (e.g. the shop's "Ask the assistant" buttons)
  useEffect(() => {
    const onOpen = () => {
      setNudge(false);
      setOpen((wasOpen) => {
        if (!wasOpen) track("assistant_open", { source: "button" });
        return true;
      });
      if (idRef.current === 0) greet();
    };
    window.addEventListener("varam:open-assistant", onOpen);
    return () => window.removeEventListener("varam:open-assistant", onOpen);
  }, [greet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = () => {
    setNudge(false);
    if (!open) {
      track("assistant_open", {});
      if (msgs.length === 0) greet();
    }
    setOpen(!open);
  };

  /* ---------- flows ---------- */

  const showPrices = () =>
    bot({
      text: "Here are our current prices:",
      lines: available.map((p) => `${p.name} — ${p.variants.map((v) => `${formatINR(v.price)} / ${v.label}`).join(", ")}`),
      link: { href: "/oils", label: "Browse all oils" },
      options: [
        { label: "Help me choose", action: "choose" },
        { label: "Share my requirements", action: "req-start" },
        { label: "Main menu", action: "menu" },
      ],
    });

  const showDelivery = () =>
    bot({
      text: "How ordering works:",
      lines: [
        "1. Add oils to your cart (or share your requirements here).",
        "2. Send the order to us on WhatsApp in one tap.",
        "3. Our team confirms availability, delivery charges and delivery date for your location.",
        "4. Payment details are shared on WhatsApp — there is no online payment on this website.",
      ],
      options: [
        { label: "Share my requirements", action: "req-start" },
        { label: "Talk to our team", action: "human" },
        { label: "Main menu", action: "menu" },
      ],
    });

  const showProducts = (ids: string[], text: string, extra: Option[] = []) =>
    bot({
      text,
      productIds: ids,
      options: [...extra, { label: "Share my requirements", action: "req-start" }, { label: "Main menu", action: "menu" }],
    });

  const reqProductsPrompt = (selected: string[]) =>
    bot(
      {
        text: "Great! Which products are you interested in? Tap all that apply, then press Done.",
        options: [
          ...available.map((p) => ({ label: p.name.replace(/^Cold-Pressed /, ""), action: `req-toggle:${p.id}`, selected: selected.includes(p.id) })),
          { label: "Done ✓", action: "req-products-done" },
        ],
      },
      450,
    );

  const reqSummary = (r: Req) => {
    const names = r.productIds.map((id) => byId(id)?.name).filter(Boolean) as string[];
    bot({
      text: "Here's a summary of your requirements:",
      lines: [
        `Products: ${names.length ? names.join(", ") : "Not sure yet"}`,
        `Quantity: ${r.quantity || "—"}`,
        `Delivery location: ${r.location || "—"}`,
        ...(r.notes ? [`Notes: ${r.notes}`] : []),
      ],
      whatsapp: { label: "Send to VARAM on WhatsApp", message: requirementMessage(r, names) },
      options: [
        ...(r.productIds.length ? [{ label: "Add these to my cart", action: "req-add-cart" }] : []),
        { label: "Start over", action: "req-start" },
        { label: "Main menu", action: "menu" },
      ],
    });
  };

  const handleAction = (opt: Option) => {
    const { action } = opt;
    track("assistant_action", { assistant_action: action.split(":")[0] });

    // Multi-select toggle doesn't echo as a user message
    if (action.startsWith("req-toggle:")) {
      const id = action.split(":")[1];
      setReq((r) => {
        const productIds = r.productIds.includes(id) ? r.productIds.filter((x) => x !== id) : [...r.productIds, id];
        // update the chip selection state on the last message
        setMsgs((cur) =>
          cur.map((m, i) =>
            i === cur.length - 1 && m.options
              ? { ...m, options: m.options.map((o) => (o.action.startsWith("req-toggle:") ? { ...o, selected: productIds.includes(o.action.split(":")[1]) } : o)) }
              : m,
          ),
        );
        return { ...r, productIds };
      });
      return;
    }

    push({ from: "user", text: opt.label.replace(" ✓", "") });

    if (action === "menu") {
      setStep("idle");
      return bot({ text: "What would you like to do?", options: MENU });
    }
    if (action === "choose") {
      setStep("idle");
      return bot({ text: "Happy to help! What will you mainly use it for?", options: USES.map((u) => ({ label: u.label, action: `use:${u.key}` })) });
    }
    if (action.startsWith("use:")) {
      const use = USES.find((u) => u.key === action.slice(4));
      if (!use) return;
      const ids = use.slugs.map((s) => bySlug(s)?.id).filter(Boolean) as string[];
      return showProducts(ids, use.note, [{ label: "Another use", action: "choose" }]);
    }
    if (action === "prices") return showPrices();
    if (action === "delivery") return showDelivery();
    if (action === "human") {
      analytics.whatsappContactClick("assistant");
      openWhatsApp("Hello VARAM Team! I'd like some help with my order.");
      return bot({ text: "I've opened WhatsApp so you can chat with our team directly. 😊", options: [{ label: "Main menu", action: "menu" }] });
    }
    if (action === "req-start") {
      setReq(EMPTY_REQ);
      setStep("req-products");
      return reqProductsPrompt([]);
    }
    if (action === "req-products-done") {
      setStep("req-qty");
      return bot({ text: "Roughly how much do you need?", options: QUANTITIES.map((q) => ({ label: q, action: `req-qty:${q}` })) });
    }
    if (action.startsWith("req-qty:")) {
      setReq((r) => ({ ...r, quantity: action.slice(8) }));
      setStep("req-location");
      return bot({
        text: "Which city or PIN code should we deliver to? Type it below.",
        options: [{ label: "Skip", action: "req-location-skip" }],
      });
    }
    if (action === "req-location-skip") {
      setStep("req-notes");
      return bot({ text: "Anything else we should know? (e.g. preferred delivery day, gifting)", options: [{ label: "No, that's all", action: "req-notes-skip" }] });
    }
    if (action === "req-notes-skip") {
      setStep("req-review");
      return reqSummary(req);
    }
    if (action === "req-add-cart") {
      return addRequirementToCart();
    }
  };

  const addToCart = useAddToCart();
  const addRequirementToCart = () => {
    req.productIds.forEach((id) => {
      const p = byId(id);
      const v = p && defaultVariant(p);
      if (p && v && p.available && v.available) addToCart(p, v, 1);
    });
    bot({
      text: "Added 1 of each to your cart. You can change sizes and quantities in the cart, then tap “Order via WhatsApp”.",
      options: [
        { label: "Open my cart", action: "open-cart" },
        { label: "Main menu", action: "menu" },
      ],
    });
  };

  /* ---------- free text ---------- */

  const matchProducts = (t: string): string[] => {
    const keywords: [string[], string][] = [
      [["black sesame", "black til", "karuppu ellu"], "cold-pressed-black-sesame-oil"],
      [["groundnut", "peanut", "verkadalai", "palli", "moongphali", "kadalai"], "cold-pressed-groundnut-oil"],
      [["white sesame", "gingelly", "nalla", "nallennai", "til oil", "sesame", "ellu"], "cold-pressed-white-sesame-oil"],
      [["coconut", "thengai", "kobbari", "nariyal"], "cold-pressed-coconut-oil"],
      [["mustard", "sarson", "kadugu"], "cold-pressed-mustard-oil"],
      [["sunflower"], "cold-pressed-sunflower-oil"],
      [["castor", "amudham", "aamudam", "erandi", "vilakkennai"], "cold-pressed-castor-oil"],
      [["ghee", "neyyi", "nei", "ghi"], "pure-ghee"],
    ];
    const ids: string[] = [];
    let rest = t;
    for (const [words, slug] of keywords) {
      const hit = words.find((w) => rest.includes(w));
      if (!hit) continue;
      rest = rest.replace(hit, " "); // so "black sesame" doesn't also match plain "sesame"
      const id = bySlug(slug)?.id;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  };

  const handleText = (raw: string) => {
    const text = raw.trim().slice(0, 300);
    if (!text) return;
    push({ from: "user", text });
    setInput("");

    if (step === "req-location") {
      const next = { ...req, location: text };
      setReq(next);
      setStep("req-notes");
      return bot({ text: "Thank you! Anything else we should know? (e.g. preferred delivery day, gifting)", options: [{ label: "No, that's all", action: "req-notes-skip" }] });
    }
    if (step === "req-notes") {
      const next = { ...req, notes: text };
      setReq(next);
      setStep("req-review");
      return reqSummary(next);
    }

    track("assistant_action", { assistant_action: "free_text" });
    const t = text.toLowerCase();
    // Whole-word matching so "hi" doesn't match "white", "rs" doesn't match "yours", etc.
    const has = (...words: string[]) =>
      words.some((w) => new RegExp(`(^|[^a-z])${w}${w.length < 4 ? "([^a-z]|$)" : ""}`, "i").test(t));

    if (has("price", "prices", "cost", "rate", "rates", "how much") || t.includes("₹")) return showPrices();

    // Product keywords take priority over generic words like "order"
    const productIds = matchProducts(t);
    if (productIds.length) return showProducts(productIds, productIds.length > 1 ? "Here's what I found:" : "Here you go:");

    if (has("deliver", "shipping", "courier", "pin", "pay", "upi", "cod", "cash", "order")) return showDelivery();
    if (has("bulk", "wholesale", "monthly", "requirement", "quantity", "litres", "liters", "kg")) {
      setReq(EMPTY_REQ);
      setStep("req-products");
      return reqProductsPrompt([]);
    }
    if (has("cold", "refined", "chemical", "process", "made", "extract")) {
      return bot({
        text: "Our oils are cold-pressed: seeds are pressed slowly the traditional way rather than extracted at high heat, then the oil is left to settle naturally, filtered and bottled.",
        link: { href: "/our-process", label: "See our process" },
        options: MENU.slice(0, 3),
      });
    }
    if (has("store", "storage", "shelf", "expire", "expiry")) {
      return bot({
        text: "Store oils in a cool, dry place away from direct sunlight and close the cap tightly. Natural sediment is normal for unrefined oils. Shelf life is printed on each pack.",
        options: MENU.slice(0, 3),
      });
    }
    if (has("hi", "hello", "hey", "namaste", "vanakkam", "namaskaram")) {
      return bot({ text: "Hello! 😊 How can I help you today?", options: MENU });
    }
    if (has("thank")) return bot({ text: "You're welcome! Happy cooking. 🌿", options: MENU });
    if (has("human", "person", "call", "contact", "talk", "whatsapp", "number")) {
      return bot({ text: "Our team is happy to help on WhatsApp.", options: [{ label: "Talk to our team", action: "human" }, { label: "Main menu", action: "menu" }] });
    }

    return bot({
      text: "Sorry, I'm a simple assistant and didn't quite get that. Please pick an option below, or chat with our team on WhatsApp.",
      options: [...MENU.slice(0, 4), { label: "Talk to our team", action: "human" }],
    });
  };

  /* ---------- render ---------- */

  const last = msgs[msgs.length - 1];

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!cartOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.4 }}
            className={clsx(
              "fixed left-4 z-40 flex items-center gap-3 max-sm:flex-row-reverse sm:right-6 sm:left-auto sm:bottom-[6.5rem]",
              onProductPage ? "bottom-24" : "bottom-5",
            )}
          >
            <AnimatePresence>
              {nudge && !open && (
                <motion.button
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  onClick={toggle}
                  className="hidden rounded-2xl rounded-br-sm border border-line bg-ivory px-4 py-2.5 text-left text-[13px] shadow-xl xs:block"
                >
                  <span className="block font-semibold text-ink">Need help choosing an oil?</span>
                  <span className="text-muted">Ask the VARAM assistant</span>
                </motion.button>
              )}
            </AnimatePresence>
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? "Close VARAM assistant" : "Open VARAM assistant"}
              className="grid h-14 w-14 place-items-center rounded-full bg-brand text-ivory shadow-[0_18px_40px_-12px_rgba(61,31,14,0.7)] transition hover:bg-brand-800"
            >
              {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" strokeWidth={1.6} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="VARAM assistant"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[66] flex flex-col overflow-hidden bg-ivory sm:inset-auto sm:right-6 sm:bottom-[11rem] sm:h-[min(620px,calc(100dvh-13rem))] sm:w-[390px] sm:rounded-3xl sm:border sm:border-line sm:shadow-[0_40px_80px_-30px_rgba(31,33,23,0.5)]"
          >
            <header className="flex items-center gap-3 bg-brand-900 px-4 py-3.5 text-ivory">
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-ivory">
                <Image src="/brand/varam-logo.jpg" alt="" fill sizes="44px" className="scale-125 object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl leading-none">VARAM Assistant</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ivory/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> Instant answers · Team on WhatsApp
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory/10" aria-label="Close assistant">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
              {msgs.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  interactive={m === last}
                  products={(m.productIds ?? []).map(byId).filter(Boolean) as Product[]}
                  onOption={(o) => (o.action === "open-cart" ? (setOpen(false), useCart.getState().open()) : handleAction(o))}
                  onWhatsApp={(message) => {
                    analytics.whatsappContactClick("assistant_requirements");
                    track("assistant_requirements_sent", { product_count: req.productIds.length });
                    openWhatsApp(message);
                  }}
                  onNavigate={() => setOpen(false)}
                />
              ))}
              {typing && (
                <div className="flex w-fit gap-1 rounded-2xl rounded-tl-sm bg-cream px-4 py-3" aria-label="Assistant is typing">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-brand/60"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleText(input);
              }}
              className="flex items-center gap-2 border-t border-line bg-white/60 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={300}
                placeholder={step === "req-location" ? "City or PIN code" : step === "req-notes" ? "Type a note…" : "Ask about oils, prices, delivery…"}
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-accent"
                aria-label="Message"
              />
              <button type="submit" disabled={!input.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-brand text-ivory disabled:opacity-40" aria-label="Send">
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
            <p className="bg-white/60 pb-2 text-center text-[10px] text-muted">
              Automated assistant · orders are confirmed by our team on WhatsApp
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function requirementMessage(r: Req, names: string[]) {
  return [
    "Hello VARAM Team!",
    "",
    "I'd like to enquire about the following:",
    "",
    `*Products:* ${names.length ? names.join(", ") : "Not sure yet — please suggest"}`,
    `*Quantity:* ${r.quantity || "—"}`,
    `*Delivery location:* ${r.location || "—"}`,
    ...(r.notes ? [`*Notes:* ${r.notes}`] : []),
    "",
    "Please share availability, prices and delivery details.",
    "",
    "Thank you!",
  ].join("\n");
}

/* ------------------------------------------------------------------ */

function MessageBubble({
  msg,
  interactive,
  products,
  onOption,
  onWhatsApp,
  onNavigate,
}: {
  msg: Msg;
  interactive: boolean;
  products: Product[];
  onOption: (o: Option) => void;
  onWhatsApp: (message: string) => void;
  onNavigate: () => void;
}) {
  const isBot = msg.from === "bot";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx("flex flex-col", isBot ? "items-start" : "items-end")}
    >
      {(msg.text || msg.lines) && (
        <div
          className={clsx(
            "max-w-[88%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
            isBot ? "rounded-tl-sm bg-cream text-ink" : "rounded-tr-sm bg-brand text-ivory",
          )}
        >
          {msg.text && <p>{msg.text}</p>}
          {msg.lines && (
            <ul className={clsx("space-y-1", msg.text && "mt-2")}>
              {msg.lines.map((l) => (
                <li key={l} className="text-[13px]">
                  {l}
                </li>
              ))}
            </ul>
          )}
          {msg.link && (
            <Link href={msg.link.href} onClick={onNavigate} className="mt-2 inline-block text-[12px] font-semibold text-brand underline underline-offset-2">
              {msg.link.label} →
            </Link>
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-2 flex w-full flex-col gap-2">
          {products.map((p) => (
            <MiniProduct key={p.id} product={p} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {msg.whatsapp && (
        <button onClick={() => onWhatsApp(msg.whatsapp!.message)} className="btn btn-whatsapp mt-2 min-h-11 w-full max-w-[88%] px-4 text-[11px]">
          <WhatsAppIcon className="h-4 w-4" /> {msg.whatsapp.label}
        </button>
      )}

      {msg.options && interactive && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {msg.options.map((o) => (
            <button
              key={o.action}
              onClick={() => onOption(o)}
              aria-pressed={o.selected}
              className={clsx(
                "rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition",
                o.selected ? "border-brand bg-brand text-ivory" : "border-brand/30 bg-white text-brand hover:border-brand hover:bg-brand/5",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function MiniProduct({ product, onNavigate }: { product: Product; onNavigate: () => void }) {
  const add = useAddToCart();
  const v = defaultVariant(product);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-2.5">
      <Link href={`/oils/${product.slug}`} onClick={onNavigate} className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-cream">
        <ProductImage name={product.name} image={product.images[0]} oilTone={product.oilTone} sizes="56px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/oils/${product.slug}`} onClick={onNavigate} className="block truncate font-serif text-lg leading-tight hover:text-brand">
          {product.name}
        </Link>
        <p className="text-xs text-muted">
          {v ? `${formatINR(v.price)} / ${v.label}` : ""}
          {!product.available && " · Out of stock"}
        </p>
      </div>
      <button
        onClick={() => v && add(product, v, 1)}
        disabled={!product.available || !v?.available}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-ivory disabled:opacity-40"
        aria-label={`Add ${product.name} to cart`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

