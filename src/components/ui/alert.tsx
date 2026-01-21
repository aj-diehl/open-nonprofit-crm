import { cn } from "@/lib/shared/cn";

export function Alert({
  variant = "info",
  className,
  children,
}: {
  variant?: "info" | "error" | "success";
  className?: string;
  children: React.ReactNode;
}) {
  const styles =
    variant === "error"
      ? "border-danger/20 bg-danger/10 text-danger"
      : variant === "success"
        ? "border-success/20 bg-success/10 text-success"
        : "border-foreground/15 bg-muted text-foreground";

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", styles, className)} role="alert">
      {children}
    </div>
  );
}
