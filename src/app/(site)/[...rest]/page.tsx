import { notFound } from "next/navigation";

/** Renders the branded 404 (with header and footer) for unknown URLs. */
export default function CatchAll() {
  notFound();
}
