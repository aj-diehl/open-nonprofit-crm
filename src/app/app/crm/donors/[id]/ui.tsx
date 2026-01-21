"use client";

import { useTransition } from "react";
import { createDonationForDonorAction, createInteractionAction } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function DonationForm({ donorId, currency }: { donorId: string; currency: string }) {
  const [isPending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await createDonationForDonorAction(fd);
            toast.success("Donation added");
          } catch (e: any) {
            toast.error(e?.message || "Failed");
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="donorId" value={donorId} />
      <Alert className="flex items-center gap-3 border-emerald-200 bg-emerald-50 text-emerald-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
            <path d="M5 16l.75 1.75L7.5 18l-1.75.75L5 20l-.75-1.25L2.5 18l1.75-.25L5 16z" />
          </svg>
        </span>
        <div className="text-xs">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Dictation mode</div>
          <div className="text-emerald-800/80">Coming soon for donation inputs.</div>
        </div>
        <span className="ml-auto rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
          Soon
        </span>
      </Alert>

      <div className="space-y-2">
        <label className="text-sm font-medium">Amount</label>
        <Input name="amount" type="number" step="0.01" placeholder="100" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Currency</label>
        <Input name="currency" defaultValue={currency} maxLength={3} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Input name="donatedAt" type="date" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Campaign</label>
        <Input name="campaign" placeholder="Spring appeal" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Channel</label>
        <Input name="channel" placeholder="Online / Mail / Event" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Goods or services provided?</label>
        <Select
          name="goodsOrServicesProvided"
          defaultValue="false"
          options={[
            { value: "false", label: "No goods or services were provided" },
            { value: "true", label: "Yes — goods/services were provided" },
          ]}
        />
        <div className="text-xs text-slate-500">If yes, include a description and good-faith value estimate.</div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Goods/services description (required if yes)</label>
        <Textarea name="goodsOrServicesDescription" placeholder="Event dinner, T-shirt, or other benefit" rows={2} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Fair market value (required if yes)</label>
        <Input name="goodsOrServicesValue" type="number" step="0.01" placeholder="25.00" />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Add donation"}
      </Button>
    </form>
  );
}

export function InteractionForm({ donorId }: { donorId: string }) {
  const [isPending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await createInteractionAction(fd);
            toast.success("Interaction saved");
          } catch (e: any) {
            toast.error(e?.message || "Failed");
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="donorId" value={donorId} />

      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Input name="type" placeholder="Call / Meeting / Email / Thank-you note" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Subject</label>
        <Input name="subject" placeholder="Optional" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Textarea name="body" rows={6} placeholder="What happened? Next steps?" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Date/time</label>
        <Input name="occurredAt" type="datetime-local" required />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Save interaction"}
      </Button>
    </form>
  );
}
