import Link from "next/link";
import { LoginForm } from "./ui";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function LoginPage({ searchParams }: { searchParams?: { reset?: string; error?: string } }) {
  const resetSuccess = searchParams?.reset === "1";
  const resetError = searchParams?.error === "reset" || searchParams?.error === "missing_code";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Use your email and password.</p>
          {resetSuccess ? (
            <Alert className="mt-4" variant="success">
              Password updated. Sign in with your new password.
            </Alert>
          ) : null}
          {resetError ? (
            <Alert className="mt-4" variant="error">
              Reset link expired or invalid. Request a new one.
            </Alert>
          ) : null}
          <div className="mt-6">
            <LoginForm />
          </div>
          <div className="mt-6 text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link className="font-medium text-slate-900 underline underline-offset-4" href="/auth/register">
              Create one
            </Link>
            .
          </div>
        </Card>
      </div>
    </main>
  );
}
