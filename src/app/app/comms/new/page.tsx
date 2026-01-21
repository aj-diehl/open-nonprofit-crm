import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewDraftForm } from "./ui";

export default function NewDraftPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New communication</h1>
          <p className="mt-1 text-sm text-slate-600">Generate a draft using approved organizational context.</p>
        </div>
        <Link href="/app/comms">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card className="p-6">
        <NewDraftForm />
      </Card>
    </div>
  );
}
