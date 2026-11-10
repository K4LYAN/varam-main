"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/types";
import { saveSettings } from "@/app/admin/actions";
import { toast } from "@/store/toast";

export function AnalyticsLinkForm({ settings }: { settings: SiteSettings }) {
  const [url, setUrl] = useState(settings.analytics.reportUrl);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings({ ...settings, analytics: { reportUrl: url.trim() } });
          toast(res.ok ? { title: "Saved" } : { title: "Could not save", description: res.error, tone: "warning" });
          router.refresh();
        });
      }}
    >
      <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://analytics.google.com/analytics/web/#/p123456789/reports" />
      <button disabled={pending} className="btn btn-primary min-h-11">
        Save link
      </button>
    </form>
  );
}
