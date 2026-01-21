import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "./ui";

export default async function ResetPasswordPage() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const hasSession = Boolean(auth?.user?.id);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="mt-2 text-sm text-slate-600">Choose a strong password you don't reuse elsewhere.</p>

          <div className="mt-6">
            {hasSession ? (
              <ResetPasswordForm />
            ) : (
              <>
                <Alert variant="error">Reset link expired or invalid. Please request a new one.</Alert>
                <div className="mt-4 text-sm text-slate-600">
                  <Link className="font-medium text-slate-900 underline underline-offset-4" href="/auth/forgot">
                    Request a new reset link
                  </Link>
                  .
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
