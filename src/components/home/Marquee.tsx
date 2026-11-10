import { SeedMark } from "@/components/ui/Wordmark";

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-line bg-cream py-6" aria-hidden="true">
      <div className="flex w-max animate-[marquee_48s_linear_infinite] items-center gap-10 motion-reduce:animate-none">
        {[...row, ...row].map((item, i) => (
          <span key={i} className="flex items-center gap-10 font-serif text-3xl whitespace-nowrap text-brand italic sm:text-4xl">
            {item}
            <SeedMark className="h-6 w-6 text-brand/40" />
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
