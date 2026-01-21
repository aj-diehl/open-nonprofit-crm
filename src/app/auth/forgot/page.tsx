import Link from "next/link";
import { ForgotPasswordForm } from "./ui";
import { Card } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">Enter your email and we'll send a secure reset link.</p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
          <div className="mt-6 text-sm text-slate-600">
            Remembered your password?{" "}
            <Link className="font-medium text-slate-900 underline underline-offset-4" href="/auth/login">
              Sign in
            </Link>
            .
          </div>
        </Card>
      </div>
    </main>
  );
}
