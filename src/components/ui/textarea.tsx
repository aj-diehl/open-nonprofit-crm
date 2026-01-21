import * as React from "react";
import { cn } from "@/lib/shared/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  );
});
