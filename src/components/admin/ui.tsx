"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { isOptimizable } from "@/components/product/ProductImage";

export function AdminTitle({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-line bg-white p-5 sm:p-7", className)}>
      {title && <h2 className="font-serif text-2xl">{title}</h2>}
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className={clsx(title || description ? "mt-5" : "")}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 text-sm"
    >
      <span className={clsx("relative h-6 w-11 rounded-full transition", checked ? "bg-brand" : "bg-line")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
  return data.url;
}

/** Image picker: upload a file or paste an https URL. */
export function ImageField({
  value,
  onChange,
  label = "Image",
  aspect = "aspect-[4/3]",
  onError,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  aspect?: string;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      onError?.((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className={clsx("relative overflow-hidden rounded-xl border border-dashed border-line bg-cream/50", aspect)}>
        {value ? (
          <Image src={value} alt="" fill sizes="300px" unoptimized={!isOptimizable(value)} className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted">No image</div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <LoaderCircle className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}
        <div className="absolute right-2 bottom-2 flex gap-1.5">
          <button type="button" onClick={() => inputRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow hover:bg-white" aria-label="Upload image">
            <ImagePlus className="h-4 w-4" />
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-copper shadow hover:bg-white" aria-label="Remove image">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an https:// image URL"
        className="field mt-2 text-xs"
      />
    </div>
  );
}
