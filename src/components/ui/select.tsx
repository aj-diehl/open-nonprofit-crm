import * as React from "react";
import { cn } from "@/lib/shared/cn";

export type SelectOption = { value: string; label: string };

export function Select({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: SelectOption[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
