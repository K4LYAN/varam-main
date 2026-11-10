import Image from "next/image";
import { clsx } from "clsx";
import { BottleArt } from "./BottleArt";

export function isOptimizable(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const { hostname } = new URL(src);
    return hostname === "images.unsplash.com" || hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Product visual: uploaded photography when available, otherwise a rendered bottle. */
export function ProductImage({
  name,
  image,
  oilTone,
  size,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority,
  className,
  bottleClassName,
}: {
  name: string;
  image?: string | null;
  oilTone: string;
  size?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  bottleClassName?: string;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={!isOptimizable(image)}
        className={clsx("object-cover", className)}
      />
    );
  }
  return (
    <div className={clsx("absolute inset-0 flex items-end justify-center", className)}>
      <BottleArt name={name} tone={oilTone} size={size} className={clsx("h-[86%] w-auto", bottleClassName)} />
    </div>
  );
}
