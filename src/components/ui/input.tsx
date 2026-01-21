import * as React from "react";
import { cn } from "@/lib/shared/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  );
});
