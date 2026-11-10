import Image from "next/image";
import { clsx } from "clsx";
import { InstagramIcon } from "@/components/ui/BrandIcons";
import { Reveal } from "@/components/ui/Reveal";
import { isOptimizable } from "@/components/product/ProductImage";
import type { ImageRef, SiteSettings } from "@/lib/types";

export function Gallery({ images, social }: { images: ImageRef[]; social: SiteSettings["social"] }) {
  if (!images.length) return null;
  const handle = social.instagramHandle ? `@${social.instagramHandle.replace(/^@/, "")}` : "VARAM";
  const Wrapper = ({ children, className }: { children: React.ReactNode; className?: string }) =>
    social.instagram ? (
      <a href={social.instagram} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    ) : (
      <div className={className}>{children}</div>
    );

  return (
    <section className="pb-24 sm:pb-32 lg:pb-40">
      <div className="container-luxe">
        <Reveal className="flex flex-col items-center text-center">
          <p className="eyebrow">From our kitchen to yours</p>
          <h2 className="display mt-4 text-5xl sm:text-6xl">
            Follow <span className="italic text-brand">{handle}</span>
          </h2>
          {social.instagram && (
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline mt-8 text-brand"
            >
              <InstagramIcon className="h-4 w-4" /> Follow on Instagram
            </a>
          )}
        </Reveal>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6 lg:grid-rows-2">
          {images.slice(0, 6).map((img, i) => (
            <Reveal
              key={`${img.image}-${i}`}
              delay={i * 0.06}
              className={clsx(
                "relative overflow-hidden rounded-2xl bg-cream",
                i === 0 ? "col-span-2 row-span-2 aspect-square lg:col-span-2 lg:aspect-auto" : "aspect-square",
                i === 3 && "lg:col-span-2 lg:row-span-2 lg:aspect-auto",
              )}
            >
              <Wrapper className="group absolute inset-0 block">
                <Image
                  src={img.image}
                  alt={img.alt}
                  fill
                  sizes={i === 0 || i === 3 ? "(min-width:1024px) 33vw, 100vw" : "(min-width:1024px) 17vw, 50vw"}
                  unoptimized={!isOptimizable(img.image)}
                  className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-luxe)] group-hover:scale-105"
                />
                {social.instagram && (
                  <span className="absolute inset-0 grid place-items-center bg-brand-950/0 text-ivory opacity-0 transition duration-500 group-hover:bg-brand-950/35 group-hover:opacity-100">
                    <InstagramIcon className="h-7 w-7" />
                  </span>
                )}
              </Wrapper>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
