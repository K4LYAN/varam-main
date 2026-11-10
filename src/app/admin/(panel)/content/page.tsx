import { db } from "@/lib/data";
import { envWhatsAppNumber } from "@/lib/config";
import { AdminTitle } from "@/components/admin/ui";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const metadata = { title: "Website content" };

export default async function ContentPage() {
  const settings = await db.settings();
  return (
    <>
      <AdminTitle title="Website content" description="Edit the homepage banner, brand story, contact details, WhatsApp number, gallery and policies." />
      <ContentEditor initial={settings} envNumber={envWhatsAppNumber} />
    </>
  );
}
