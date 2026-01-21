"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input type="email" name="email" autoComplete="email" placeholder="you@org.org" required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" name="password" autoComplete="current-password" required />
      </div>

      <div className="flex justify-end">
        <Link className="text-xs text-slate-600 underline underline-offset-4" href="/auth/forgot">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
