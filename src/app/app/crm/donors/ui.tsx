"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDonorAction } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function DonorCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await createDonorAction(fd);
            toast.success("Donor created");
            router.refresh();
            onCreated?.();
          } catch (e: any) {
            toast.error(e?.message || "Failed");
          }
        });
      }}
      className="grid gap-3 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <label className="text-sm font-medium">Donor type</label>
        <Select
          name="donorType"
          defaultValue="individual"
          options={[
            { value: "individual", label: "Individual" },
            { value: "organization", label: "Organization" },
          ]}
          className="mt-2"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">First name</label>
        <Input name="firstName" placeholder="Ada" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Last name</label>
        <Input name="lastName" placeholder="Lovelace" />
      </div>

      <div className="md:col-span-2 space-y-2">
        <label className="text-sm font-medium">Organization name</label>
        <Input name="organizationName" placeholder="Acme Foundation" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" placeholder="name@example.org" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Phone</label>
        <Input name="phone" placeholder="+1 ..." />
      </div>

      <div className="md:col-span-2 space-y-2">
        <label className="text-sm font-medium">Reason for donation (optional)</label>
        <Textarea name="notes" placeholder="Why they give, context, stewardship notes." rows={3} />
      </div>

      <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Create"}
        </Button>
      </div>

      <div className="md:col-span-2 text-xs text-slate-500">
        Tip: If you import donor data later, duplicates can be deduped by email.
      </div>
    </form>
  );
}

export function DonorCreateDialog({ buttonLabel = "New donor" }: { buttonLabel?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        {buttonLabel}
      </Button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <Card className="p-6" role="dialog" aria-modal="true">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-600">New donor</div>
                  <div className="mt-1 text-xl font-semibold">Create donor</div>
                  <div className="mt-1 text-sm text-slate-600">Add a donor manually.</div>
                </div>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="mt-4">
                <DonorCreateForm onCreated={() => setIsOpen(false)} onCancel={() => setIsOpen(false)} />
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
