"use client";

import { useFormState } from "react-dom";
import { createDraftAction, type NewDraftState } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

const initialState: NewDraftState = {};

export function NewDraftForm() {
  const [state, action] = useFormState(createDraftAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Select
            name="type"
            defaultValue="email"
            options={[
              { value: "email", label: "Email" },
              { value: "newsletter", label: "Newsletter" },
              { value: "article", label: "Article" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Audience</label>
          <Input name="audience" placeholder="Donors / community / board / volunteers" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input name="title" placeholder="End-of-year update email" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Goal / prompt</label>
        <Textarea name="goal" placeholder="What do you want this communication to achieve?" required rows={4} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tone</label>
          <Input name="tone" placeholder="Warm, hopeful, specific" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Length</label>
          <Input name="length" placeholder="Short / Medium / Long" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Call to action</label>
          <Input name="callToAction" placeholder="Donate / Volunteer / Share" />
        </div>
      </div>

      <Button type="submit">Generate draft</Button>
      <div className="text-xs text-slate-500">
        Draft generation uses your organization profile and knowledge base. Verify facts before sending.
      </div>
    </form>
  );
}
