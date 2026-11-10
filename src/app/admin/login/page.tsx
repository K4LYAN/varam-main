import { redirect } from "next/navigation";
import { getAdmin, isAdminConfigured } from "@/lib/auth";
import { Wordmark } from "@/components/ui/Wordmark";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="grid min-h-dvh place-items-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark tone="light" />
        </div>
        <div className="rounded-2xl bg-ivory p-7 shadow-2xl">
          <h1 className="font-serif text-3xl">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">Manage products, prices and website content.</p>
          {!isAdminConfigured() && (
            <p className="mt-4 rounded-lg bg-copper/10 p-3 text-xs leading-relaxed text-copper">
              Admin access is not configured. Set <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD_HASH</code> and{" "}
              <code>AUTH_SECRET</code> — see README.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
