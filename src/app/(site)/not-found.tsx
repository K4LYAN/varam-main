import Link from "next/link";
import { BottleArt } from "@/components/product/BottleArt";

export default function NotFound() {
  return (
    <section className="container-luxe flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <BottleArt name="Not Found" tone="#e8dcc3" className="h-48 w-auto opacity-80" />
      <p className="eyebrow mt-8">404</p>
      <h1 className="display mt-4 text-6xl">This bottle is empty.</h1>
      <p className="mt-4 max-w-md text-muted">The page you are looking for has moved or no longer exists.</p>
      <div className="mt-10 flex gap-3">
        <Link href="/" className="btn btn-primary">
          Go home
        </Link>
        <Link href="/oils" className="btn btn-outline">
          Our oils
        </Link>
      </div>
    </section>
  );
}
