"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, ExternalLink, FileText, LayoutDashboard, LogOut, Menu, MessageSquareQuote, Package, Tags, X } from "lucide-react";
import { clsx } from "clsx";
import { Wordmark } from "@/components/ui/Wordmark";
import { logoutAction } from "@/app/admin/actions";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/categories", label: "Categories", Icon: Tags },
  { href: "/admin/content", label: "Website content", Icon: FileText },
  { href: "/admin/testimonials", label: "Reviews", Icon: MessageSquareQuote },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between border-b border-ivory/10 bg-brand-900 px-4 py-3 lg:hidden">
        <Wordmark tone="light" />
        <button onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center text-ivory" aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <aside
        className={clsx(
          "flex-col bg-brand-900 text-ivory/80 lg:sticky lg:top-0 lg:flex lg:h-dvh",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden px-6 pt-8 pb-6 lg:block">
          <Wordmark tone="light" />
          <p className="mt-2 pl-[2.6rem] text-[10px] tracking-[0.3em] text-accent-300 uppercase">Admin</p>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-3">
          {LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active(href) ? "bg-ivory/10 text-ivory" : "hover:bg-ivory/5 hover:text-ivory",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} /> {label}
            </Link>
          ))}
          <a href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-ivory/5 hover:text-ivory">
            <ExternalLink className="h-4 w-4" strokeWidth={1.6} /> View website
          </a>
        </nav>
        <div className="mt-auto border-t border-ivory/10 px-6 py-5">
          <p className="truncate text-xs text-ivory/50">{email}</p>
          <form action={logoutAction}>
            <button className="mt-2 inline-flex items-center gap-2 text-sm text-ivory/80 hover:text-ivory">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
