"use client";

import { useFormState } from "react-dom";
import { registerAction, type RegisterState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-medium">Join an existing organization</div>
        <div className="mt-2 text-sm text-slate-600">
          If you have an invite code, enter it here. Otherwise, leave blank to create a new organization.
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium">Invite code (optional)</label>
          <Input name="inviteCode" placeholder="e.g., NP-8F3K2D" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Organization name (for new org)</label>
        <Input name="orgName" placeholder="Acme Community Foundation" />
        <div className="text-xs text-slate-500">
          Only required if you are creating a new organization.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your name</label>
          <Input name="displayName" placeholder="Jane Doe" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input name="email" type="email" autoComplete="email" placeholder="jane@org.org" required />
          <div className="text-xs text-slate-500">Used for sign-in and notifications.</div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" name="password" autoComplete="new-password" required />
        <div className="text-xs text-slate-500">Minimum 8 characters.</div>
      </div>

      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  );
}
