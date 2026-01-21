"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importSpreadsheetAction, type ImportState } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect } from "react";

const initialState: ImportState = {};

export function ImportForm() {
  const [state, action] = useFormState(importSpreadsheetAction, initialState);

  useEffect(() => {
    if (state?.message) toast.success(state.message);
  }, [state?.message]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Import type</label>
          <Select
            name="importType"
            defaultValue="donations"
            options={[
              { value: "donations", label: "Donations (with donor info)" },
              { value: "donors", label: "Donors only" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Spreadsheet</label>
          <input
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="block w-full rounded-lg border bg-white px-3 py-2 text-sm"
            required
          />
          <div className="text-xs text-slate-500">CSV or Excel (.xlsx). We&apos;ll map columns automatically.</div>
        </div>
      </div>

      <ImportStatus />
      <SubmitButton />
    </form>
  );
}

function ImportStatus() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <div className="text-sm text-slate-600">Starting import... We will notify you when it finishes.</div>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importing..." : "Start import"}
    </Button>
  );
}
