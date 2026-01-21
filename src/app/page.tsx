import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/getViewer";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const viewer = await getViewer();

  if (viewer?.profile?.status === "active") {
    redirect("/app/dashboard");
  }
  if (viewer?.profile?.status === "pending") {
    redirect("/auth/pending");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-2xl border bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight">
            {process.env.NEXT_PUBLIC_APP_NAME || "NonprofitOS"}
          </h1>
          <p className="mt-3 text-slate-600">
            An all-in-one platform for donor CRM, grants, communications, and organizational knowledge — powered by
            agentic workflows and OpenAI GPT-5 family models.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth/register">
              <Button>Create an organization</Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Feature title="CRM + donor operations">
              Import donors and donations from spreadsheets, normalize into a clean schema, and track interactions.
            </Feature>
            <Feature title="Grant writing + lifecycle">
              Upload grant prompts, answer with org context, manage pipeline stages, tasks, and reporting obligations.
            </Feature>
            <Feature title="Communications">
              Generate newsletters, fundraising emails, and announcements using approved organizational context.
            </Feature>
            <Feature title="Org profile + knowledge base">
              Upload docs and scrape your website to continuously update and improve org context and messaging.
            </Feature>
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="font-medium">{title}</div>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}
