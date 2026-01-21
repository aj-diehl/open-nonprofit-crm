"use client";

import { useFormState } from "react-dom";
import { updatePasswordAction, type ResetPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">New password</label>
        <Input type="password" name="password" autoComplete="new-password" required />
        <div className="text-xs text-slate-500">Minimum 8 characters.</div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Confirm password</label>
        <Input type="password" name="confirmPassword" autoComplete="new-password" required />
      </div>

      <Button type="submit" className="w-full">
        Update password
      </Button>
    </form>
  );
}
