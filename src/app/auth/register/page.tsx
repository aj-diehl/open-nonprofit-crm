import Link from "next/link";
import { RegisterForm } from "./ui";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-6 py-16">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create a new organization, or join an existing one with an invite code.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>

          <div className="mt-6 text-sm text-slate-600">
            Already have an account?{" "}
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
