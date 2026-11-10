import type { Metadata } from "next";
import { Toaster } from "@/components/site/Toaster";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · VARAM Admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f6f2ea]">
      {children}
      <Toaster />
    </div>
  );
}
