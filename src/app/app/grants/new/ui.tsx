"use client";

import { useFormState } from "react-dom";
import { createGrantAction, type NewGrantState } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState: NewGrantState = {};

export function NewGrantForm() {
  const [state, action] = useFormState(createGrantAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Grant title</label>
        <Input name="title" placeholder="2026 Community Impact Grant" required />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Funder</label>
          <Input name="funder" placeholder="Acme Foundation" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            name="status"
            defaultValue="writing"
            options={[
              { value: "prospecting", label: "Prospecting" },
              { value: "writing", label: "Writing" },
              { value: "submitted", label: "Submitted" },
              { value: "awarded", label: "Awarded" },
              { value: "declined", label: "Declined" },
              { value: "reporting", label: "Reporting" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Due date</label>
          <Input name="dueDate" type="date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Requested amount (USD)</label>
          <Input name="requestedAmount" type="number" step="0.01" placeholder="25000" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Create grant</Button>
      </div>
    </form>
  );
}
