import { db } from "@/lib/data";
import { AdminTitle } from "@/components/admin/ui";
import { TestimonialsManager } from "@/components/admin/Managers";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const testimonials = await db.testimonials();
  return (
    <>
      <AdminTitle
        title="Reviews & testimonials"
        description="Add your Google reviews (copy them exactly from your Google Business Profile, choose “Google review”) and direct customer feedback. Only publish genuine reviews — never write or edit them. With a Google Places API key set, live Google reviews are shown automatically instead."
      />
      <TestimonialsManager testimonials={testimonials} />
    </>
  );
}
