import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewGrantForm } from "./ui";

export default function NewGrantPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New grant</h1>
          <p className="mt-1 text-sm text-slate-600">Create a grant opportunity record.</p>
        </div>
        <Link href="/app/grants">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card className="p-6">
        <NewGrantForm />
      </Card>
    </div>
  );
}
