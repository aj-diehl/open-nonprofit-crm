"use client";

import { useFormState } from "react-dom";
import { createDonorAction, type NewDonorState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

const initialState: NewDonorState = {};

export function NewDonorForm() {
  const [state, action] = useFormState(createDonorAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Donor type</label>
        <Select name="donorType" defaultValue="individual" options={[
          { value: "individual", label: "Individual" },
          { value: "organization", label: "Organization" },
        ]} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">First name</label>
          <Input name="firstName" placeholder="Jane" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Last name</label>
          <Input name="lastName" placeholder="Doe" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Organization name</label>
        <Input name="organizationName" placeholder="(If donor is an organization)" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input name="email" type="email" placeholder="jane@example.org" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <Input name="phone" placeholder="+1 (555) 555-5555" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Reason for donation (optional)</label>
        <Textarea name="notes" placeholder="Why they give, context, stewardship notes." rows={3} />
      </div>

      <div className="flex justify-end">
        <Button type="submit">Create donor</Button>
      </div>
    </form>
  );
}
